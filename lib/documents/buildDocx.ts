// แปลงเอกสารหนึ่งใบเป็นไฟล์ Word (.docx)
//
// ── ทำไมไม่แปลงจาก HTML ─────────────────────────────────────────────
// ตัวแปลง HTML→Word ทุกตัวจะได้ผลลัพธ์ที่ Word เปิดได้แต่แก้ไม่ได้จริง
// (ตารางซ้อน div ซ้อน style inline) เจ้าของจะเอาไปแก้ต่อไม่ได้เลย
// ที่นี่จึงสร้าง OOXML ตรง ๆ จากโครงบล็อกเดียวกับที่หน้าจอใช้
//
// ── สองเรื่องที่ต้องระวังเป็นพิเศษ ──────────────────────────────────
// 1. ภาษาไทยใน Word เป็น "complex script" — ต้องตั้งทั้ง w:sz และ w:szCs
//    ตั้งแค่ w:sz ตัวหนังสือไทยจะไม่เปลี่ยนขนาดตาม (ทั้งที่ภาษาอังกฤษเปลี่ยน)
//    docx ตั้ง cs ให้เองเมื่อส่ง font เป็น string แต่ขนาดต้องส่งเองทั้งคู่
// 2. ช่องลงชื่อ "ล่างสุดเสมอ" ทำด้วย text frame ยึดขอบล่างของหน้า (framePr)
//    ซึ่งเป็นวิธีที่ Word ใช้เองตอนลากกล่องข้อความไปวางล่างหน้า —
//    ย่อหน้าที่มี framePr ชุดเดียวกันจะถูก Word รวมเป็นกรอบเดียว
// 3. ฟอนต์ Sarabun ถูก **ฝังลงในไฟล์** ไม่ใช่แค่อ้างชื่อ — เครื่องที่ไม่มี
//    Sarabun ติดตั้งจึงยังเห็นถูก (ดู loadFonts) · ต้องเป็น .ttf เท่านั้น
//    woff2 ที่เว็บใช้ Word อ่านไม่ออก จึงเก็บไฟล์ไว้คนละชุดกัน

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import JSZip from 'jszip'

import {
  AlignmentType,
  BorderStyle,
  Document,
  FrameAnchorType,
  Header,
  HorizontalPositionAlign,
  ImageRun,
  Packer,
  Paragraph,
  Tab,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalPositionAlign,
  WidthType,
  convertMillimetersToTwip,
} from 'docx'

import {
  DOC_FONT,
  blockHasText,
  letterheadLines,
  thaiDate,
  type Block,
  type CompanyHead,
  type Signer,
} from './types'

/** ขอบกระดาษ (มม.) — ตรงกับ @page ของฝั่งพิมพ์ PDF ใน DocumentSheet */
const MARGIN = { top: 14, side: 18, bottom: 14 }
const CONTENT_MM = 210 - MARGIN.side * 2

/** ขนาดตัวอักษรเป็น half-point (Word นับครึ่งพอยต์) */
const SZ = {
  body: 22, // 11pt
  headTh: 26, // 13pt — ชื่อบริษัทไทย
  headEn: 21, // 10.5pt
  headMeta: 17, // 8.5pt — ที่อยู่/เบอร์
  heading: 24, // 12pt — หัวข้อในเนื้อหา
  sign: 21, // 10.5pt
} as const

const GRAY = '4B5563'
const DARK = '111827'

/** โหลด .ttf มาฝังในไฟล์ Word
 *
 *  อ่านจากดิสก์ตอนรัน ไม่ import เป็นโมดูล — ไฟล์ฟอนต์เป็นไบนารี 90KB สองตัว
 *  ถ้า import เข้ามาจะถูกยัดเป็น base64 ในบันเดิลของทุก build
 *
 *  โหลดไม่ได้ = ออกไฟล์ต่อโดยไม่ฝังฟอนต์ ดีกว่าดาวน์โหลดไม่ได้เลย
 *  (เครื่องที่มี Sarabun อยู่แล้วก็ยังเห็นถูกอยู่ดี)
 */
type EmbeddedFont = { readonly name: string; readonly data: Buffer }

async function loadFonts(): Promise<EmbeddedFont[]> {
  const dir = join(process.cwd(), 'lib/documents/fonts')
  try {
    const [regular, bold] = await Promise.all([
      readFile(join(dir, 'Sarabun-Regular.ttf')),
      readFile(join(dir, 'Sarabun-Bold.ttf')),
    ])
    // ชื่อต้องเป็น DOC_FONT ทั้งคู่ — Word จับคู่ตัวหนาจากตารางฟอนต์เอง
    return [
      { name: DOC_FONT, data: regular },
      { name: DOC_FONT, data: bold },
    ]
  } catch {
    return []
  }
}

/** ทุก run ต้องผ่านตัวนี้ — กันลืมตั้ง szCs แล้วตัวไทยขนาดไม่เปลี่ยน */
function run(
  text: string,
  opts: { size?: number; bold?: boolean; color?: string } = {}
) {
  const size = opts.size ?? SZ.body
  return new TextRun({
    text,
    font: DOC_FONT,
    size,
    sizeComplexScript: size,
    bold: opts.bold,
    boldComplexScript: opts.bold,
    color: opts.color ?? DARK,
  })
}

const line = (
  text: string,
  o: {
    size?: number
    bold?: boolean
    color?: string
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    before?: number
    after?: number
    indent?: number
  } = {}
) =>
  new Paragraph({
    alignment: o.align,
    spacing: { before: o.before ?? 0, after: o.after ?? 0, line: 300 },
    indent: o.indent ? { firstLine: o.indent } : undefined,
    children: [run(text, o)],
  })

/** ── หัวจดหมาย ──────────────────────────────────────────────────
 *  อยู่ใน Word header จริง ๆ ไม่ใช่ย่อหน้าแรกของเนื้อหา —
 *  เอกสารที่ยาวเกินหน้าเดียวจะได้มีหัวจดหมายทุกหน้าเหมือนกระดาษหัวจดหมายจริง
 *  (ไฟล์ตัวอย่างที่เจ้าของส่งมาก็ทำแบบนี้ — header1.xml)
 */
function buildHeader(company: CompanyHead | null, logo: Buffer | null) {
  const lines = letterheadLines(company)

  const textCell = lines.map((t, i) =>
    line(t, {
      align: AlignmentType.RIGHT,
      size: i === 0 ? SZ.headTh : i === 1 ? SZ.headEn : SZ.headMeta,
      bold: i <= 1,
      color: i <= 1 ? DARK : GRAY,
    })
  )

  const logoCell = logo
    ? [
        new Paragraph({
          children: [
            new ImageRun({
              type: 'png',
              data: logo,
              // สูงคงที่ 22มม. กว้างเผื่อไว้ — โลโก้ทั้ง 3 บริษัทเป็นแนวนอน
              transformation: { width: 150, height: 62 },
            }),
          ],
        }),
      ]
    : [new Paragraph({ children: [] })]

  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const cellBorders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
  }

  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          ...cellBorders,
          insideHorizontal: noBorder,
          insideVertical: noBorder,
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: cellBorders,
                width: { size: 38, type: WidthType.PERCENTAGE },
                children: logoCell,
              }),
              new TableCell({
                borders: cellBorders,
                width: { size: 62, type: WidthType.PERCENTAGE },
                children: textCell,
              }),
            ],
          }),
        ],
      }),
      // เส้นคาดใต้หัวจดหมาย — ทำด้วยขอบล่างของย่อหน้าว่าง
      new Paragraph({
        spacing: { before: 60, after: 120 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 12, color: '1F2937' },
        },
        children: [],
      }),
    ],
  })
}

/** แถวหัวเรื่อง: ป้ายกว้างคงที่ + ค่า — ทำเป็นตารางไร้เส้นให้ค่าตรงคอลัมน์กัน */
function metaRow(label: string, value: string, bold = false) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const borders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
  }
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: convertMillimetersToTwip(22), type: WidthType.DXA },
        children: [line(label, { bold: true })],
      }),
      new TableCell({
        borders,
        children: [line(value, { bold })],
      }),
    ],
  })
}

/** ── ช่องลงชื่อ — ยึดขอบล่างของหน้า ────────────────────────────
 *  ทุกย่อหน้าใช้ framePr ชุดเดียวกัน Word จึงรวมเป็นกรอบเดียวที่ก้นหน้า
 *
 *  ── การจัดแกน (เจ้าของทัก 21 ส.ค. ว่าตำแหน่งไม่ตรงกลางกับลายเซ็น) ──
 *  แกนของบล็อกคือ "เส้นประที่เซ็น" ไม่ใช่กึ่งกลางของทั้งบรรทัด —
 *  คำว่า "ลงชื่อ" อยู่ซ้ายและดันเส้นประไปทางขวา ถ้าจัดกึ่งกลางทั้งบรรทัด
 *  ชื่อกับตำแหน่งจะเยื้องจากเส้นประจริง
 *
 *  ใน Word ทำด้วย **center tab stop**: บรรทัดแรกคือ ลงชื่อ→[tab]→เส้นประ
 *  (เส้นประถูกจัดกึ่งกลางที่ตำแหน่ง tab) ส่วนบรรทัด 2-3 คือ [tab]→ข้อความ
 *  ทั้งสามบรรทัดจึงมีแกนกลางเป็นตำแหน่ง tab เดียวกันเป๊ะ ไม่ต้องเดาความ
 *  กว้างฟอนต์เลย
 */
const COL_MM = 74

function signatureFrame(signers: Signer[]) {
  const list: Signer[] = signers.length ? signers : [{ name: '', title: '' }]
  const dots = (n: number) => '.'.repeat(n)

  const frame = {
    type: 'absolute' as const,
    position: { x: 0, y: 0 },
    width: convertMillimetersToTwip(CONTENT_MM),
    height: convertMillimetersToTwip(38),
    anchor: {
      horizontal: FrameAnchorType.MARGIN,
      vertical: FrameAnchorType.MARGIN,
    },
    alignment: {
      x: HorizontalPositionAlign.CENTER,
      y: VerticalPositionAlign.BOTTOM,
    },
  }

  /** ตำแหน่ง tab นับจากขอบซ้ายของกรอบข้อความ (ไม่ใช่จากย่อหน้า)
   *  = กึ่งกลางของคอลัมน์ที่คนนั้นครอบครอง */
  const axisOf = (i: number) =>
    list.length === 1
      ? CONTENT_MM - COL_MM / 2
      : i === 0
        ? COL_MM / 2
        : CONTENT_MM - COL_MM / 2

  /** 3 บรรทัดของช่องเซ็นหนึ่งช่อง คืนเป็น run — แบบ 2 ช่องต้องเอา run
   *  ของทั้งสองคนมาต่อกันในย่อหน้าเดียว จะคืนเป็นย่อหน้าไม่ได้ */
  const signLines = (s: Signer): TextRun[][] => [
    [run(dots(30), { size: SZ.sign })],
    [
      run('( ', { size: SZ.sign }),
      // ยาวเท่าเส้นเซ็นด้านบน — ของเดิม 24 จุด สั้นเกินจนเขียนชื่อไม่พอ
      run(s.name.trim() || dots(30), {
        size: SZ.sign,
        bold: s.name.trim() !== '',
      }),
      run(' )', { size: SZ.sign }),
    ],
    [
      run(s.title.trim() || `ตำแหน่ง ${dots(18)}`, {
        size: SZ.sign,
        color: GRAY,
      }),
    ],
  ]

  const centerTab = (mm: number) =>
    [{ type: 'center' as const, position: convertMillimetersToTwip(mm) }]

  if (list.length === 1) {
    const axis = axisOf(0)
    const lines = signLines(list[0])
    return lines.map(
      (children, i) =>
        new Paragraph({
          frame,
          spacing: { line: 320 },
          tabStops: centerTab(axis),
          children: [
            // บรรทัดแรกเท่านั้นที่มีคำว่า "ลงชื่อ" นำหน้า
            ...(i === 0 ? [run('ลงชื่อ ', { size: SZ.sign })] : []),
            new TextRun({ children: [new Tab()] }),
            ...children,
          ],
        })
    )
  }

  // 2 ช่อง — ย่อหน้าเดียวมี 2 แกน ใช้ tab stop กึ่งกลาง 2 จุด
  const left = signLines(list[0])
  const right = signLines(list[1])
  const stops = [
    { type: 'center' as const, position: convertMillimetersToTwip(axisOf(0)) },
    { type: 'center' as const, position: convertMillimetersToTwip(axisOf(1)) },
  ]

  const rows = [0, 1, 2].map(
    (i) =>
      new Paragraph({
        frame,
        spacing: { line: 320 },
        tabStops: stops,
        children: [
          ...(i === 0 ? [run('ลงชื่อ ', { size: SZ.sign })] : []),
          new TextRun({ children: [new Tab()] }),
          ...left[i],
          // คำว่า "ลงชื่อ" ของช่องขวา อยู่ก่อน tab จุดที่สอง
          ...(i === 0 ? [run('    ลงชื่อ ', { size: SZ.sign })] : []),
          new TextRun({ children: [new Tab()] }),
          ...right[i],
        ],
      })
  )

  return rows
}

/** ── ซ่อมตารางฟอนต์หลังแพ็กไฟล์ ────────────────────────────────────
 *  docx ฝังฟอนต์ให้ได้ แต่ไม่มีทางบอกว่าไฟล์ไหนคือ "ตัวหนา" —
 *  มันเขียน <w:font w:name="Sarabun"> สองก้อน แล้วใส่ embedRegular ทั้งคู่
 *  Word เจอชื่อฟอนต์ซ้ำสองรายการจะเลือกอันเดียว อีกอันถูกทิ้ง
 *  ผลคือ Sarabun-Bold ที่อุตส่าห์ฝังไปไม่เคยถูกใช้ (Word ปลอมตัวหนาให้แทน)
 *
 *  แก้โดยรวมเป็นก้อนเดียว: embedRegular = ไฟล์แรก · embedBold = ไฟล์ที่สอง
 *  ทำหลังแพ็กเพราะเป็นโครง XML ที่ไลบรารีไม่เปิดให้ตั้ง
 */
async function fixBoldEmbed(buf: Buffer): Promise<Buffer> {
  const PATH = 'word/fontTable.xml'
  try {
    const zip = await JSZip.loadAsync(buf)
    const file = zip.file(PATH)
    if (!file) return buf

    const xml = await file.async('string')
    const blocks = [
      ...xml.matchAll(
        new RegExp(`<w:font w:name="${DOC_FONT}">[\\s\\S]*?</w:font>`, 'g')
      ),
    ].map((m) => m[0])
    // มีก้อนเดียวอยู่แล้ว = ฝังแค่ตัวธรรมดา ไม่ต้องทำอะไร
    if (blocks.length < 2) return buf

    const embedOf = (b: string) => /<w:embedRegular[^/]*\/>/.exec(b)?.[0] ?? ''
    const bold = embedOf(blocks[1]).replace('w:embedRegular', 'w:embedBold')
    if (!bold) return buf

    const merged = blocks[0].replace('</w:font>', `${bold}</w:font>`)
    let out = xml.replace(blocks[0], merged)
    // ก้อนที่เหลือทิ้งทั้งหมด — ไฟล์ .odttf ยังอยู่ ถูกอ้างจาก embedBold แล้ว
    for (const b of blocks.slice(1)) out = out.replace(b, '')

    zip.file(PATH, out)
    return await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })
  } catch {
    // ซ่อมไม่ได้ = ส่งไฟล์เดิมไป ตัวหนาอาจเป็นของปลอม แต่ยังเปิดได้ปกติ
    return buf
  }
}

export type DocxInput = {
  company: CompanyHead | null
  logo: Buffer | null
  docNo: string
  title: string
  period: string
  recipient: string
  body: Block[]
  signers: Signer[]
  issuedAt: string | null
}

export async function buildDocx(d: DocxInput): Promise<Buffer> {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

  const metaRows = [
    metaRow('เรื่อง', d.title || '.'.repeat(40), true),
    ...(d.period.trim() !== '' ? [metaRow('ระยะเวลา', d.period)] : []),
    ...(d.recipient.trim() !== '' ? [metaRow('เรียน', d.recipient)] : []),
  ]

  const bodyParts: Paragraph[] = d.body.filter(blockHasText).flatMap((b) => {
    if (b.kind === 'heading') {
      return [line(b.text, { bold: true, size: SZ.heading, before: 220, after: 80 })]
    }
    if (b.kind === 'bullet') {
      return b.items
        .filter((t) => t.trim() !== '')
        .map(
          (t) =>
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 60, line: 300 },
              children: [run(t)],
            })
        )
    }
    return [
      new Paragraph({
        spacing: { after: 140, line: 300 },
        indent: { firstLine: convertMillimetersToTwip(12) },
        alignment: AlignmentType.JUSTIFIED,
        children: [run(b.text)],
      }),
    ]
  })

  const doc = new Document({
    // ฝังฟอนต์ไว้ในไฟล์ — เครื่องที่ไม่มี Sarabun ก็ยังเห็นเอกสารถูกต้อง
    fonts: await loadFonts(),
    // ตั้งฟอนต์เริ่มต้นทั้งเอกสาร เผื่อมีย่อหน้าที่หลุดไปไม่ได้ผ่าน run()
    styles: {
      default: {
        document: {
          run: { font: DOC_FONT, size: SZ.body, sizeComplexScript: SZ.body },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(MARGIN.top + 26), // เผื่อที่ให้หัวจดหมาย
              right: convertMillimetersToTwip(MARGIN.side),
              bottom: convertMillimetersToTwip(MARGIN.bottom),
              left: convertMillimetersToTwip(MARGIN.side),
              header: convertMillimetersToTwip(MARGIN.top),
            },
          },
        },
        headers: { default: buildHeader(d.company, d.logo) },
        children: [
          ...(d.docNo.trim() !== ''
            ? [
                line(`เลขที่ ${d.docNo}`, {
                  align: AlignmentType.RIGHT,
                  color: GRAY,
                  after: 120,
                }),
              ]
            : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
              insideHorizontal: noBorder,
              insideVertical: noBorder,
            },
            rows: metaRows,
          }),
          new Paragraph({ spacing: { after: 200 }, children: [] }),
          ...bodyParts,
          ...(d.issuedAt
            ? [
                new Paragraph({
                  spacing: { before: 200, line: 300 },
                  indent: { firstLine: convertMillimetersToTwip(12) },
                  children: [run(`ให้ไว้ ณ วันที่ ${thaiDate(d.issuedAt)}`)],
                }),
              ]
            : []),
          ...signatureFrame(d.signers),
        ],
      },
    ],
  })

  return fixBoldEmbed(await Packer.toBuffer(doc))
}

// โครงเอกสารบริษัท — ใช้ร่วมกันระหว่างหน้าจอ (HTML → PDF) กับตัวออกไฟล์ Word
//
// ── ทำไมต้องมีไฟล์นี้ ───────────────────────────────────────────────
// เอกสารหนึ่งใบถูกเรนเดอร์ 2 ที่: [DocumentSheet](../../components/documents/DocumentSheet.tsx)
// สำหรับสั่งพิมพ์ และ [docx route](../../app/api/documents/[id]/docx/route.ts) สำหรับ Word
// ถ้าต่างฝ่ายต่างนิยามโครงเอง วันหนึ่งจะเพิ่มบล็อกชนิดใหม่ในฝั่งเดียวแล้ว
// อีกฝั่งเงียบ ๆ ไม่แสดงอะไรเลย — ชนิดกับตัวช่วยจึงอยู่ที่นี่ที่เดียว

/** ฟอนต์เอกสาร — Sarabun (เจ้าของเลือก 21 ส.ค.)
 *
 *  ── ข้อกังวลที่เจ้าของทักไว้ และคำตอบ ─────────────────────────────
 *  "ถ้าเครื่องปลายทางไม่มีฟอนต์ เปิดไฟล์ Word แล้วจะเพี้ยน" — จริง
 *  แก้ด้วยการ **ฝังฟอนต์ลงในไฟล์ .docx** (ดู buildDocx → fonts) ซึ่ง OOXML
 *  รองรับอยู่แล้ว · PDF ฝังฟอนต์ให้เองอยู่แล้วจึงไม่มีปัญหาตั้งแต่แรก
 *
 *  ⚠️ ไม่ได้ครอบคลุม 100% — Word บางรุ่นและ Google Docs ไม่อ่านฟอนต์ที่ฝังมา
 *  คนกลุ่มนั้นจะเห็นฟอนต์สำรอง (Tahoma) ซึ่งยังอ่านออกและวางหน้าใกล้เคียง
 *
 *  ห้ามเปลี่ยนที่นี่ที่เดียว — ต้องเปลี่ยนพร้อมกัน 3 ที่:
 *    1. ค่านี้  2. @font-face ใน app/globals.css  3. ไฟล์ฟอนต์ใน lib/documents/fonts
 */
export const DOC_FONT = 'Sarabun'
/** ลำดับสำรองฝั่งเว็บ — Tahoma เป็นตัวรอง เพราะมีอยู่ทุกเครื่องแน่นอน */
export const DOC_FONT_STACK = `Sarabun, Tahoma, "Leelawadee UI", "Noto Sans Thai", sans-serif`

export type BlockKind = 'paragraph' | 'heading' | 'bullet'

export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; items: string[] }

export type Signer = {
  /** เว้นว่างได้ — ปกติเซ็นแล้วค่อยเขียนชื่อในวงเล็บด้วยมือ */
  name: string
  title: string
}

export type CompanyHead = {
  id: string
  code: string
  name_th: string
  name_en: string | null
  address: string | null
  phone: string | null
  registration_no: string | null
  branch_label: string | null
  logo_url: string | null
}

export type DocumentRow = {
  id: string
  doc_no: string
  company_id: string
  title: string
  period: string
  recipient: string
  /** ต้นฉบับคือข้อความที่พิมพ์ — บล็อกได้จาก parseBody() ตอนเรนเดอร์ */
  body_text: string
  signers: Signer[]
  status: 'draft' | 'issued'
  issued_at: string | null
  created_at: string
  updated_at: string
}

/** บล็อกที่ไม่มีตัวอักษรเลย ไม่ต้องพิมพ์ออกมาเป็นบรรทัดว่าง */
export const blockHasText = (b: Block): boolean =>
  b.kind === 'bullet'
    ? b.items.some((i) => i.trim() !== '')
    : b.text.trim() !== ''

/** ── ตัวแปลข้อความที่พิมพ์ → บล็อก ────────────────────────────────
 *  เจ้าของสั่ง 21 ส.ค.: ให้พิมพ์เนื้อหารวดเดียวในช่องเดียว ไม่ต้องกดเพิ่มบล็อก
 *
 *  ต้นฉบับที่เก็บในฐานข้อมูลคือ "ข้อความที่พิมพ์" (documents.body_text)
 *  บล็อกเป็นของที่คำนวณสด ๆ ทุกครั้ง — ไม่เก็บซ้ำ จึงไม่มีทางที่สองฝั่งไม่ตรงกัน
 *  ทั้งแผ่น A4 (PDF) และไฟล์ Word เรียกฟังก์ชันนี้ตัวเดียวกัน
 *
 *  กติกา — ตั้งใจให้มีน้อยที่สุดเท่าที่พอใช้ คนกรอกไม่ต้องท่อง:
 *    ขึ้นต้น -  * หรือ •   → หัวข้อย่อย (ติดกันหลายบรรทัด = รายการเดียวกัน)
 *    ขึ้นต้น #             → หัวข้อตัวหนา
 *    บรรทัดอื่น            → ย่อหน้า (บรรทัดละย่อหน้า)
 *    บรรทัดว่าง            → แค่เว้นวรรคในช่องพิมพ์ ไม่มีผลกับเอกสาร
 *
 *  ทำไม "บรรทัดละย่อหน้า" ไม่ใช่ "ต้องเว้นบรรทัดถึงจะขึ้นย่อหน้าใหม่":
 *  คนที่ไม่ได้เขียน Markdown กด Enter แล้วคาดหวังว่าจะได้ย่อหน้าใหม่ทันที
 *  ระยะห่างระหว่างย่อหน้ามาจากแม่แบบอยู่แล้ว ไม่ต้องเว้นบรรทัดเอง
 */
const BULLET_RE = /^[-*•]\s*/
const HEADING_RE = /^#{1,3}\s*/

export function parseBody(text: string): Block[] {
  const out: Block[] = []
  // รายการที่กำลังสะสมอยู่ — บรรทัด - ที่ติดกันต้องรวมเป็นรายการเดียว
  // ไม่งั้นแต่ละข้อจะกลายเป็นรายการของตัวเองแล้วระยะห่างถ่างผิด
  let bullets: string[] | null = null
  const flush = () => {
    if (bullets?.length) out.push({ kind: 'bullet', items: bullets })
    bullets = null
  }

  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim()
    if (t === '') continue

    if (BULLET_RE.test(t)) {
      const item = t.replace(BULLET_RE, '').trim()
      if (item === '') continue
      bullets = bullets ?? []
      bullets.push(item)
      continue
    }

    flush()
    if (HEADING_RE.test(t)) {
      const h = t.replace(HEADING_RE, '').trim()
      if (h !== '') out.push({ kind: 'heading', text: h })
    } else {
      out.push({ kind: 'paragraph', text: t })
    }
  }
  flush()
  return out
}

/** แปลงกลับเป็นข้อความ — ใช้ตอนย้ายข้อมูลเก่า/กู้คืนรุ่นที่เก็บเป็นบล็อกไว้ */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) =>
      b.kind === 'heading'
        ? `# ${b.text}`
        : b.kind === 'bullet'
          ? b.items.map((i) => `- ${i}`).join('\n')
          : b.text
    )
    .join('\n')
}

/** ── หัวจดหมาย ────────────────────────────────────────────────────
 *  ทั้ง 3 บริษัทใช้แม่แบบเดียวกัน เปลี่ยนแค่โลโก้กับข้อความชุดนี้
 *  ช่องที่ยังไม่ได้กรอกในตาราง companies = บรรทัดนั้นหายไปเลย
 *  ไม่ใช่ขึ้นเป็นช่องว่างหรือคำว่า null บนหัวจดหมายจริง
 */
export function letterheadLines(c: CompanyHead | null): string[] {
  if (!c) return []
  const thai = [
    `บริษัท ${c.name_th}`,
    c.branch_label ? `(${c.branch_label})` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const contact = [
    c.phone ? `โทร : ${c.phone}` : '',
    c.registration_no ? `เลขประจำตัวผู้เสียภาษี : ${c.registration_no}` : '',
  ].filter(Boolean)

  return [thai, c.name_en ?? '', c.address ?? '', contact.join('   ')].filter(
    (l) => l.trim() !== ''
  )
}

/** วันที่แบบไทยเต็ม — ใช้ทั้งบนเอกสารและในรายการ */
export const thaiDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

/** ชื่อไฟล์ตอนดาวน์โหลด — ห้ามมีอักขระที่ระบบไฟล์รับไม่ได้ */
export function fileNameOf(doc: { doc_no: string; title: string }) {
  const base = [doc.doc_no, doc.title].filter((s) => s.trim() !== '').join(' ')
  return (base || 'เอกสาร').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120)
}

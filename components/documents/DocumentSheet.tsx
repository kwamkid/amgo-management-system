'use client'

// แผ่นเอกสาร A4 — ตัวเดียวที่ใช้ทั้งดูตัวอย่างบนจอและสั่งพิมพ์เป็น PDF
//
// ── กติกาที่ต้องไม่พัง ──────────────────────────────────────────────
// 1. ช่องลงชื่ออยู่ "ล่างสุดเสมอ" — ใช้ flex column + mt-auto ไม่ใช่เว้นบรรทัด
//    เนื้อหาสั้นแค่ไหนลายเซ็นก็ติดขอบล่าง เนื้อหายาวข้ามหน้าก็ไปอยู่ล่างหน้าสุดท้าย
// 2. ฟอนต์ Tahoma ตรงกับไฟล์ Word (ดู DOC_FONT) — เปลี่ยนที่นี่ต้องเปลี่ยนที่โน่นด้วย
// 3. ความสูงตอนพิมพ์ = 297มม. ลบขอบบน/ล่างของ @page (ดู printCss ท้ายไฟล์)
//    ถ้าแก้ margin ใน @page ต้องแก้ min-h ตอนพิมพ์ให้ตรงกัน ไม่งั้นลายเซ็นเลื่อน

import {
  DOC_FONT_STACK,
  blockHasText,
  letterheadLines,
  thaiDate,
  type Block,
  type CompanyHead,
  type Signer,
} from '@/lib/documents/types'

/** ขอบกระดาษ (มม.) — อยู่ใน padding ของตัวแผ่นเอง ไม่ใช่ใน @page
 *
 *  ⚠️ ห้ามย้ายกลับไปฝากไว้กับ @page — ตัวเลือก "Margins" ในกล่องพิมพ์ของ
 *  Chrome สั่งทับ @page ได้ ใครที่เคยตั้งเป็น None ไว้จะได้เอกสารไม่มีขอบเลย
 *  (เจ้าของเจอเองตอนพิมพ์จริง 21 ส.ค. — หน้าทดสอบของผมไม่เจอเพราะสั่งพิมพ์
 *  ผ่าน DevTools ที่บังคับใช้ค่าจาก CSS)
 */
const PAGE_MARGIN = { top: 14, side: 18, bottom: 14 }

export const SHEET_ID = 'document-sheet'

export type SheetProps = {
  company: CompanyHead | null
  docNo: string
  title: string
  period: string
  recipient: string
  body: Block[]
  signers: Signer[]
  /** วันที่ออกเอกสาร — ว่าง = ไม่ขึ้นบรรทัด "ให้ไว้ ณ วันที่" */
  issuedAt: string | null
}

/** เส้นประให้เขียนมือ — ยาวคงที่ ไม่ยืดตามข้อความที่ยังไม่มี */
const Dots = ({ ch = 34 }: { ch?: number }) => (
  <span className="tracking-[0.08em] text-gray-500">{'.'.repeat(ch)}</span>
)

export function DocumentSheet(props: SheetProps) {
  const { company, docNo, title, period, recipient, body, signers } = props
  const head = letterheadLines(company)
  const blocks = body.filter(blockHasText)
  // ไม่มีใครเซ็น = ยังต้องมี 1 ช่องไว้เซ็นมือ เอกสารบริษัทไม่มีลายเซ็นใช้ไม่ได้
  const signRow: Signer[] = signers.length ? signers : [{ name: '', title: '' }]

  return (
    <div
      id={SHEET_ID}
      style={{ fontFamily: DOC_FONT_STACK }}
      className={[
        'mx-auto flex w-[210mm] max-w-full flex-col bg-white text-[14.5px] leading-[1.85] text-gray-900',
        'min-h-[297mm] p-[18mm] pt-[14mm]',
        'rounded-xl border border-gray-200 shadow-sm',
        // ตอนพิมพ์เอากรอบ/เงาออก — ขนาดกับขอบตั้งใน printCss ไม่ใช่คลาส
        // Tailwind (คลาสที่ประกอบจากตัวแปรจะไม่ถูกสร้าง CSS ให้ตอน build)
        'print:rounded-none print:border-0 print:shadow-none',
      ].join(' ')}
    >
      {/* ── หัวจดหมาย ─────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-6">
        <div className="flex h-[24mm] w-[52mm] shrink-0 items-center">
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.name_th}
              className="max-h-full max-w-full object-contain object-left"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-gray-300 text-[11px] text-gray-400 print:hidden">
              ยังไม่มีโลโก้ — ตั้งค่า &gt; บริษัท
            </div>
          )}
        </div>

        <div className="min-w-0 pt-[2mm] text-right">
          {head.map((line, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'text-[16px] leading-[1.5] font-bold text-gray-900'
                  : i === 1
                    ? 'text-[13px] leading-[1.5] font-semibold tracking-wide text-gray-700'
                    : 'text-[11.5px] leading-[1.6] text-gray-500'
              }
            >
              {line}
            </p>
          ))}
        </div>
      </header>

      {/* เส้นคาดใต้หัวจดหมาย — หนาบาง 2 ชั้น ให้ดูเป็นเอกสารทางการ */}
      <div className="mt-[4mm] border-t-2 border-gray-800" />
      <div className="mt-[1.2px] border-t border-gray-300" />

      {docNo.trim() !== '' && (
        <p className="mt-[4mm] text-right text-[12px] text-gray-500">
          เลขที่ {docNo}
        </p>
      )}

      {/* ── หัวเรื่อง ──────────────────────────────────────────────── */}
      <div className={docNo.trim() !== '' ? 'mt-[3mm]' : 'mt-[7mm]'}>
        <MetaRow label="เรื่อง" value={title} bold />
        {period.trim() !== '' && <MetaRow label="ระยะเวลา" value={period} />}
        {recipient.trim() !== '' && <MetaRow label="เรียน" value={recipient} />}
      </div>

      {/* ── เนื้อหา ───────────────────────────────────────────────── */}
      <div className="mt-[7mm] space-y-[3.5mm]">
        {blocks.map((b, i) =>
          b.kind === 'heading' ? (
            <h2
              key={i}
              className="pt-[2mm] text-[15.5px] font-bold text-gray-900"
            >
              {b.text}
            </h2>
          ) : b.kind === 'bullet' ? (
            <ul key={i} className="space-y-[1.5mm] pl-[10mm]">
              {b.items
                .filter((t) => t.trim() !== '')
                .map((t, j) => (
                  <li key={j} className="relative">
                    <span className="absolute -left-[6mm] text-gray-700">•</span>
                    {t}
                  </li>
                ))}
            </ul>
          ) : (
            <p key={i} className="indent-[12mm] text-justify">
              {b.text}
            </p>
          )
        )}
      </div>

      {props.issuedAt && (
        <p className="mt-[6mm] indent-[12mm]">
          ให้ไว้ ณ วันที่ {thaiDate(props.issuedAt)}
        </p>
      )}

      {/* ── ผู้ลงนาม — ดันชิดล่างเสมอ ห้ามให้ขาดกลางหน้า ──────────── */}
      <footer
        className="mt-auto pt-[10mm]"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        <div
          className={
            signRow.length === 2
              ? 'flex items-end justify-between gap-8'
              : 'flex justify-end'
          }
        >
          {signRow.map((s, i) => (
            <SignBlock key={i} signer={s} />
          ))}
        </div>
      </footer>
    </div>
  )
}

function MetaRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex gap-2">
      <span className="w-[20mm] shrink-0 font-semibold text-gray-900">
        {label}
      </span>
      <span className={bold ? 'font-bold text-gray-900' : 'text-gray-900'}>
        {value.trim() !== '' ? value : <Dots ch={40} />}
      </span>
    </div>
  )
}

/** ── ช่องลงชื่อหนึ่งช่อง ──────────────────────────────────────────
 *  แกนกลางของบล็อกนี้คือ "เส้นประที่เซ็น" ไม่ใช่กึ่งกลางของทั้งบรรทัด
 *
 *  ถ้าจัดกึ่งกลางทั้งบรรทัด คำว่า "ลงชื่อ" ที่อยู่ซ้ายจะดันเส้นประไปทางขวา
 *  แล้วชื่อกับตำแหน่งข้างล่างจะเยื้องจากเส้นประที่เซ็นจริงราว 5 มม.
 *  (เจ้าของทักเรื่องนี้ 21 ส.ค.)
 *
 *  แก้ด้วยการวางตัวเว้นที่ซ่อนไว้ (คำว่า "ลงชื่อ" แบบมองไม่เห็น) หน้าบรรทัด
 *  ที่ 2 และ 3 — กว้างเท่ากันเป๊ะโดยไม่ต้องเดาความกว้างของฟอนต์
 */
function SignBlock({ signer }: { signer: Signer }) {
  const label = 'ลงชื่อ'
  const inner = (
    <>
      <Row label={label}>
        <span className="inline-block w-full border-b border-dotted border-gray-500 align-baseline" />
      </Row>

      {/* วงเล็บใส่ชื่อ — เส้นยืดเต็มความกว้างที่เหลือ ไม่ใช่จุดจำนวนตายตัว
          ของเดิมสั้นเกินจนเขียนชื่อไม่พอ (เจ้าของทัก 21 ส.ค.) */}
      <Row label={label} hideLabel>
        <span className="flex items-baseline justify-center gap-1.5">
          <span className="shrink-0">(</span>
          {signer.name.trim() !== '' ? (
            <span className="font-semibold">{signer.name}</span>
          ) : (
            <span className="inline-block w-full border-b border-dotted border-gray-500" />
          )}
          <span className="shrink-0">)</span>
        </span>
      </Row>

      <Row label={label} hideLabel>
        <span className="text-gray-800">
          {signer.title.trim() !== '' ? (
            signer.title
          ) : (
            <>
              ตำแหน่ง <Dots ch={18} />
            </>
          )}
        </span>
      </Row>
    </>
  )

  return <div className="w-[74mm] text-[13.5px] leading-[2.1]">{inner}</div>
}

/** บรรทัดในช่องลงชื่อ — ป้ายซ้ายกว้างเท่ากันทุกบรรทัด (บรรทัด 2-3 ซ่อนไว้)
 *  เนื้อหาจึงจัดกึ่งกลางบนแกนเดียวกับเส้นประเสมอ */
function Row({
  label,
  hideLabel,
  children,
}: {
  label: string
  hideLabel?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline">
      {/* ⚠️ ห้ามใช้ invisible/visibility ซ่อน — printCss สั่ง
          `#document-sheet * { visibility: visible }` ทับกลับหมด
          ตอนพิมพ์จริงคำว่า "ลงชื่อ" จะโผล่ครบทั้ง 3 บรรทัด
          ใช้สีโปร่งใสแทน กินที่เท่าเดิมแต่ print ไม่ไปยุ่ง */}
      <span
        aria-hidden={hideLabel || undefined}
        className={`shrink-0 pr-2 ${hideLabel ? 'text-transparent' : ''}`}
      >
        {label}
      </span>
      <span className="flex-1 text-center">{children}</span>
    </div>
  )
}

/** CSS ตอนสั่งพิมพ์ — โชว์เฉพาะแผ่นเอกสาร ที่เหลือซ่อนหมด
 *
 *  ── ทำไมต้องกว้าง 210mm ตายตัว ห้ามใช้ 100% ─────────────────────
 *  ตอนพิมพ์ Chrome คิด width:100% ของ element ที่ position:absolute จาก
 *  **ความกว้างหน้าต่างเบราว์เซอร์** ไม่ใช่ความกว้างกระดาษ
 *  จอกว้าง 1400px = 370mm → แผ่นถูกวางเป็น 370mm แล้ว Chrome ย่อลงให้พอดี
 *  A4 ตัวหนังสือจึงเล็กกว่าที่เห็นบนจอราว 40% (เจ้าของเจอเอง 21 ส.ค.)
 *  ใส่ 210mm ตายตัว = ได้ขนาดเท่าที่เห็นบนจอเสมอ ไม่ว่าจอใครกว้างแค่ไหน
 *
 *  ── ทำไม @page margin เป็น 0 ────────────────────────────────────
 *  กล่องพิมพ์ของ Chrome มีตัวเลือก Margins ที่ "ทับ" ค่าใน CSS ได้
 *  ตั้งขอบไว้ใน @page แล้วเครื่องที่เลือก None ไว้จะได้เอกสารชิดขอบกระดาษ
 *  ขอบจึงอยู่ใน padding ของตัวแผ่น ซึ่งไม่มีใครสั่งทับได้
 */
export const printCss = `
  @media print {
    body * { visibility: hidden; }
    #${SHEET_ID}, #${SHEET_ID} * { visibility: visible; }
    #${SHEET_ID} {
      position: absolute; left: 0; top: 0;
      /* ขนาดกระดาษ A4 เต็มใบ — ขอบอยู่ใน padding ข้างล่าง */
      width: 210mm;
      min-height: 297mm;
      padding: ${PAGE_MARGIN.top}mm ${PAGE_MARGIN.side}mm ${PAGE_MARGIN.bottom}mm;
      box-sizing: border-box;
    }
    @page { size: A4; margin: 0; }
  }
`

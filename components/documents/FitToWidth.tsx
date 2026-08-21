'use client'

// ย่อแผ่นเอกสารให้พอดีความกว้างที่มี — ไม่ใช่บีบให้ข้อความไหลใหม่
//
// ── ปัญหาที่แก้ (เจ้าของเจอบนมือถือ 22 ส.ค.) ────────────────────────
// แผ่นเป็น A4 กว้าง 210มม. (794px) ตายตัว เพราะเอกสารต้องขึ้นบรรทัดตรงกับ
// ตอนพิมพ์เป๊ะ · เดิมใส่ `max-w-full` ไว้ พอจอกว้าง 390px แผ่นถูกบีบเหลือ
// 390px แล้ว **ข้อความไหลใหม่** — คอลัมน์หัวจดหมายเหลือ ~100px ตกบรรทัด
// คำละบรรทัดจนอ่านไม่ได้ และไม่ตรงกับ PDF ที่จะพิมพ์ออกมาด้วย
//
// ที่ถูกคือ "ย่อทั้งแผ่น" เหมือนซูมออก — บรรทัดยังขึ้นเหมือนเดิมทุกประการ
//
// ⚠️ transform ต้องอยู่ใน @media screen เท่านั้น
// ตอนพิมพ์ แผ่นถูกตั้งเป็น position:absolute (ดู printCss) ซึ่งอ้างอิงกรอบ
// หน้ากระดาษ · ถ้ามี ancestor ที่มี transform (แม้แต่ scale(1)) ancestor นั้น
// จะกลายเป็นจุดอ้างอิงแทน แล้วแผ่นหลุดออกนอกหน้าไปเลย

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** ความกว้างแผ่น A4 เป็นพิกเซล CSS — 210มม. ที่ 96dpi */
const SHEET_PX = (210 / 25.4) * 96

export function FitToWidth({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  /** ความสูงจริงของแผ่นก่อนย่อ — เอกสารยาวไม่เท่ากันทุกใบ */
  const [naturalH, setNaturalH] = useState(0)

  useEffect(() => {
    const box = outer.current
    const sheet = inner.current
    if (!box || !sheet) return

    const measure = () => {
      // ไม่ขยายเกิน 1 — จอกว้างกว่ากระดาษ ให้แสดงขนาดจริง ไม่ใช่ซูมเข้า
      setScale(Math.min(1, box.clientWidth / SHEET_PX))
      setNaturalH(sheet.offsetHeight)
    }
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(box)
    ro.observe(sheet) // เนื้อหาเปลี่ยน (พิมพ์อยู่) ความสูงก็เปลี่ยน
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={outer} className="w-full">
      {/* กล่องนี้กันไม่ให้เกิดที่ว่างใต้แผ่น — แผ่นที่ถูกย่อยังกินที่เท่าเดิม
          ในสายตา layout เพราะ transform ไม่เปลี่ยนขนาดกล่อง */}
      <div
        className="doc-fit-box overflow-hidden"
        style={{ height: naturalH ? naturalH * scale : undefined }}
      >
        <div
          ref={inner}
          className="doc-fit"
          style={{
            width: SHEET_PX,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @media print {
          /* ต้อง !important เพราะทับ inline style — และต้องปลด transform
             ให้เป็น none จริง ๆ ไม่งั้นกล่องนี้กลายเป็นจุดอ้างอิงของแผ่น */
          .doc-fit { transform: none !important; width: auto !important; }
          .doc-fit-box { height: auto !important; overflow: visible !important; }
        }
      `}</style>
    </div>
  )
}

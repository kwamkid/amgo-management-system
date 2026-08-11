'use client'

// ช่องกรอกจำนวนเงิน — เติมลูกน้ำคั่นหลักพันให้เองระหว่างพิมพ์ (15000 → 15,000)
//
// เก็บลูกน้ำไว้แค่บนหน้าจอ ค่าที่ส่งกลับให้ฟอร์มเป็นเลขล้วนเสมอ:
//   onValueChange(ตัวเลข, สตริงไร้ลูกน้ำ) — ฟอร์มที่เก็บ state เป็นตัวเลขใช้ตัวแรก
//   ฟอร์มที่เก็บเป็นสตริง (Number(x) ต้องใช้ได้ตรง ๆ) ใช้ตัวหลัง
//
// จุดที่ต้องระวังคือเคอร์เซอร์: การเติม/ย้ายลูกน้ำทำให้ตำแหน่งตัวอักษรขยับ
// เลยนับว่าก่อนเคอร์เซอร์มี "ตัวเลขจริง" กี่ตัว แล้ววางเคอร์เซอร์หลัง
// ตัวเลขตัวเดิมในข้อความที่จัดรูปแล้ว — พิมพ์กลางตัวเลขได้ไม่โดนดูดไปท้ายช่อง

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'

/** เก็บเฉพาะตัวเลขกับจุดทศนิยมจุดแรก — "1,234.5.6" → "1234.5 6→ตัดทิ้ง" */
const bare = (s: string) => {
  const stripped = s.replace(/[^\d.]/g, '')
  const dot = stripped.indexOf('.')
  return dot === -1
    ? stripped
    : stripped.slice(0, dot + 1) + stripped.slice(dot + 1).replace(/\./g, '')
}

const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** จัดรูประหว่างพิมพ์ — คงจุดท้ายไว้ ("1,500." ) ให้พิมพ์ทศนิยมต่อได้ */
function format(raw: string, decimals: number): string {
  const s = bare(raw)
  if (!s) return ''
  const dot = s.indexOf('.')
  if (dot === -1) return group(s.replace(/^0+(?=\d)/, ''))
  const int = (s.slice(0, dot) || '0').replace(/^0+(?=\d)/, '')
  return `${group(int)}.${s.slice(dot + 1, dot + 1 + decimals)}`
}

export interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** ตัวเลข หรือสตริงตัวเลข — '' / null = ช่องว่าง */
  value: number | string | null | undefined
  /** ยิงทุกครั้งที่พิมพ์ — (ตัวเลข [ว่าง = 0], สตริงเลขไร้ลูกน้ำ ['' = ว่าง]) */
  onValueChange: (value: number, text: string) => void
  /** ทศนิยมสูงสุดที่ให้พิมพ์ (ปริยาย 2) */
  decimals?: number
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput({ value, onValueChange, decimals = 2, onBlur, ...rest }, forwardedRef) {
    const propText = value == null ? '' : String(value)
    const [text, setText] = useState(() => format(propText, decimals))
    const innerRef = useRef<HTMLInputElement | null>(null)
    const caretRef = useRef<number | null>(null)

    const setRef = (el: HTMLInputElement | null) => {
      innerRef.current = el
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) forwardedRef.current = el
    }

    // ค่าจากฟอร์มแม่เปลี่ยนเอง (ดึงค่าคอมเดือนก่อน ฯลฯ) → จัดรูปทับ
    // แต่ถ้าเลขเท่ากับที่พิมพ์ค้างอยู่ ("1,500." กับ 1500) ปล่อยให้พิมพ์ต่อ
    useEffect(() => {
      if (Number(bare(text) || 0) !== Number(bare(propText) || 0)) {
        setText(format(propText, decimals))
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propText])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target
      const caret = el.selectionStart ?? el.value.length
      const sig = bare(el.value.slice(0, caret)).length
      const next = format(el.value, decimals)

      let pos = 0
      for (let seen = 0; pos < next.length && seen < sig; pos++) {
        if (next[pos] !== ',') seen++
      }
      caretRef.current = pos
      setText(next)

      const raw = bare(next)
      onValueChange(raw ? Number(raw) : 0, raw)
    }

    useLayoutEffect(() => {
      const el = innerRef.current
      if (caretRef.current != null && el && document.activeElement === el) {
        el.setSelectionRange(caretRef.current, caretRef.current)
      }
      caretRef.current = null
    }, [text])

    return (
      <input
        {...rest}
        ref={setRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={handleChange}
        onBlur={(e) => {
          // จุดค้างท้าย ("1,500.") เก็บกวาดตอนออกจากช่อง
          if (text.endsWith('.')) setText(text.slice(0, -1))
          onBlur?.(e)
        }}
      />
    )
  }
)

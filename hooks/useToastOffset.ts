// hooks/useToastOffset.ts
//
// ของที่ลอยมุมขวาล่าง (คิวเช็คอันดับ · คิวถาม AI) จองความสูงไว้ใน --toast-offset
// toast (components/aoo/toast.tsx) จะต่อ stack ขึ้นไปข้างบน ไม่ทับกัน · หายไป = คืนที่

import { useCallback, useRef } from 'react'

/** ใส่เป็น ref ของ element ที่ลอยอยู่ */
export function useToastOffset() {
  const observer = useRef<ResizeObserver | null>(null)
  return useCallback((el: HTMLElement | null) => {
    const root = document.documentElement
    observer.current?.disconnect()
    observer.current = null
    if (!el) {
      root.style.removeProperty('--toast-offset')
      return
    }
    const set = () => root.style.setProperty('--toast-offset', `${el.offsetHeight + 12}px`)
    observer.current = new ResizeObserver(set)
    observer.current.observe(el)
    set()
  }, [])
}

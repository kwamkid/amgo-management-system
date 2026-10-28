'use client'

// ปุ่มเลือกไฟล์ — Button ตัวกลาง + input ซ่อน · เดิมแต่ละหน้าเขียน <label><span class=…><input hidden> เอง
//
// <FilePickButton accept="image/*" onPick={(f) => upload(f)}>เปลี่ยนรูป</FilePickButton>

import { useRef } from 'react'
import { Button, type ButtonProps } from './button'

export interface FilePickButtonProps extends Omit<ButtonProps, 'onClick' | 'type'> {
  accept?: string
  /** กล้องหลังของมือถือ (ทางสำรองเมื่อเบราว์เซอร์ไม่ให้เปิดกล้อง) */
  capture?: 'environment' | 'user'
  onPick: (file: File) => void
}

export function FilePickButton({ accept = 'image/*', capture, onPick, variant = 'secondary', ...rest }: FilePickButtonProps) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button type="button" variant={variant} {...rest} onClick={() => ref.current?.click()} />
      <input
        ref={ref}
        type="file"
        accept={accept}
        capture={capture}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = '' // เลือกไฟล์เดิมซ้ำได้
        }}
      />
    </>
  )
}

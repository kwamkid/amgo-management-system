'use client'

// ช่องข้อความแบบมีรูปแบบนิดหน่อย — ตัวหนา · ขีดเส้นใต้ · ตัวเอียง · bullet · ลำดับเลข
// เก็บเป็น HTML ที่ผ่าน sanitizeRichText (lib/utils/richText.ts) แล้วเสมอ
// ทั้งตัวแก้ไขและตัวแสดงผลใช้ class .aoo-rich ชุดเดียวกัน หน้าตาตอนพิมพ์ = ตอนอ่าน
//
// <RichTextEditor value={html} onChange={setHtml} placeholder="..." />
// <RichText html={html} />                     ← โหมดอ่านอย่างเดียว
//
// ใช้ execCommand ของเบราว์เซอร์ — เลิกแนะนำแล้วแต่ทุกเบราว์เซอร์ยังรองรับ และพอสำหรับ 5 ปุ่มนี้
// (ไม่คุ้มลาก editor ทั้งตัวเข้ามา) · วางข้อความจากที่อื่นเข้าเป็นตัวหนังสือล้วน กันขยะจากเว็บ/Word

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react'
import { sanitizeRichText } from '@/lib/utils/richText'

type Cmd = 'bold' | 'underline' | 'italic' | 'insertUnorderedList' | 'insertOrderedList'

const TOOLS: { cmd: Cmd; icon: ComponentType<{ size?: number }>; label: string }[] = [
  { cmd: 'bold', icon: Bold, label: 'ตัวหนา (⌘B)' },
  { cmd: 'underline', icon: Underline, label: 'ขีดเส้นใต้ (⌘U)' },
  { cmd: 'italic', icon: Italic, label: 'ตัวเอียง (⌘I)' },
  { cmd: 'insertUnorderedList', icon: List, label: 'รายการแบบจุด' },
  { cmd: 'insertOrderedList', icon: ListOrdered, label: 'รายการแบบเลข' },
]

export interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** ความสูงขั้นต่ำของช่องพิมพ์ (px) — ค่าเริ่มต้น 96 */
  minHeight?: number
  disabled?: boolean
  autoFocus?: boolean
  'aria-label'?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 96,
  disabled,
  autoFocus,
  'aria-label': ariaLabel,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Set<Cmd>>(new Set())

  // ใส่ค่าเข้า DOM เฉพาะตอนต่างจากที่พิมพ์อยู่ — ไม่งั้นเคอร์เซอร์เด้งไปต้นช่องทุกตัวอักษร
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const next = sanitizeRichText(value)
    if (sanitizeRichText(el.innerHTML) !== next) el.innerHTML = next
  }, [value])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  // ปุ่มที่กดอยู่ (เคอร์เซอร์อยู่ในตัวหนา ฯลฯ)
  useEffect(() => {
    const onSel = () => {
      const el = ref.current
      if (!el || !el.contains(document.getSelection()?.anchorNode ?? null)) return
      setActive(new Set(TOOLS.map((t) => t.cmd).filter((c) => document.queryCommandState(c))))
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const emit = () => onChange(sanitizeRichText(ref.current?.innerHTML ?? ''))

  const run = (cmd: Cmd) => {
    ref.current?.focus()
    document.execCommand(cmd)
    emit()
  }

  return (
    <div className="aoo-rich-editor" data-disabled={disabled || undefined}>
      <div className="aoo-rich-editor__toolbar" role="toolbar" aria-label="รูปแบบข้อความ">
        {TOOLS.map(({ cmd, icon: Icon, label }) => (
          <button
            key={cmd}
            type="button"
            className="aoo-rich-editor__tool"
            title={label}
            aria-label={label}
            aria-pressed={active.has(cmd)}
            disabled={disabled}
            // mousedown ไม่ให้ช่องพิมพ์เสีย focus — selection ยังอยู่ตอนกด
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(cmd)}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="aoo-rich aoo-rich-editor__body"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label={ariaLabel ?? placeholder}
        data-placeholder={placeholder}
        // ความสูงขั้นต่ำต่างกันในแต่ละที่ใช้ — ผ่าน CSS variable ไม่ใช่ style ตรง ๆ
        style={{ ['--rich-min-h' as string]: `${minHeight}px` }}
        onInput={emit}
        onPaste={(e) => {
          e.preventDefault()
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
        }}
      />
    </div>
  )
}

/** แสดงผลอย่างเดียว — sanitize ก่อนทุกครั้ง */
export function RichText({ html, className }: { html: string | null | undefined; className?: string }) {
  const clean = sanitizeRichText(html)
  if (!clean) return null
  return <div className={className ? `aoo-rich ${className}` : 'aoo-rich'} dangerouslySetInnerHTML={{ __html: clean }} />
}

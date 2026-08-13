'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Z } from './z-layers'

/**
 * Dropdown ของเราเอง — ไม่ใช่ <select> ของ OS
 *
 * ตัว Select ที่พอร์ตมาจาก aoosocial แต่งได้แค่ "กล่อง" ส่วนแผงที่กางออกมา
 * ยังเป็นของระบบปฏิบัติการ (แต่งไม่ได้เลย และหน้าตาไม่เข้ากับที่เหลือ)
 * ตัวนี้เรนเดอร์แผงเองผ่าน portal จึงคุมหน้าตาได้ครบ และไม่โดนตารางที่มี
 * overflow ตัดหัวตัดหาง
 *
 * รองรับคีย์บอร์ดครบ: ↑↓ เลื่อน · Enter เลือก · Esc ปิด · พิมพ์เพื่อค้นหา
 */

export type SelectOption = {
  value: string
  label: string
  /** ข้อความจาง ๆ ต่อท้าย เช่น ชื่อบริษัท */
  hint?: string
  /** จุดสีนำหน้า ใช้กับสถานะ */
  dot?: string
  disabled?: boolean
}

export interface SelectMenuProps {
  value: string | null
  options: SelectOption[]
  onChange: (value: string | null) => void
  /** ข้อความตอนยังไม่ได้เลือก */
  placeholder?: string
  /** ให้เลือก "ไม่ระบุ" ได้ไหม — ถ้าใส่ จะมีแถวแรกเป็นการล้างค่า */
  clearable?: string | false
  /** โชว์ช่องค้นหาเมื่อตัวเลือกเยอะกว่านี้ (ค่าเริ่มต้น 8) */
  searchThreshold?: number
  disabled?: boolean
  /** compact = สูง 32px สำหรับใช้ในตาราง */
  size?: 'sm' | 'md'
  /**
   * boxed = มีกรอบเห็นชัดเหมือนช่องกรอก (ค่าเริ่มต้น — ใช้ในฟอร์ม)
   * flat  = โปร่งจนกว่าจะชี้/กด (ใช้ในตารางที่มีหลายสิบช่อง จะได้ไม่ลายตา)
   */
  variant?: 'boxed' | 'flat'
  /** เน้นกรอบแดงเมื่อยังไม่ได้เลือกแต่จำเป็นต้องเลือก */
  invalid?: boolean
  className?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
  onFocus?: () => void
  triggerRef?: (el: HTMLElement | null) => void
}

const H = { sm: 32, md: 40 }

export function SelectMenu({
  value,
  options,
  onChange,
  placeholder = 'เลือก',
  clearable = false,
  searchThreshold = 8,
  disabled,
  size = 'sm',
  variant = 'boxed',
  invalid,
  className,
  onKeyDown,
  onFocus,
  triggerRef,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const btnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const selected = options.find((o) => o.value === value) ?? null
  const showSearch = options.length > searchThreshold

  const rows: (SelectOption | { value: null; label: string })[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? options.filter(
          (o) => o.label.toLowerCase().includes(q) || (o.hint?.toLowerCase().includes(q) ?? false)
        )
      : options
    return clearable ? [{ value: null, label: clearable }, ...filtered] : filtered
  }, [options, query, clearable])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setPos(null)
  }, [])

  /* ---- วางตำแหน่งแผง ------------------------------------------- */
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const b = btnRef.current
      if (!b) return
      const r = b.getBoundingClientRect()
      const panelH = panelRef.current?.offsetHeight ?? 280
      const pad = 8
      // ที่ว่างข้างล่างไม่พอ → พลิกขึ้นบน
      const below = window.innerHeight - r.bottom
      const top = below < panelH + pad && r.top > below ? r.top - panelH - 4 : r.bottom + 4
      const width = Math.max(r.width, 200)
      const left = Math.min(Math.max(pad, r.left), window.innerWidth - width - pad)
      setPos({ top, left, width })
    }
    place()
    // รอบแรกแผงยังไม่เรนเดอร์ (panelRef null) เลยใช้ค่าเดา 280 — ถ้าพลิกขึ้นบน
    // เมนูสั้น ๆ จะลอยสูงเกินจริง → พอแผงโผล่แล้ววัดความสูงจริงและวางซ้ำหนึ่งรอบ
    const raf = requestAnimationFrame(place)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, rows.length])

  /* ---- ปิดเมื่อคลิกข้างนอก / กด Esc ---------------------------- */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        btnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, close])

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus()
  }, [open, showSearch])

  // เปิดมาให้เคอร์เซอร์อยู่ที่ตัวที่เลือกไว้ ไม่ใช่บนสุดเสมอ
  useEffect(() => {
    if (!open) return
    const i = rows.findIndex((r) => r.value === value)
    setCursor(i >= 0 ? i : 0)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (v: string | null) => {
    onChange(v)
    close()
    btnRef.current?.focus()
  }

  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(rows.length - 1, c + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(0, c - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[cursor]
      if (row && !('disabled' in row && row.disabled)) pick(row.value)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setCursor(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setCursor(rows.length - 1)
    }
  }

  return (
    <>
      <button
        type="button"
        ref={(el) => {
          btnRef.current = el
          triggerRef?.(el)
        }}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setOpen(true)
            return
          }
          onKeyDown?.(e)
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          height: H[size],
          padding: '0 8px 0 10px',
          borderRadius: 'var(--r-md)',
          // boxed เห็นกรอบตลอด · flat โปร่งจนกว่าจะชี้หรือกด
          border: `1px solid ${
            invalid
              ? 'var(--ruby-300)'
              : open
                ? 'var(--accent)'
                : variant === 'boxed'
                  ? 'var(--border-2)'
                  : hover
                    ? 'var(--border-2)'
                    : 'transparent'
          }`,
          background: invalid
            ? 'var(--ruby-50)'
            : open || variant === 'boxed'
              ? 'var(--bg-surface)'
              : hover
                ? 'var(--bg-surface)'
                : 'transparent',
          boxShadow: open ? 'var(--shadow-focus)' : 'none',
          transition: 'border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          color: selected ? 'var(--fg-1)' : 'var(--fg-4)',
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          outline: 'none',
        }}
      >
        {selected?.dot && <Dot color={selected.dot} />}
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            onKeyDown={onPanelKey}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              minWidth: pos.width,
              maxWidth: 340,
              maxHeight: 320,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 4,
              zIndex: Z.dropdownInModal,
              animation: 'aooFadeInUp var(--dur-med) var(--ease-out)',
            }}
          >
            {showSearch && (
              <div style={{ position: 'relative', padding: '2px 2px 6px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: 11,
                    color: 'var(--fg-4)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setCursor(0)
                  }}
                  placeholder="ค้นหา"
                  style={{
                    width: '100%',
                    height: 32,
                    padding: '0 8px 0 30px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border-2)',
                    background: 'var(--bg-sunken)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    color: 'var(--fg-1)',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            <div style={{ overflowY: 'auto', minHeight: 0 }}>
              {rows.length === 0 && (
                <p
                  style={{
                    padding: '10px 12px',
                    fontSize: 13,
                    color: 'var(--fg-3)',
                    margin: 0,
                  }}
                >
                  ไม่พบตัวเลือก
                </p>
              )}

              {rows.map((row, i) => {
                const isSel = row.value === value
                const isCur = i === cursor
                const opt = row as SelectOption
                return (
                  <button
                    key={row.value ?? '__clear__'}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    disabled={'disabled' in row ? row.disabled : false}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => pick(row.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '7px 10px',
                      border: 'none',
                      borderRadius: 'var(--r-sm)',
                      background: isCur ? 'var(--warm-150)' : 'transparent',
                      color: row.value === null ? 'var(--fg-3)' : 'var(--fg-1)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      fontWeight: isSel ? 600 : 400,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.dot && <Dot color={opt.dot} />}
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.label}
                      {opt.hint && (
                        <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}> · {opt.hint}</span>
                      )}
                    </span>
                    {isSel && <Check size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

function Dot({ color }: { color: string }): ReactNode {
  return (
    <span
      aria-hidden
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  )
}

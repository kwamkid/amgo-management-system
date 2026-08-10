'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Clock } from 'lucide-react'
import { Z } from './z-layers'

/**
 * เลือกเวลา / ช่วงเวลา
 *
 * aoosocial ไม่มีตัวนี้ (เป็นแอปตั้งเวลาโพสต์ ใช้ date-time รวมกัน)
 * แต่ระบบ HR ใช้ "เวลาล้วน" เยอะมาก — กะทำงาน เวลาเปิด-ปิดสาขา เวลาพัก
 *
 * ทำไมไม่ใช้ <input type="time">:
 *   · หน้าตาต่างกันทุกเบราว์เซอร์ คุมไม่ได้เลย
 *   · บนมือถือเด้ง native picker ที่กดยากเวลาจะเลือกเป็นช่วง ๆ 30 นาที
 *   · ตั้งค่าเป็นช่วงครึ่งชั่วโมงซึ่งเป็นกรณีจริง 95% ไม่ได้
 *
 * เก็บค่าเป็น "HH:mm" ตรงกับที่ Postgres เก็บใน shifts.start_time
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** สร้างรายการเวลาทุก ๆ N นาที */
function buildOptions(stepMinutes: number, min?: string, max?: string): string[] {
  const out: string[] = []
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const v = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
    if (min && v < min) continue
    if (max && v > max) continue
    out.push(v)
  }
  return out
}

/** "09:30" → "9:30 น." อ่านง่ายกว่าเวลาโชว์ */
export function formatTime(v?: string | null): string {
  if (!v) return ''
  const [h, m] = v.split(':')
  return `${Number(h)}:${m} น.`
}

/** ชั่วโมงระหว่างสองเวลา — เผื่อกะข้ามคืน (22:00 → 06:00 = 8 ชม.) */
export function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60 // ข้ามเที่ยงคืน
  return Math.round((mins / 60) * 100) / 100
}

export interface TimePickerProps {
  value: string | null
  onChange: (v: string) => void
  /** ช่วงห่างของตัวเลือก (นาที) — ค่าเริ่มต้น 30 */
  step?: number
  /** จำกัดไม่ให้เลือกก่อนเวลานี้ ใช้กับเวลาสิ้นสุด */
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  invalid?: boolean
  className?: string
}

const H = { sm: 32, md: 40 }

export function TimePicker({
  value,
  onChange,
  step = 30,
  min,
  max,
  placeholder = 'เลือกเวลา',
  disabled,
  size = 'md',
  invalid,
  className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  const options = useMemo(() => {
    const list = buildOptions(step, min, max)
    // ค่าที่ตั้งไว้อาจไม่ตรงกับ step (เช่นข้อมูลเก่า 09:15 แต่ step=30)
    // ต้องแทรกเข้าไปด้วย ไม่งั้นจะดูเหมือนไม่ได้เลือกอะไรไว้
    if (value && !list.includes(value)) {
      list.push(value)
      list.sort()
    }
    return list
  }, [step, min, max, value])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const b = btnRef.current
      if (!b) return
      const r = b.getBoundingClientRect()
      const panelH = 260
      const below = window.innerHeight - r.bottom
      const top = below < panelH + 8 && r.top > below ? r.top - panelH - 4 : r.bottom + 4
      setPos({ top, left: r.left, width: Math.max(r.width, 128) })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // เปิดมาให้เลื่อนไปที่เวลาที่เลือกไว้ ไม่ใช่เริ่มที่ 00:00 เสมอ
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: 'center' })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          height: H[size],
          padding: '0 10px',
          borderRadius: 'var(--r-md)',
          border: `1px solid ${
            invalid ? 'var(--ruby-300)' : open ? 'var(--accent)' : 'var(--border-2)'
          }`,
          background: invalid ? 'var(--ruby-50)' : 'var(--bg-surface)',
          boxShadow: open ? 'var(--shadow-focus)' : 'none',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          color: value ? 'var(--fg-1)' : 'var(--fg-4)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          outline: 'none',
        }}
      >
        <Clock size={15} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
          {value ? formatTime(value) : placeholder}
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: 260,
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 4,
              zIndex: Z.dropdownInModal,
            }}
          >
            {options.map((opt) => {
              const selected = opt === value
              return (
                <button
                  key={opt}
                  type="button"
                  ref={selected ? activeRef : undefined}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '7px 10px',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    background: selected ? 'var(--brand-coral-50)' : 'transparent',
                    color: selected ? 'var(--brand-coral-700)' : 'var(--fg-1)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: selected ? 600 : 400,
                    fontVariantNumeric: 'tabular-nums',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) e.currentTarget.style.background = 'var(--warm-150)'
                  }}
                  onMouseLeave={(e) => {
                    if (!selected) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {formatTime(opt)}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}

/* ------------------------------------------------------------------ */

export interface TimeRangePickerProps {
  start: string | null
  end: string | null
  onChange: (range: { start: string | null; end: string | null }) => void
  step?: number
  disabled?: boolean
  size?: 'sm' | 'md'
  /** ให้เลือกเวลาสิ้นสุดก่อนเวลาเริ่มได้ (กะข้ามคืน เช่น 22:00 → 06:00) */
  allowOvernight?: boolean
  /** โชว์จำนวนชั่วโมงต่อท้าย */
  showDuration?: boolean
}

export function TimeRangePicker({
  start,
  end,
  onChange,
  step = 30,
  disabled,
  size = 'md',
  allowOvernight = true,
  showDuration = true,
}: TimeRangePickerProps) {
  const overnight = !!start && !!end && end <= start
  const duration = start && end ? hoursBetween(start, end) : null

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <TimePicker
          value={start}
          onChange={(v) => onChange({ start: v, end })}
          step={step}
          disabled={disabled}
          size={size}
          placeholder="เวลาเริ่ม"
        />
      </div>

      <ArrowRight size={15} className="shrink-0 text-gray-400" />

      <div className="min-w-0 flex-1">
        <TimePicker
          value={end}
          onChange={(v) => onChange({ start, end: v })}
          step={step}
          disabled={disabled}
          size={size}
          placeholder="เวลาเลิก"
          // กะข้ามคืนต้องเลือกเวลาที่น้อยกว่าเวลาเริ่มได้ จึงไม่จำกัด min
          min={allowOvernight ? undefined : (start ?? undefined)}
          invalid={!allowOvernight && overnight}
        />
      </div>

      {showDuration && duration !== null && (
        <span className="shrink-0 whitespace-nowrap text-sm text-gray-500">
          <span className="font-mono tabular-nums">{duration}</span> ชม.
          {overnight && allowOvernight && (
            <span className="ml-1 text-xs text-gray-400">(ข้ามคืน)</span>
          )}
        </span>
      )}
    </div>
  )
}

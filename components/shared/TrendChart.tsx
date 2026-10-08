'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ChartNoAxesColumn, Spline } from 'lucide-react'
import type { StatTone } from './StatCard'

/**
 * กราฟแนวโน้มรายวัน — แท่ง = ค่าแต่ละวัน · เส้น = ค่าเฉลี่ย 7 วัน
 *
 * ทำไมมีเส้นเฉลี่ย: ตัวเลขรายวันแกว่งตามวันในสัปดาห์ (เสาร์-อาทิตย์ตก) จนดูไม่ออกว่า
 * "ดีขึ้นจริงไหม" เส้นเฉลี่ย 7 วันตัดการแกว่งนั้นทิ้ง เหลือทิศทางจริง
 *
 * invert = ค่ายิ่งน้อยยิ่งดี (อันดับเฉลี่ย) — กลับแกนให้ "ขึ้น" = ดีขึ้นเสมอ
 * และใช้เส้นแทนแท่ง (แท่งของอันดับไม่มีความหมาย)
 *
 * compare = ช่วงเทียบ (ช่วงก่อน / ปีก่อน) วันต่อวันเท่าความยาว points — วาดเป็นแท่งคู่ (ช่วงเทียบสีเทาซ้าย
 *   ช่วงนี้สีของเรื่องขวา) · เส้นเฉลี่ยเหลือเส้นเดียวของช่วงนี้ (เจ้าของ 8 ต.ค. 69: เส้นซ้อนกันดูไม่ออก ขอแท่งแยกสี)
 *
 * <TrendChart points={[{ date: '2026-10-01', value: 12 }]} tone="sky" format={(v) => v.toFixed(0)} />
 * สีอยู่ที่ .aoo-trend + [data-tone] ใน globals.css
 */

export type TrendPoint = { date: string; value: number | null }

const H = 100

function movingAvg(values: (number | null)[], win = 7) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - win + 1), i + 1).filter((v): v is number => v != null)
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null
  })
}

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function linePath(values: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let d = ''
  values.forEach((v, i) => {
    if (v == null) return
    d += `${d && values[i - 1] != null ? 'L' : 'M'}${x(i)},${y(v)}`
  })
  return d
}

export function TrendChart({
  points,
  tone = 'sky',
  invert = false,
  format = (v) => v.toLocaleString('th-TH'),
  label,
  compare,
  bucket = 'day',
  periodLabel,
}: {
  points: TrendPoint[]
  /** ค่าช่วงเทียบ เรียงตรงกับ points ทีละวัน + ชื่อ เช่น "ปีก่อน" */
  compare?: { values: (number | null)[]; label: string; dates?: string[]; legend?: string }
  /** ช่วงวันที่ของกราฟ เช่น "9 ก.ย. 69–6 ต.ค. 69" — ใช้ในคำอธิบายสี */
  periodLabel?: string
  /** แต่ละจุดคือ 1 วัน หรือ 1 สัปดาห์ (date = วันแรกของสัปดาห์) — สัปดาห์ไม่ต้องมีเส้นเฉลี่ย 7 วัน */
  bucket?: 'day' | 'week'
  tone?: StatTone
  invert?: boolean
  format?: (v: number) => string
  /** ชื่อค่าที่แสดงในคำอธิบายกราฟ เช่น "คลิก" */
  label?: ReactNode
}) {
  const [hover, setHover] = useState<number | null>(null)
  const n = points.length

  const { avg, cmpAvg, max, min } = useMemo(() => {
    const cmp = compare?.values ?? []
    const vals = [...points.map((p) => p.value), ...cmp].filter((v): v is number => v != null)
    return {
      avg: movingAvg(points.map((p) => p.value)),
      cmpAvg: compare ? movingAvg(cmp) : null,
      max: vals.length ? Math.max(...vals) : 0,
      min: vals.length ? Math.min(...vals) : 0,
    }
  }, [points, compare])

  if (!n) return null

  const W = n * 10
  const x = (i: number) => i * 10 + 5
  // อันดับ: บนสุด = อันดับดีสุดในช่วง (ค่าน้อยสุด) · ค่าอื่น: 0 อยู่ล่าง
  const lo = invert ? min : 0
  const span = max - lo || 1
  const y = (v: number) => (invert ? 6 + ((v - lo) / span) * (H - 12) : H - (v / (max || 1)) * (H - 6))

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * n)
    setHover(Math.min(n - 1, Math.max(0, i)))
  }

  const hp = hover != null ? points[hover] : null
  const showAvg = bucket === 'day'
  const when = (d: string) => (bucket === 'week' ? `สัปดาห์ ${fmtDay(d)}` : fmtDay(d))

  return (
    <div className="aoo-trend" data-tone={tone}>
      <div className="aoo-trend__plot" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          {invert ? (
            <>
              {cmpAvg && <path className="aoo-trend__cmp" fill="none" d={linePath(cmpAvg, x, y)} />}
              <path className="aoo-trend__raw" fill="none" d={linePath(points.map((p) => p.value), x, y)} />
            </>
          ) : compare ? (
            points.map((p, i) => {
              const c = compare.values[i]
              return (
                <g key={p.date} data-hover={hover === i || undefined}>
                  {c != null && (
                    <rect className="aoo-trend__bar aoo-trend__bar--cmp" x={i * 10 + 1} width={4} y={y(c)} height={H - y(c)} />
                  )}
                  {p.value != null && (
                    <rect className="aoo-trend__bar aoo-trend__bar--cur" x={i * 10 + 5} width={4} y={y(p.value)} height={H - y(p.value)} />
                  )}
                </g>
              )
            })
          ) : (
            points.map((p, i) =>
              p.value == null ? null : (
                <rect
                  key={p.date}
                  className="aoo-trend__bar"
                  data-hover={hover === i || undefined}
                  x={i * 10 + 1}
                  width={8}
                  y={y(p.value)}
                  height={H - y(p.value)}
                />
              )
            )
          )}
          {showAvg && <path className="aoo-trend__line" fill="none" d={linePath(avg, x, y)} />}
          {hover != null && <line className="aoo-trend__guide" x1={x(hover)} x2={x(hover)} y1={0} y2={H} />}
        </svg>
        <span className="aoo-trend__ymax">{invert ? `อันดับ ${format(min)}` : format(max)}</span>
        {hp && (
          // ตำแหน่งตามเมาส์ — ค่าคำนวณสด จึงต้องเป็น inline style
          <div className="aoo-trend__tip" style={{ left: `${((hover! + 0.5) / n) * 100}%` }}>
            {when(hp.date)} · {hp.value == null ? 'ไม่มีข้อมูล' : format(hp.value)}
            {showAvg && avg[hover!] != null && <> · เฉลี่ย 7 วัน {format(avg[hover!]!)}</>}
            {compare && compare.values[hover!] != null && (
              <>
                {' '}
                · {compare.label}
                {compare.dates?.[hover!] ? ` (${when(compare.dates[hover!])})` : ''} {format(compare.values[hover!]!)}
              </>
            )}
          </div>
        )}
      </div>
      <div className="aoo-trend__axis">
        <span>{fmtDay(points[0].date)}</span>
        {n > 2 && <span>{fmtDay(points[Math.floor(n / 2)].date)}</span>}
        <span>{fmtDay(points[n - 1].date)}</span>
      </div>
      {/* คำอธิบายสี — ไอคอนแท่ง/เส้นแทนคำ · แท่งสองช่วงวางคู่กัน · บอกช่วงวันที่จริง (เจ้าของ 8 ต.ค. 69) */}
      <div className="aoo-trend__legend">
        {invert ? (
          <span>
            <Spline size={16} className="aoo-trend__icon" data-kind="raw" />
            {periodLabel ?? label}
          </span>
        ) : (
          <span>
            <ChartNoAxesColumn size={16} className="aoo-trend__icon" data-kind="cur" />
            {periodLabel ?? label}
          </span>
        )}
        {compare && (
          <span>
            {invert ? (
              <Spline size={16} className="aoo-trend__icon" data-kind="cmp" />
            ) : (
              <ChartNoAxesColumn size={16} className="aoo-trend__icon" data-kind="cmp" />
            )}
            {compare.label}
            {compare.legend ? ` ${compare.legend}` : ''}
          </span>
        )}
        {showAvg && (
          <span>
            <Spline size={16} className="aoo-trend__icon" />
            เฉลี่ย 7 วัน
          </span>
        )}
      </div>
    </div>
  )
}

/** เส้นเล็กในการ์ด — ไม่มีแกน ไม่มี tooltip แค่ให้เห็นทิศทาง */
export function Sparkline({
  values,
  tone = 'sky',
  invert = false,
}: {
  values: number[]
  tone?: StatTone
  invert?: boolean
}) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => {
      const t = (v - min) / span
      return `${(i / (values.length - 1)) * 100},${invert ? 2 + t * 32 : 34 - t * 32}`
    })
    .join(' ')
  return (
    <svg className="aoo-spark" data-tone={tone} viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} />
    </svg>
  )
}

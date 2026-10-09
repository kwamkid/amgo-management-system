'use client'

// แผงคิวลอยทั้งแอป — วางครั้งเดียวที่ layout หลังบ้าน ตามไปทุกหน้าจนกว่าจะกดปิด
// (เจ้าของ 9 ต.ค. 69: เดิมแผงอยู่ในแต่ละหน้า เปลี่ยนหน้าแล้วหาย)
//
// หน้าไหนสั่งงานคิว → trackQueue(...) (lib/queue/tracker) → แผงนี้โผล่ แล้วถามความคืบหน้าเอง
// · หลายคิวพร้อมกันได้ แถวละคิว · ✕ ท้ายแถว = เลิกติดตามคิวนั้น (งานยังเดินต่อฝั่งเซิร์ฟเวอร์)
// · ปุ่มย่อ = เหลือปุ่มกลมมุมขวาล่าง มีตัวเลขคิวที่ยังทำอยู่ · กดกางกลับ
// · ถามสถานะทุก 8 วิ เฉพาะคิวที่ยังไม่จบ · ซ่อนแท็บ = หยุดถาม
// สไตล์ .aoo-queue* ใน globals.css · จองที่ใน --toast-offset ให้ toast ต่อขึ้นไปข้างบน

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ListChecks, Loader2, X } from 'lucide-react'
import { Progress } from '@/components/aoo'
import { useToastOffset } from '@/hooks/useToastOffset'
import { listTracked, onTrackedChange, untrackQueue, type TrackedQueue } from '@/lib/queue/tracker'
import { getTrackedStatus, type TrackedStatus } from '@/lib/services/queueService'

const POLL_MS = 8_000

export function GlobalQueue() {
  const [list, setList] = useState<TrackedQueue[]>([])
  const [status, setStatus] = useState<Record<string, TrackedStatus>>({})
  const [open, setOpen] = useState(true)
  const floatRef = useToastOffset()

  // อ่านรายการหลัง mount (ฝั่งเซิร์ฟเวอร์ไม่มี localStorage) + ฟังการเปลี่ยนแปลง
  useEffect(() => {
    const sync = () => {
      setList(listTracked())
      setOpen(true) // สั่งงานใหม่ = กางแผง
    }
    setList(listTracked())
    return onTrackedChange(sync)
  }, [])

  const activeIds = list.filter((q) => status[q.id]?.active !== false).map((q) => q.id).join(',')

  useEffect(() => {
    if (!list.length) return
    let stop = false
    const tick = async () => {
      if (document.hidden) return
      const todo = list.filter((q) => status[q.id]?.active !== false)
      const results = await Promise.all(
        todo.map((q) =>
          getTrackedStatus(q)
            .then((s) => [q.id, s] as const)
            .catch(() => null)
        )
      )
      if (stop) return
      setStatus((prev) => {
        const next = { ...prev }
        for (const r of results) if (r) next[r[0]] = r[1]
        return next
      })
    }
    tick()
    const t = setInterval(tick, POLL_MS)
    return () => {
      stop = true
      clearInterval(t)
    }
    // ถามใหม่เมื่อรายการหรือชุดที่ยังไม่จบเปลี่ยน
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, activeIds])

  if (!list.length) return null
  const running = list.filter((q) => status[q.id]?.active !== false).length

  if (!open) {
    return (
      <button ref={floatRef} type="button" className="aoo-queue-fab" onClick={() => setOpen(true)} aria-label="เปิดคิวงาน">
        {running ? <Loader2 size={22} className="animate-spin" /> : <ListChecks size={22} />}
        {running > 0 && <span className="aoo-queue-fab__badge">{running}</span>}
      </button>
    )
  }

  return (
    <div ref={floatRef} className="aoo-queue" role="status">
      <div className="aoo-queue__head">
        {running ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        <span>{running ? `คิวงาน — กำลังทำ ${running}` : 'คิวงาน — เสร็จหมดแล้ว'}</span>
        <button type="button" className="aoo-queue__close" onClick={() => setOpen(false)} aria-label="ย่อแผงคิว">
          <ChevronDown size={16} />
        </button>
      </div>
      <ul className="mt-2 space-y-3">
        {list.map((q) => {
          const s = status[q.id]
          const active = s?.active !== false
          const title = q.href ? (
            <Link href={q.href} className="underline-offset-2 hover:underline">
              {q.title}
            </Link>
          ) : (
            q.title
          )
          return (
            <li key={q.id}>
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                {active ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <CheckCircle2 size={14} className="shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <span className="shrink-0 font-normal opacity-80">
                  {!s || s.starting ? '…' : `${s.done}/${s.total} ${q.unit}`}
                  {s?.failed ? ` · พลาด ${s.failed}` : ''}
                </span>
                <button
                  type="button"
                  className="aoo-queue__close"
                  onClick={() => untrackQueue(q.id)}
                  aria-label={`ปิด ${q.title} (งานยังเดินต่อ)`}
                >
                  <X size={14} />
                </button>
              </div>
              <Progress
                className="mt-1.5"
                value={s?.done ?? 0}
                max={s?.total || 1}
                tone={active ? 'grape' : s?.failed ? 'warning' : 'success'}
                aria-label={`ความคืบหน้า ${q.title}`}
              />
              {s?.note && <div className="aoo-queue__meta">{s.note}</div>}
            </li>
          )
        })}
      </ul>
      <div className="aoo-queue__meta mt-2">งานเดินที่เซิร์ฟเวอร์ — เปลี่ยนหน้าหรือปิดเว็บได้ ผลไม่หาย</div>
    </div>
  )
}

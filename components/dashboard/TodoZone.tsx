'use client'

// กล่อง "สิ่งที่ต้องทำ" บนหน้าแรก
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// เรื่องที่ค้างของแต่ละคนเคยไม่มีที่อยู่ — ต้องเด้งเป็นหน้าเต็มอย่างเดียว
// ซึ่งใช้ได้กับเรื่องที่ "ไม่ทำไม่ได้" เท่านั้น พอมีเรื่องที่ควรทำแต่ยังไม่ถึงกับ
// ต้องปิดทั้งระบบ ก็ไม่มีที่ให้ขึ้น
//
// กล่องนี้อ่านจากทะเบียนเดียวกับหน้าบังคับ (lib/todo/tasks.ts)
// เพิ่มเรื่องใหม่ในทะเบียนแล้วขึ้นที่นี่เอง ไม่ต้องแก้ไฟล์นี้
//
// ไม่มีอะไรค้าง = ไม่ขึ้นอะไรเลย ไม่กินที่บนหน้าแรก

import Link from 'next/link'
import { AlertTriangle, ArrowRight, CircleCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { pendingTodos } from '@/lib/todo/tasks'

export default function TodoZone() {
  const { userData, loading } = useAuth()
  if (loading || !userData) return null

  const todos = pendingTodos(userData)
  if (!todos.length) return null

  const mustDo = todos.filter((t) => t.blocking).length

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60">
      <header className="flex items-center gap-2 border-b border-amber-200 px-4 py-2.5">
        <AlertTriangle size={15} className="shrink-0 text-amber-600" />
        <h2 className="text-sm font-semibold text-amber-900">
          สิ่งที่ต้องทำ {todos.length} อย่าง
        </h2>
        {mustDo > 0 && (
          <span className="rounded-md bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-900">
            ต้องทำก่อนใช้งาน {mustDo}
          </span>
        )}
      </header>

      <ul className="divide-y divide-amber-100">
        {todos.map((t) => (
          <li key={t.id} className="flex items-start gap-3 px-4 py-3">
            <CircleCheck size={17} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{t.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{t.why}</p>
            </div>
            <Link
              href={t.href}
              className="flex shrink-0 items-center gap-1 self-center rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-800 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
            >
              {t.cta} <ArrowRight size={13} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

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

import { AlertTriangle, ArrowRight, CircleCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { pendingTodos } from '@/lib/todo/tasks'
import { ListRow, ListRows } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, Pill } from '@/components/aoo'

export default function TodoZone() {
  const { userData, loading } = useAuth()
  if (loading || !userData) return null

  const todos = pendingTodos(userData)
  if (!todos.length) return null

  const mustDo = todos.filter((t) => t.blocking).length

  return (
    <Card padding={0} className="mb-5 overflow-hidden">
      <CardHeader>
        <CardTitle icon={AlertTriangle} tone="warning">
          สิ่งที่ต้องทำ {todos.length} อย่าง
          {mustDo > 0 && <Pill tone="warning">ต้องทำก่อนใช้งาน {mustDo}</Pill>}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-2">
        <ListRows>
          {todos.map((t) => (
            <ListRow
              key={t.id}
              href={t.href}
              leading={<CircleCheck size={17} className="shrink-0 text-[var(--sun-500)]" />}
              title={t.title}
              meta={<span className="leading-relaxed">{t.why}</span>}
              trailing={
                <span className="flex items-center gap-1 text-xs font-medium text-[var(--accent)]">
                  {t.cta} <ArrowRight size={13} />
                </span>
              }
            />
          ))}
        </ListRows>
      </CardContent>
    </Card>
  )
}

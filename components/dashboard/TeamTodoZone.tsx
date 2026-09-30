'use client'

// กล่อง "ทีมที่ยังทำไม่ครบ" — เห็นเฉพาะ HR กับผู้ดูแลระบบ
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// TodoZone บอกได้แค่ว่า "ตัวเรา" เหลืออะไร แต่คนที่ต้องตามเรื่องคือ HR
// ซึ่งไม่มีทางรู้เลยว่าใครยังไม่ทำ นอกจากไล่เปิดดูทีละคน
//
// กล่องนี้ตอบคำถามเดียว: ตอนนี้ต้องไปเตือนใครบ้าง เรื่องอะไร
// มีปุ่มคัดลอกรายชื่อไปวางในไลน์กลุ่มได้เลย
//
// ── ทำไมอ่านจากฐานข้อมูลตรง ๆ ─────────────────────────────────────────
// เงื่อนไขต้องตรงกับ lib/todo/tasks.ts เป๊ะ ไม่งั้นจะเกิดอาการ "HR บอกว่า
// คนนี้ยังไม่ทำ แต่เจ้าตัวเข้าระบบได้ปกติ" — คอมเมนต์กำกับไว้ทั้งสองฝั่ง

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, UserCog } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { DiscordIcon } from '@/components/icons/DiscordIcon'
import { Alert, Button, Card, CardHeader, CardTitle, Pill } from '@/components/aoo'

type Row = {
  id: string
  full_name: string
  nickname: string | null
  name_verified: boolean
  discord_user_id: string | null
  line_display_name: string
}

/** ต้องตรงกับ TODO_TASKS ใน lib/todo/tasks.ts */
const needsName = (u: Row) => !u.name_verified || !u.nickname?.trim()
const needsDiscord = (u: Row) => !u.discord_user_id

export default function TeamTodoZone() {
  const { userData, loading } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)

  const isManager = !!userData && ['hr', 'admin'].includes(userData.role)

  useEffect(() => {
    if (!isManager) return
    let alive = true

    createClient()
      .from('users')
      .select('id, full_name, nickname, name_verified, discord_user_id, line_display_name')
      .is('deleted_at', null)
      .eq('is_system', false)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => {
        if (alive) setRows((data ?? []) as Row[])
      })

    return () => {
      alive = false
    }
  }, [isManager])

  if (loading || !isManager || !rows) return null

  const noName = rows.filter(needsName)
  const noDiscord = rows.filter(needsDiscord)
  const behind = rows.filter((u) => needsName(u) || needsDiscord(u))

  if (!behind.length) {
    return (
      <Alert tone="success" className="mb-5">
        พนักงานทุกคนกรอกชื่อและเชื่อม Discord ครบแล้ว ({rows.length} คน)
      </Alert>
    )
  }

  return (
    <Card padding={0} className="mb-5 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle icon={UserCog} tone="warning">
          ต้องตามอีก {behind.length} คน
          <span className="text-xs font-normal text-gray-500">จากทั้งหมด {rows.length} คน</span>
        </CardTitle>
      </CardHeader>

      <Group
        title="ยังไม่มีชื่อจริง / ชื่อเล่น"
        hint="ชื่อในระบบยังเป็นชื่อ LINE — รายงานอ่านแล้วไม่รู้ว่าใคร"
        icon={<UserCog size={14} className="text-[var(--sun-700)]" />}
        people={noName}
      />
      <Group
        title="ยังไม่ได้เชื่อม Discord"
        hint="ระบบ mention ไม่ถึงตัว — แจ้งวันเกิด เตือนลืมเช็คเอาท์ แจ้งผลอนุมัติลา"
        icon={<DiscordIcon size={14} className="text-[#5865F2]" />}
        people={noDiscord}
      />
    </Card>
  )
}

function Group({
  title,
  hint,
  icon,
  people,
}: {
  title: string
  hint: string
  icon: React.ReactNode
  people: Row[]
}) {
  const [copied, setCopied] = useState(false)
  if (!people.length) return null

  // ชื่อที่ยังไม่ยืนยันคือชื่อ LINE — เอาไปวางในไลน์กลุ่มแล้วคนจำตัวเองได้
  const label = (u: Row) =>
    u.name_verified ? `${u.full_name}${u.nickname ? ` (${u.nickname})` : ''}` : u.line_display_name

  const copy = async () => {
    await navigator.clipboard.writeText(people.map(label).join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border-b border-gray-100 px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        {icon}
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <Pill tone="neutral">{people.length} คน</Pill>
        <Button variant="link" size="sm" onClick={copy} className="ml-auto">
          <Copy size={12} /> {copied ? 'คัดลอกแล้ว' : 'คัดลอกรายชื่อ'}
        </Button>
      </div>

      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {people.map((u) => (
          <Link
            key={u.id}
            href={`/employees/${u.id}/edit`}
            title="เปิดหน้าแก้ไขพนักงานคนนี้"
            className="transition-opacity hover:opacity-80"
          >
            <Pill tone="neutral">{label(u)}</Pill>
          </Link>
        ))}
      </div>
    </div>
  )
}

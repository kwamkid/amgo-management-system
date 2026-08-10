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
import { ClipboardCheck, Copy, UserCog } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { DiscordIcon } from '@/components/icons/DiscordIcon'

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
      <section className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50/60 px-4 py-3">
        <ClipboardCheck size={16} className="shrink-0 text-green-600" />
        <p className="text-sm text-green-900">
          พนักงานทุกคนกรอกชื่อและเชื่อม Discord ครบแล้ว ({rows.length} คน)
        </p>
      </section>
    )
  }

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <UserCog size={15} className="shrink-0 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">
          ต้องตามอีก {behind.length} คน
        </h2>
        <span className="text-xs text-gray-500">จากทั้งหมด {rows.length} คน</span>
      </header>

      <Group
        title="ยังไม่มีชื่อจริง / ชื่อเล่น"
        hint="ชื่อในระบบยังเป็นชื่อ LINE — รายงานอ่านแล้วไม่รู้ว่าใคร"
        icon={<UserCog size={14} className="text-amber-600" />}
        people={noName}
      />
      <Group
        title="ยังไม่ได้เชื่อม Discord"
        hint="ระบบ mention ไม่ถึงตัว — แจ้งวันเกิด เตือนลืมเช็คเอาท์ แจ้งผลอนุมัติลา"
        icon={<DiscordIcon size={14} className="text-[#5865F2]" />}
        people={noDiscord}
      />
    </section>
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
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700">
          {people.length} คน
        </span>
        <button
          onClick={copy}
          className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
        >
          <Copy size={12} /> {copied ? 'คัดลอกแล้ว' : 'คัดลอกรายชื่อ'}
        </button>
      </div>

      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {people.map((u) => (
          <Link
            key={u.id}
            href={`/employees/${u.id}/edit`}
            title="เปิดหน้าแก้ไขพนักงานคนนี้"
            className="rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-100"
          >
            {label(u)}
          </Link>
        ))}
      </div>
    </div>
  )
}

// หน้า "ก่อนเริ่มใช้งาน" — รายการที่พนักงานต้องทำให้ครบก่อนเข้าระบบ
//
// ── ทำไมเป็นรายการ ไม่ใช่หน้าเดียวจบ ──────────────────────────────────
// ของเดิมมีแค่หน้าบังคับผูก Discord แล้วเด้งไปเลย พอมีเรื่องที่ 2 (ชื่อจริง +
// ชื่อเล่น) ถ้าทำเป็นหน้าเด้งอีกหน้า คนจะเจอเด้ง 2 รอบโดยไม่รู้ว่าเหลืออีกกี่รอบ
//
// รวมเป็นรายการติ๊กถูกหน้าเดียว เห็นทีเดียวว่าต้องทำอะไรบ้าง เหลืออีกกี่อย่าง
// เพิ่มเรื่องที่ 3 ทีหลังก็แค่เพิ่มการ์ด ไม่ต้องเพิ่มหน้าเด้ง
//
// คนที่ล็อกอินค้างไว้ตั้งแต่ก่อนมีกติกานี้ ก็ถูก ProtectedRoute พามาที่นี่
// ไม่ว่าจะเปิดหน้าไหนในระบบ

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowRight, Check, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { blockingTodos, TODO_TASKS } from '@/lib/todo/tasks'
import UserAvatar from '@/components/shared/UserAvatar'
import { DiscordIcon } from '@/components/icons/DiscordIcon'
import { Spinner } from '@/components/aoo'

const DISCORD_ERRORS: Record<string, string> = {
  denied: 'คุณกดยกเลิกที่หน้า Discord — ลองใหม่อีกครั้ง',
  no_code: 'Discord ไม่ได้ส่งรหัสยืนยันกลับมา ลองใหม่อีกครั้ง',
  bad_state: 'การยืนยันไม่ผ่าน — กดเชื่อมต่อใหม่จากหน้านี้อีกครั้ง',
  expired: 'ใช้เวลานานเกิน 10 นาที กดเชื่อมต่อใหม่อีกครั้ง',
  token_failed: 'แลกรหัสกับ Discord ไม่สำเร็จ ลองใหม่อีกครั้ง',
  profile_failed: 'ดึงข้อมูลบัญชี Discord ไม่สำเร็จ ลองใหม่อีกครั้ง',
  already_linked: 'บัญชี Discord นี้ถูกผูกกับพนักงานคนอื่นไปแล้ว — แจ้ง HR ถ้าคิดว่าผิด',
  save_failed: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง',
  not_configured: 'ระบบยังตั้งค่าเชื่อมต่อ Discord ไม่ครบ — แจ้งผู้ดูแลระบบ',
  unknown: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ ลองใหม่อีกครั้ง',
}

export default function SetupPage() {
  return (
    <Suspense>
      <Setup />
    </Suspense>
  )
}

function Setup() {
  const router = useRouter()
  const params = useSearchParams()
  const { userData, loading } = useAuth()
  const discordError = params.get('error')

  useEffect(() => {
    if (loading) return
    if (!userData) {
      router.replace('/login')
      return
    }
    // ทำครบแล้วไม่ต้องค้างอยู่หน้านี้ — ทั้งคนที่เพิ่งกดเสร็จอันสุดท้าย
    // และคนที่เผลอเปิดลิงก์เก่าค้างไว้
    if (blockingTodos(userData).length === 0) router.replace('/dashboard')
  }, [loading, userData, router])

  if (loading || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const pending = blockingTodos(userData).map((t) => t.id)
  const total = TODO_TASKS.filter((t) => t.blocking).length
  const done = total - pending.length

  const signOut = async () => {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">ก่อนเริ่มใช้งาน</h1>
          <p className="mt-2 text-sm text-gray-600">
            เหลืออีก {pending.length} อย่างที่ต้องทำให้ครบ
          </p>

          <div className="mx-auto mt-4 flex max-w-xs items-center gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < done ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* กำลังทำในชื่อใคร — ต้องเห็นก่อน ไม่งั้นคนที่ใช้เครื่องร่วมกันกรอกผิดคน */}
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <UserAvatar name={userData.fullName} userId={userData.id} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {userData.displayName || userData.fullName}
            </p>
            {userData.lineDisplayName && (
              <p className="truncate text-xs text-gray-500">LINE · {userData.lineDisplayName}</p>
            )}
          </div>
          <button
            onClick={signOut}
            className="flex shrink-0 items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <LogOut size={13} /> ไม่ใช่ฉัน
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <NameTask userData={userData} done={!pending.includes('name')} />
          <DiscordTask
            done={!pending.includes('discord')}
            username={userData.discordUsername}
            error={discordError}
          />
        </div>

        {pending.length === 0 && (
          <a
            href="/dashboard"
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 font-medium text-white transition-colors hover:bg-red-700"
          >
            เข้าใช้งานระบบ <ArrowRight size={16} />
          </a>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  1. ชื่อจริง + ชื่อเล่น
 * ------------------------------------------------------------------ */

function NameTask({
  userData,
  done,
}: {
  userData: NonNullable<ReturnType<typeof useAuth>['userData']>
  done: boolean
}) {
  // ชื่อที่ยังไม่ยืนยันคือชื่อ LINE ที่ลากมา ไม่ใช่ชื่อจริง — อย่าเอามาเป็นค่าตั้งต้น
  // ให้กรอกใหม่ ไม่งั้นคนกดบันทึกผ่านแล้วชื่อ "🌨️🌈🌻" กลายเป็นชื่อจริงถาวร
  const [fullName, setFullName] = useState(userData.nameVerified ? userData.fullName : '')
  const [nickname, setNickname] = useState(userData.nickname ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    const name = fullName.trim().replace(/\s+/g, ' ')
    const nick = nickname.trim().replace(/\s+/g, ' ')

    if (name.split(' ').length < 2) return setError('กรุณากรอกทั้งชื่อและนามสกุล')
    if (!nick) return setError('กรุณากรอกชื่อเล่น')

    setSaving(true)
    const { error: dbErr } = await createClient()
      .from('users')
      .update({ full_name: name, nickname: nick, name_verified: true })
      .eq('id', userData.id!)

    if (dbErr) {
      setError(`บันทึกไม่สำเร็จ: ${dbErr.message}`)
      setSaving(false)
      return
    }

    // โหลดหน้าใหม่ทั้งหน้า — useAuth อ่านข้อมูลตอนล็อกอินครั้งเดียว
    // ถ้าแค่ setState รายการติ๊กถูกจะไม่อัปเดตตาม
    window.location.reload()
  }

  return (
    <TaskCard n={1} title="กรอกชื่อจริงและชื่อเล่น" done={done}>
      {done ? (
        <p className="text-sm text-gray-600">
          {userData.fullName} <span className="text-gray-400">·</span> {userData.nickname}
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            ชื่อใน LINE เป็นชื่อที่ตั้งเอง เปิดรายงานมาแล้วดูไม่ออกว่าใครเป็นใคร
          </p>

          <div className="mt-3 space-y-2.5">
            <Field
              label="ชื่อ-นามสกุลจริง"
              value={fullName}
              onChange={setFullName}
              placeholder="เช่น อนงค์ สุขพลอย"
            />
            <Field
              label="ชื่อเล่น"
              value={nickname}
              onChange={setNickname}
              placeholder="เช่น แตน"
            />
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="mt-3 h-10 w-full rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </>
      )}
    </TaskCard>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,74,34,0.15)]"
      />
    </label>
  )
}

/* ------------------------------------------------------------------ *
 *  2. Discord
 * ------------------------------------------------------------------ */

function DiscordTask({
  done,
  username,
  error,
}: {
  done: boolean
  username?: string
  error: string | null
}) {
  const [devLinking, setDevLinking] = useState(false)
  const isDev = process.env.NODE_ENV === 'development'

  const devLink = async () => {
    setDevLinking(true)
    const res = await fetch('/api/auth/discord/dev-link', { method: 'POST' })
    if (res.ok) window.location.reload()
    else setDevLinking(false)
  }

  return (
    <TaskCard n={2} title="เชื่อมต่อบัญชี Discord" done={done}>
      {done ? (
        <p className="flex items-center gap-1.5 text-sm text-gray-600">
          <DiscordIcon size={14} className="text-[#5865F2]" />
          {username || 'เชื่อมต่อแล้ว'}
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            ระบบใช้ Discord เรียกถึงตัวคุณโดยตรง — แจ้งวันเกิด · เตือนเมื่อลืมเช็คเอาท์ ·
            แจ้งผลอนุมัติการลา
          </p>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{DISCORD_ERRORS[error] ?? DISCORD_ERRORS.unknown}</span>
            </div>
          )}

          <a
            href="/api/auth/discord/start"
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] text-sm font-medium text-white transition-colors hover:bg-[#4752C4]"
          >
            <DiscordIcon size={16} /> เชื่อมต่อ Discord
          </a>

          <p className="mt-2 text-xs text-gray-500">
            ระบบขอแค่ชื่อและรหัสบัญชีของคุณ ไม่สามารถอ่านข้อความหรือโพสต์แทนคุณได้
          </p>

          {isDev && (
            <button
              onClick={devLink}
              disabled={devLinking}
              className="mt-2 w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:bg-gray-50"
            >
              {devLinking ? 'กำลังผูก...' : 'ผูกแบบทดสอบ (เฉพาะตอนพัฒนา)'}
            </button>
          )}
        </>
      )}
    </TaskCard>
  )
}

/* ------------------------------------------------------------------ */

function TaskCard({
  n,
  title,
  done,
  children,
}: {
  n: number
  title: string
  done: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        done ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            done ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'
          }`}
        >
          {done ? <Check size={14} /> : n}
        </span>
        <h2 className={`font-medium ${done ? 'text-gray-500' : 'text-gray-900'}`}>{title}</h2>
      </div>
      <div className="mt-2.5 pl-[34px]">{children}</div>
    </div>
  )
}

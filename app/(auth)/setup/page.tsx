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
import { Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { blockingTodos, TODO_TASKS } from '@/lib/todo/tasks'
import UserAvatar from '@/components/shared/UserAvatar'
import { DiscordIcon } from '@/components/icons/DiscordIcon'
import { Alert, Button, Field, Input, SelectMenu, Spinner } from '@/components/aoo'
import { THAI_BANKS } from '@/lib/constants/banks'
import { enablePush, getPushState, inAppBrowser, type PushState } from '@/lib/push/client'
import type { UserData } from '@/lib/services/user/mappers'
import InfoPanel from '@/components/shared/InfoPanel'
import SectionCard from '@/components/shared/SectionCard'

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
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)]">
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">ก่อนเริ่มใช้งาน</h1>
          <p className="mt-2 text-sm text-gray-600">
            เหลืออีก {pending.length} อย่างที่ต้องทำให้ครบ
          </p>

          <div className="mx-auto mt-4 flex max-w-xs items-center gap-2">
            {Array.from({ length: total }, (_, i) => i).map((i) => (
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
        <InfoPanel className="mt-6 flex items-center gap-3">
          <UserAvatar name={userData.fullName} userId={userData.id} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {userData.displayName || userData.fullName}
            </p>
            {userData.lineDisplayName && (
              <p className="truncate text-xs text-gray-500">LINE · {userData.lineDisplayName}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" icon="LogOut" onClick={signOut} className="shrink-0">
            ไม่ใช่ฉัน
          </Button>
        </InfoPanel>

        <div className="mt-4 space-y-3">
          <NameTask userData={userData} done={!pending.includes('name')} />
          <DiscordTask
            done={!pending.includes('discord')}
            username={userData.discordUsername}
            error={discordError}
          />
          {/* เพิ่ม 30 ก.ย. 69 — การ์ดที่ไม่เกี่ยวกับคนนี้ (ไม่ใช่กลุ่ม 6 วัน / ใช้คอม) ไม่ต้องโชว์ */}
          {(pending.includes('bank') || userData.role !== 'admin') && (
            <BankTask userData={userData} done={!pending.includes('bank')} />
          )}
          {(pending.includes('identity') || userData.role !== 'admin') && (
            <IdentityTask userData={userData} done={!pending.includes('identity')} />
          )}
          {pending.includes('dayoff') && <DayOffTask />}
          {pending.includes('push') && <PushTask />}
        </div>

        {pending.length === 0 && (
          <Button
            size="lg"
            iconRight="ChevronRight"
            className="mt-5 w-full"
            onClick={() => {
              window.location.href = '/dashboard'
            }}
          >
            เข้าใช้งานระบบ
          </Button>
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
            <Field label="ชื่อ-นามสกุลจริง">
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="เช่น อนงค์ สุขพลอย"
              />
            </Field>
            <Field label="ชื่อเล่น">
              <Input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="เช่น แตน"
              />
            </Field>
          </div>

          {error && (
            <Alert tone="error" compact className="mt-2">
              {error}
            </Alert>
          )}

          <Button onClick={save} loading={saving} className="mt-3 w-full">
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </>
      )}
    </TaskCard>
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
            <Alert tone="warning" compact className="mt-3">
              {DISCORD_ERRORS[error] ?? DISCORD_ERRORS.unknown}
            </Alert>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={devLink}
              loading={devLinking}
              className="mt-2 w-full"
            >
              {devLinking ? 'กำลังผูก...' : 'ผูกแบบทดสอบ (เฉพาะตอนพัฒนา)'}
            </Button>
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
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span
          data-tone={done ? 'success' : 'accent'}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tone)] text-xs font-semibold text-[var(--tone-on)]"
        >
          {done ? <Check size={14} /> : n}
        </span>
        <h2 className={`font-medium ${done ? 'text-gray-500' : 'text-gray-900'}`}>{title}</h2>
      </div>
      <div className="mt-2.5 pl-[34px]">{children}</div>
    </>
  )
  // ทำแล้ว = กล่องเทาจาง · ยังไม่ทำ = การ์ดขาวเด่น
  return done ? <InfoPanel>{body}</InfoPanel> : <SectionCard>{body}</SectionCard>
}

/* ------------------------------------------------------------------ *
 *  3–6. เพิ่ม 30 ก.ย. 69 — เลขบัญชี · บัตรประชาชน+ที่อยู่ · วันหยุด · แจ้งเตือน
 *  บันทึกแล้วโหลดหน้าใหม่ทั้งหน้า (useAuth อ่านข้อมูลครั้งเดียวตอนเปิดแอป)
 * ------------------------------------------------------------------ */

const BANK_OPTIONS = THAI_BANKS.map((b) => ({ value: b.code, label: b.nameTh, hint: b.code }))

function BankTask({ userData, done }: { userData: UserData; done: boolean }) {
  const [bank, setBank] = useState<string | null>(userData.bankName ?? null)
  const [account, setAccount] = useState(userData.bankAccountNo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const digits = account.replace(/\D/g, '')
    if (!bank) return setError('เลือกธนาคาร')
    if (digits.length < 10 || digits.length > 15) return setError('เลขบัญชีต้องเป็นตัวเลข 10–15 หลัก')
    setSaving(true)
    const { error: dbErr } = await createClient()
      .from('users')
      .update({ bank_name: bank, bank_account_no: digits })
      .eq('id', userData.id!)
    if (dbErr) {
      setError(`บันทึกไม่สำเร็จ: ${dbErr.message}`)
      setSaving(false)
      return
    }
    window.location.reload()
  }

  return (
    <TaskCard n={3} title="บัญชีธนาคารรับเงินเดือน" done={done}>
      {done ? (
        <p className="text-sm text-gray-600">
          {THAI_BANKS.find((b) => b.code === userData.bankName)?.nameTh ?? userData.bankName} ·{' '}
          {userData.bankAccountNo}
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            ใช้โอนเงินเดือนและเงินคืนจากใบเบิก · กรอกครั้งเดียว ถ้าจะเปลี่ยนภายหลังต้องแจ้ง HR
          </p>
          <div className="mt-3 space-y-2.5">
            <Field label="ธนาคาร" asDiv>
              <SelectMenu value={bank} options={BANK_OPTIONS} onChange={setBank} placeholder="เลือกธนาคาร" />
            </Field>
            <Field label="เลขบัญชี">
              <Input
                inputMode="numeric"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="เช่น 1234567890"
              />
            </Field>
          </div>
          {error && <Alert tone="error" className="mt-3">{error}</Alert>}
          <Button className="mt-3" onClick={save} loading={saving}>
            บันทึก
          </Button>
        </>
      )}
    </TaskCard>
  )
}

/** เลขบัตรประชาชนไทย — 13 หลัก หลักสุดท้ายเป็นเลขตรวจสอบ */
function validThaiId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false
  const sum = id
    .slice(0, 12)
    .split('')
    .reduce((s, d, i) => s + Number(d) * (13 - i), 0)
  return (11 - (sum % 11)) % 10 === Number(id[12])
}

function IdentityTask({ userData, done }: { userData: UserData; done: boolean }) {
  const [nid, setNid] = useState(userData.nationalId ?? '')
  const [address, setAddress] = useState(userData.address ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const digits = nid.replace(/\D/g, '')
    if (!validThaiId(digits)) return setError('เลขบัตรประชาชนไม่ถูกต้อง — ตรวจอีกครั้ง (13 หลัก)')
    if (address.trim().length < 10) return setError('กรอกที่อยู่ให้ครบ (บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด)')
    setSaving(true)
    const { error: dbErr } = await createClient()
      .from('users')
      .update({ national_id: digits, address: address.trim() })
      .eq('id', userData.id!)
    if (dbErr) {
      setError(`บันทึกไม่สำเร็จ: ${dbErr.message}`)
      setSaving(false)
      return
    }
    window.location.reload()
  }

  return (
    <TaskCard n={4} title="เลขบัตรประชาชนและที่อยู่" done={done}>
      {done ? (
        <p className="text-sm text-gray-600">บันทึกแล้ว</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">ใช้ออกสัญญาจ้างและใบรับรองเงินเดือน</p>
          <div className="mt-3 space-y-2.5">
            <Field label="เลขบัตรประชาชน">
              <Input
                inputMode="numeric"
                value={nid}
                onChange={(e) => setNid(e.target.value)}
                placeholder="13 หลัก"
                maxLength={17}
              />
            </Field>
            <Field label="ที่อยู่ตามทะเบียนบ้าน">
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </Field>
          </div>
          {error && <Alert tone="error" className="mt-3">{error}</Alert>}
          <Button className="mt-3" onClick={save} loading={saving}>
            บันทึก
          </Button>
        </>
      )}
    </TaskCard>
  )
}

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

function DayOffTask() {
  const [dow, setDow] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (dow === null) return setError('เลือกวันหยุด 1 วัน')
    setSaving(true)
    const { error: dbErr } = await createClient().rpc('set_my_day_off', { p_dow: dow })
    if (dbErr) {
      setError(dbErr.message)
      setSaving(false)
      return
    }
    window.location.reload()
  }

  return (
    <TaskCard n={5} title="เลือกวันหยุดประจำสัปดาห์" done={false}>
      <p className="text-sm text-gray-600">
        ทำงาน 6 วัน หยุด 1 วัน — เลือกวันที่หยุดประจำ · เลือกแล้วถ้าจะเปลี่ยนต้องแจ้ง HR
      </p>
      <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {DAYS.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => setDow(i)}
            className={`h-11 rounded-lg border text-sm font-medium ${
              dow === i
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
      <Button className="mt-3" onClick={save} loading={saving} disabled={dow === null}>
        {dow === null ? 'เลือกวันก่อน' : `หยุดทุกวัน${DAYS[dow]}`}
      </Button>
    </TaskCard>
  )
}

function PushTask() {
  const [state, setState] = useState<PushState | null>(null)
  const [inApp, setInApp] = useState<'line' | 'facebook' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setInApp(inAppBrowser())
    getPushState().then(setState)
  }, [])

  const turnOn = async () => {
    setBusy(true)
    setError('')
    try {
      const next = await enablePush()
      setState(next)
      if (next === 'subscribed') window.location.reload()
      else if (next === 'denied') setError('เครื่องนี้ปิดการแจ้งเตือนไว้ — ทำตามขั้นตอนด้านบน')
    } catch {
      setError('เปิดแจ้งเตือนไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <TaskCard n={6} title="เปิดแจ้งเตือนบนมือถือ" done={false}>
      <p className="text-sm text-gray-600">
        จะได้รู้ผลใบลา/ใบสลับวันหยุด/ใบเบิก และเตือนตอนลืมเช็คเอาท์
      </p>
      <div className="mt-3">
        {inApp ? (
          // หน้า /install มีขั้นตอนออกจาก LINE พร้อมรูปไอคอนจริง (ProtectedRoute ปล่อยผ่านหน้านี้)
          <a href="/install">
            <Button icon="ExternalLink">
              เปิดจาก {inApp === 'line' ? 'LINE' : 'Facebook'} อยู่ — ดูวิธีเปิดในเบราว์เซอร์
            </Button>
          </a>
        ) : state === 'ios-needs-install' ? (
          <a href="/install">
            <Button icon="Download">ติดตั้งแอปก่อน (iPhone ต้องติดตั้งถึงจะแจ้งเตือนได้)</Button>
          </a>
        ) : state === 'denied' ? (
          <div className="text-sm text-gray-700">
            เครื่องนี้เคยกดไม่อนุญาตไว้ — เข้าตั้งค่าของเบราว์เซอร์ → การแจ้งเตือน → อนุญาต
            app.amgovenger.com แล้วกลับมากดปุ่มนี้
            <div className="mt-2">
              <Button onClick={turnOn} loading={busy}>
                ลองอีกครั้ง
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={turnOn} loading={busy} icon="BellRing" disabled={state === null}>
            เปิดแจ้งเตือน
          </Button>
        )}
      </div>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
    </TaskCard>
  )
}

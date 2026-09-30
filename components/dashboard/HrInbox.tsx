'use client'

// หน้าแรกของ HR — "ต้องรวมสิ่งที่ขาด และยังไม่ approve ทั้งหมด" (เจ้าของ 30 ก.ย. 69)
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// ของค้างกระจายอยู่คนละเมนูจนไม่มีใครเปิด: ใบสลับวันหยุดค้าง 20 ใบ (ไม่มีใคร
// กดตั้งแต่ 3 ก.ย.) · ใบลืมเช็คเอาท์ 657 ใบไม่มีหน้าให้ตรวจเลย · คิวอนุมัติ OT
// 1,926 ใบที่ไม่มีผลกับเงิน (ปิดทิ้งแล้ว) — กล่องนี้ดึงทุกอย่างมาไว้หน้าแรก
// เรียงตามสิ่งที่ต้องทำก่อน: รออนุมัติ → วันนี้ → ข้อมูลที่ยังขาด
//
// ข้อมูลทั้งหมดมาจาก RPC hr_inbox() ครั้งเดียว (security definer เพราะต้องอ่าน
// push_subscriptions ของทุกคน) · ใบลืมเช็คเอาท์โชว์เฉพาะงวดที่ยังไม่ตัดยอด

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BellOff,
  CalendarClock,
  CalendarSync,
  ClipboardList,
  Clock3,
  Copy,
  FileText,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Skeleton, SectionCard, StatCard } from '@/components/shared'
import { Alert, Button, Card, CardHeader, CardTitle, Pill } from '@/components/aoo'
import ForgotReviewList from '@/components/checkin/ForgotReviewList'
import { fetchHrInbox, type HrInbox as Inbox, type PersonRef } from '@/lib/services/hrInboxService'

/** โชว์ใบลืมเช็คเอาท์บนหน้าแรกกี่ใบ ที่เหลือไปดูหน้ารอดำเนินการ */
const FORGOT_PREVIEW = 6

/** ก่อนเวลานี้ยังไม่เรียกว่าขาด — คนเข้า 08:30/09:00/10:00 ยังไม่ถึงเวลา */
const ABSENT_FROM_HOUR = 10

const INSTALL_URL = 'https://app.amgovenger.com/install'

export default function HrInbox() {
  const { userData, loading } = useAuth()
  const [data, setData] = useState<Inbox | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isHr = !!userData && ['hr', 'admin'].includes(userData.role)

  const load = useCallback(() => {
    fetchHrInbox()
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
  }, [])

  useEffect(() => {
    if (isHr) load()
  }, [isHr, load])

  if (loading || !isHr) return null
  if (error) return <Alert tone="error" className="mb-5">{error}</Alert>
  if (!data) return <Skeleton rows={4} />

  const claimed = data.forgot.filter((f) => f.claimed_checkout_time).length
  const pendingTotal = data.leave_pending + data.swap_pending + data.forgot.length
  const beforeStart = new Date().getHours() < ABSENT_FROM_HOUR

  return (
    <section className="mb-5 space-y-4">
      {/* ── รออนุมัติ ─────────────────────────────────────────────── */}
      <Card padding={0} className="overflow-hidden">
        <CardHeader>
          <CardTitle icon={ClipboardList} tone={pendingTotal ? 'warning' : 'success'}>
            {pendingTotal ? `รออนุมัติ ${pendingTotal} รายการ` : 'ไม่มีอะไรรออนุมัติ'}
          </CardTitle>
        </CardHeader>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <Tile
            href="/leaves/management"
            icon={FileText}
            label="ใบลา"
            count={data.leave_pending}
          />
          <Tile
            href="/leaves/swap/management"
            icon={CalendarSync}
            label="ใบสลับวันหยุด"
            count={data.swap_pending}
          />
          <Tile
            href="/checkin/pending"
            icon={Clock3}
            label="ลืมเช็คเอาท์ รอตรวจ"
            count={data.forgot.length}
            sub={claimed ? `พนักงานแจ้งเวลาแล้ว ${claimed}` : undefined}
          />
        </div>

        {data.forgot.length > 0 && (
          <div className="border-t border-gray-100 px-4 pb-2 pt-3">
            <p className="text-xs text-gray-500">
              ระบบปิดกะให้ที่เวลาเลิกงานปกติ ไม่มี OT · ใบที่พนักงานแจ้งเวลาจริงมาแล้วอยู่บนสุด
              กดอนุมัติแล้วระบบคิดชั่วโมงใหม่ให้
            </p>
            <ForgotReviewList items={data.forgot.slice(0, FORGOT_PREVIEW)} onChanged={load} />
            {data.forgot.length > FORGOT_PREVIEW && (
              <Link
                href="/checkin/pending"
                className="block py-2 text-center text-sm font-medium text-[var(--accent)] hover:underline"
              >
                ดูทั้งหมด {data.forgot.length} ใบ
              </Link>
            )}
          </div>
        )}
      </Card>

      {/* ── วันนี้ ────────────────────────────────────────────────── */}
      {data.absent_today.length > 0 && (
        <Group
          icon={<UserX size={15} className="text-[var(--ruby-500)]" />}
          title={beforeStart ? 'ยังไม่เช็คอินวันนี้' : 'ขาดงานวันนี้'}
          hint={
            beforeStart
              ? `ยังไม่ถึง ${ABSENT_FROM_HOUR}:00 บางคนอาจยังไม่ถึงเวลาเข้างาน · ไม่นับคนที่ลาแล้ว/วันหยุด`
              : 'วันทำงานของเขาแต่ยังไม่เช็คอินและไม่ได้ลา'
          }
          people={data.absent_today}
        />
      )}

      {/* ── ข้อมูลที่ยังขาด ───────────────────────────────────────── */}
      {(data.schedule_issues.length > 0 || data.no_push.length > 0) && (
        <Card padding={0} className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle icon={CalendarClock} tone="grape">ข้อมูลที่ยังไม่ครบ</CardTitle>
          </CardHeader>

          {data.schedule_issues.length > 0 && (
            <div className="border-b border-gray-100 px-4 py-3 last:border-0">
              <div className="flex items-center gap-2">
                <CalendarClock size={14} className="text-[var(--sun-700)]" />
                <h3 className="text-sm font-medium text-gray-900">วันหยุดประจำไม่ชัด</h3>
                <Count n={data.schedule_issues.length} />
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                กดชื่อเพื่อตั้งวันหยุดให้ถูก — ตั้งผิดทำให้ยื่นสลับวันหยุดไม่ผ่านและรายงานนับขาดเพี้ยน
              </p>
              <ul className="mt-2 space-y-1">
                {data.schedule_issues.map((p) => (
                  <li key={p.user_id} className="text-sm">
                    <Link
                      href={`/employees/${p.user_id}/edit`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {p.name}
                    </Link>{' '}
                    <span className="text-gray-500">— {p.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.no_push.length > 0 && (
            <NoPush people={data.no_push} total={data.staff_total} />
          )}
        </Card>
      )}
    </section>
  )
}

function Tile({
  href,
  icon,
  label,
  count,
  sub,
}: {
  href: string
  icon: LucideIcon
  label: string
  count: number
  sub?: string
}) {
  // ค้าง = เหลือง (รอ) · ว่าง = เทา
  return (
    <Link href={href} className="block">
      <StatCard label={label} value={count} icon={icon} tone={count > 0 ? 'warning' : 'muted'} hint={sub} />
    </Link>
  )
}

function Count({ n }: { n: number }) {
  return <Pill tone="neutral">{n} คน</Pill>
}

function Group({
  icon,
  title,
  hint,
  people,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  people: PersonRef[]
}) {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          {icon}
          {title}
          <Count n={people.length} />
        </span>
      }
      description={hint}
    >
      <div className="flex flex-wrap gap-1.5">
        {people.map((p) => (
          <Pill key={p.user_id} tone="neutral">{p.name}</Pill>
        ))}
      </div>
    </SectionCard>
  )
}

/** ยังไม่เปิดแจ้งเตือน — push เตือนเช็คเอาท์จะไปไม่ถึง ต้องให้ HR ตามให้ติดตั้งก่อน */
function NoPush({ people, total }: { people: PersonRef[]; total: number }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const msg = [
      'รบกวนติดตั้งแอป AMGO และเปิดแจ้งเตือนด้วยนะคะ 🙏',
      'จะมีแจ้งเตือนผลใบลา/ใบสลับวันหยุด และเตือนเวลาลืมเช็คเอาท์',
      `วิธีติดตั้ง: ${INSTALL_URL}`,
      '(ติดตั้งแล้วเข้าหน้าโปรไฟล์ → เปิดสวิตช์แจ้งเตือน)',
      '',
      ...people.map((p) => `• ${p.name}`),
    ].join('\n')
    await navigator.clipboard.writeText(msg)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <BellOff size={14} className="text-gray-500" />
        <h3 className="text-sm font-medium text-gray-900">ยังไม่ได้ติดตั้งแอป/เปิดแจ้งเตือน</h3>
        <Count n={people.length} />
        <span className="text-xs text-gray-500">จาก {total} คน</span>
        <Button variant="link" size="sm" onClick={copy} className="ml-auto">
          <Copy size={12} /> {copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความเตือน ส่งไลน์กลุ่ม'}
        </Button>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">
        คนกลุ่มนี้จะไม่ได้รับแจ้งเตือนใด ๆ จากระบบ — ข้อความที่คัดลอกมีลิงก์วิธีติดตั้งและรายชื่อให้แล้ว
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {people.map((p) => (
          <Pill key={p.user_id} tone="neutral">{p.name}</Pill>
        ))}
      </div>
    </div>
  )
}

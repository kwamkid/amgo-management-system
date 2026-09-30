'use client'

// หน้าโปรไฟล์ของตัวเอง
//
// รวมสิ่งที่พนักงานต้องเห็นเกี่ยวกับตัวเองไว้ที่เดียว: ตัวตน · การเชื่อมต่อ · การทำงาน
// สองอย่างที่ทำได้จากหน้านี้คือ ดึงรูปจาก LINE ใหม่ กับ เชื่อมต่อ Discord

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { PageHeader, StatusBadge, SectionCard } from '@/components/shared'
import UserAvatar from '@/components/shared/UserAvatar'
import { Alert, Button, CardTitle, Field, Input, Pill } from '@/components/aoo'
import { User as UserIcon, Check, IdCard, Link2, Briefcase } from 'lucide-react'
import { DiscordIcon } from '@/components/icons/DiscordIcon'
import TechLoader from '@/components/shared/TechLoader'
import { createClient } from '@/lib/supabase/client'
import PayCard from '@/components/users/PayCard'
import DeviceCard from '@/components/push/DeviceCard'

const EMPLOYMENT_TYPE: Record<string, string> = {
  monthly: 'รายเดือน',
  daily: 'รายวัน',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{children}</span>
    </div>
  )
}

/**
 * แก้ชื่อจริง/ชื่อเล่นของตัวเอง
 *
 * เขียนตรงด้วย session ตัวเอง ไม่ผ่าน API — policy users_update_own อนุญาต
 * แก้แถวตัวเองอยู่แล้ว และ trigger users_guard_self_edit ดันค่าที่ห้ามแก้
 * (สิทธิ์ · สถานะ · หน่วยงาน · เงินเดือน) กลับให้เอง
 */
function NameEditor({
  userId,
  fullName,
  nickname,
  onCancel,
  onSaved,
}: {
  userId: string
  fullName: string
  nickname?: string
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(fullName)
  const [nick, setNick] = useState(nickname ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const cleanName = name.trim().replace(/\s+/g, ' ')
    const cleanNick = nick.trim().replace(/\s+/g, ' ')

    if (cleanName.split(' ').length < 2) return setError('กรุณากรอกทั้งชื่อและนามสกุล')
    if (!cleanNick) return setError('กรุณากรอกชื่อเล่น')

    setSaving(true)
    setError('')
    const { error: dbErr } = await createClient()
      .from('users')
      .update({ full_name: cleanName, nickname: cleanNick, name_verified: true })
      .eq('id', userId)

    if (dbErr) {
      setError(`บันทึกไม่สำเร็จ: ${dbErr.message}`)
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <div className="space-y-2.5 border-b border-gray-100 pb-4">
      <Field label="ชื่อ-นามสกุลจริง">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น อนงค์ สุขพลอย"
        />
      </Field>

      <Field label="ชื่อเล่น">
        <Input
          type="text"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="เช่น แตน"
        />
      </Field>

      {error && <Alert tone="error" compact>{error}</Alert>}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          ยกเลิก
        </Button>
        <Button size="sm" onClick={save} loading={saving}>
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </div>
  )
}

const thaiDate = (d: Date | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

export default function ProfilePage() {
  const { userData, loading } = useAuth()
  const { showToast } = useToast()

  const [editing, setEditing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  // เปลี่ยนค่านี้เพื่อบังคับให้เบราว์เซอร์โหลดรูปใหม่ ไม่งั้นมันใช้ของในแคช
  const [photoVersion, setPhotoVersion] = useState(0)

  if (loading) return <TechLoader />
  if (!userData) return null

  const handleResync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/users/sync-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData.id, refetch: true }),
      })
      if (!res.ok) throw new Error()

      setPhotoVersion((v) => v + 1)
      showToast('ดึงรูปจาก LINE ใหม่แล้ว', 'success')
    } catch {
      showToast('ดึงรูปใหม่ไม่สำเร็จ ลองอีกครั้ง', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const discordLinked = !!userData.discordUserId

  return (
    <>
      <PageHeader title="โปรไฟล์ของฉัน" description="ข้อมูลส่วนตัวและการเชื่อมต่อ" icon={UserIcon} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── รูป ────────────────────────────────────────────── */}
        <SectionCard className="text-center">
          <div className="flex justify-center">
            <UserAvatar
              key={photoVersion}
              name={userData.fullName}
              userId={userData.id}
              size="xl"
            />
          </div>

          <h2 className="mt-4 font-semibold text-gray-900">
            {userData.displayName || userData.fullName}
          </h2>
          {userData.lineDisplayName && (
            <p className="text-sm text-gray-500">{userData.lineDisplayName}</p>
          )}

          <div className="mt-3 flex justify-center">
            <StatusBadge status={userData.role} />
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon="RefreshCw"
            className="mt-5 w-full"
            loading={syncing}
            onClick={handleResync}
          >
            {syncing ? 'กำลังดึงรูป...' : 'ดึงรูปจาก LINE ใหม่'}
          </Button>
          <p className="mt-2 text-xs text-gray-500">กดเมื่อเปลี่ยนรูปโปรไฟล์ใน LINE แล้ว</p>
        </SectionCard>

        {/* ── ข้อมูล ─────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <SectionCard>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle icon={IdCard} tone="accent">ข้อมูลส่วนตัว</CardTitle>
              {!editing && (
                <Button variant="ghost" size="sm" icon="Pencil" onClick={() => setEditing(true)}>
                  แก้ไขชื่อ
                </Button>
              )}
            </div>

            {editing ? (
              <NameEditor
                fullName={userData.fullName}
                nickname={userData.nickname}
                onCancel={() => setEditing(false)}
                onSaved={() => window.location.reload()}
                userId={userData.id!}
              />
            ) : (
              <>
                <Row label="ชื่อ-นามสกุล">{userData.fullName}</Row>
                <Row label="ชื่อเล่น">
                  {userData.nickname || <Pill tone="warning">ยังไม่ได้กรอก</Pill>}
                </Row>
              </>
            )}

            <Row label="ชื่อใน LINE">{userData.lineDisplayName || '—'}</Row>
            <Row label="เบอร์โทร">
              <span className="font-mono tabular-nums">{userData.phone || '—'}</span>
            </Row>
            <Row label="วันเกิด">
              {userData.birthDate ? thaiDate(new Date(userData.birthDate)) : '—'}
            </Row>
          </SectionCard>

          {/* ค่าตอบแทนของตัวเอง — คนอื่นเห็นไม่ได้ ฐานข้อมูลกรองให้ */}
          <PayCard userId={userData.id!} />

          <SectionCard>
            <CardTitle icon={Link2} tone="sky" className="mb-2">การเชื่อมต่อ</CardTitle>

            <div className="flex items-center justify-between border-b border-gray-100 py-2.5">
              <span className="text-sm text-gray-500">LINE</span>
              <Pill tone="success">
                <Check size={14} /> เชื่อมต่อแล้ว
              </Pill>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-500">Discord</span>
              {discordLinked ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <DiscordIcon size={14} className="text-[#5865F2]" />
                  {userData.discordUsername || 'เชื่อมต่อแล้ว'}
                  <Check size={14} className="text-green-600" />
                </span>
              ) : (
                <a
                  href="/api/auth/discord/start"
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 text-sm font-medium text-white transition-colors hover:bg-[#4752C4]"
                >
                  <DiscordIcon size={14} /> เชื่อมต่อ Discord
                </a>
              )}
            </div>

            {discordLinked && (
              <p className="mt-1 text-xs text-gray-500">
                ระบบจะ mention คุณเวลาแจ้งวันเกิด เตือนลืมเช็คเอาท์ และแจ้งผลอนุมัติลา
              </p>
            )}
          </SectionCard>

          {/* ติดตั้งแอป + แจ้งเตือนของเครื่องนี้ */}
          <DeviceCard />

          <SectionCard>
            <CardTitle icon={Briefcase} tone="grape" className="mb-2">การทำงาน</CardTitle>
            <Row label="สถานะ">
              <StatusBadge status={userData.employmentStatus} />
            </Row>
            <Row label="ประเภทการจ้าง">
              {EMPLOYMENT_TYPE[userData.employmentType ?? ''] ?? '—'}
            </Row>
            <Row label="วันเริ่มงาน">
              {thaiDate(userData.startDate)}
              {userData.startDate && !userData.startDateVerified && (
                <Pill tone="warning" className="ml-2">รอ HR ยืนยัน</Pill>
              )}
            </Row>
            {userData.endDate && <Row label="วันสุดท้าย">{thaiDate(userData.endDate)}</Row>}
            <Row label="ทำงานสัปดาห์ละ">
              {userData.daysPerWeek ? `${userData.daysPerWeek} วัน` : '—'}
            </Row>
            <Row label="ทำงานที่บ้านได้">{userData.wfhEligible ? 'ได้' : 'ไม่ได้'}</Row>
          </SectionCard>
        </div>
      </div>
    </>
  )
}

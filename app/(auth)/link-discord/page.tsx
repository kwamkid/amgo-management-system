// หน้าบังคับผูก Discord
//
// กติกาของบริษัท: คนที่เช็คอินได้ต้องมีทั้ง LINE และ Discord
// คนที่ยังไม่ผูกจะถูกพามาที่นี่ก่อนเข้าระบบ (เช็คใน ProtectedRoute)
//
// ไม่ได้เอา Discord มาแทน LINE — LINE ยังเป็นตัวยืนยันว่าเป็นใคร
// ส่วน Discord ผูกไว้เพื่อ mention ได้จริงเวลาแจ้งเตือน
//
// ⚠️ ต้องบอกให้ชัดว่า "กำลังเชื่อมในชื่อใคร" ไม่งั้นคนที่เปิดหน้านี้ค้างไว้
//    หรือใช้เครื่องร่วมกัน จะเผลอผูก Discord ของตัวเองเข้ากับบัญชีคนอื่น

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import UserAvatar from '@/components/shared/UserAvatar'
import { DiscordIcon } from '@/components/icons/DiscordIcon'
import { Spinner } from '@/components/aoo'

const ERRORS: Record<string, string> = {
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

export default function LinkDiscordPage() {
  return (
    <Suspense>
      <LinkDiscord />
    </Suspense>
  )
}

function LinkDiscord() {
  const params = useSearchParams()
  const router = useRouter()
  const { userData, loading } = useAuth()
  const error = params.get('error')

  // ยังไม่ล็อกอินก็ผูกอะไรไม่ได้ ไม่ต้องให้เห็นหน้านี้
  useEffect(() => {
    if (!loading && !userData) router.replace('/login')
  }, [loading, userData, router])

  // ตอนพัฒนาไม่ต้องกด OAuth จริงทุกครั้งที่ล้างฐานข้อมูล
  const [devLinking, setDevLinking] = useState(false)
  const isDev = process.env.NODE_ENV === 'development'

  const devLink = async () => {
    setDevLinking(true)
    const res = await fetch('/api/auth/discord/dev-link', { method: 'POST' })
    if (res.ok) window.location.href = '/dashboard'
    else setDevLinking(false)
  }

  const signOut = async () => {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  if (loading || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2]/10">
            <DiscordIcon size={28} className="text-[#5865F2]" />
          </div>

          <h1 className="text-xl font-semibold text-gray-900">เชื่อมต่อบัญชี Discord</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            พนักงานทุกคนต้องมีทั้ง <span className="font-medium text-gray-900">LINE</span> และ{' '}
            <span className="font-medium text-gray-900">Discord</span> เชื่อมต่อไว้
            เพื่อให้ระบบแจ้งเตือนถึงตัวคุณได้โดยตรง
          </p>
        </div>

        {/* กำลังเชื่อมในชื่อใคร — ต้องเห็นก่อนกด */}
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <UserAvatar name={userData.fullName} userId={userData.id} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{userData.fullName}</p>
            {userData.lineDisplayName && (
              <p className="truncate text-xs text-gray-500">LINE · {userData.lineDisplayName}</p>
            )}
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
          <li>· แจ้งวันเกิด</li>
          <li>· เตือนเมื่อลืมเช็คเอาท์</li>
          <li>· แจ้งผลอนุมัติการลา</li>
        </ul>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{ERRORS[error] ?? ERRORS.unknown}</span>
          </div>
        )}

        <a
          href="/api/auth/discord/start"
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] font-medium text-white transition-colors hover:bg-[#4752C4]"
        >
          <DiscordIcon size={18} />
          เชื่อมต่อ Discord
        </a>

        <p className="mt-4 text-center text-xs text-gray-500">
          ระบบขอแค่ชื่อและรหัสบัญชีของคุณ ไม่สามารถอ่านข้อความหรือโพสต์แทนคุณได้
        </p>

        {isDev && (
          <button
            onClick={devLink}
            disabled={devLinking}
            className="mt-3 w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:bg-gray-50"
          >
            {devLinking ? 'กำลังผูก...' : 'ผูกแบบทดสอบ (เฉพาะตอนพัฒนา)'}
          </button>
        )}

        <button
          onClick={signOut}
          className="mt-5 flex w-full items-center justify-center gap-1.5 border-t border-gray-100 pt-4 text-xs text-gray-500 hover:text-gray-700"
        >
          <LogOut size={13} />
          ไม่ใช่บัญชีของคุณ? ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

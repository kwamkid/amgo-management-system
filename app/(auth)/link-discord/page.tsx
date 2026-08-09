// หน้าบังคับผูก Discord
//
// กติกาของบริษัท: คนที่เช็คอินได้ต้องมีทั้ง LINE และ Discord
// คนที่ยังไม่ผูก พอล็อกอินรอบใหม่จะถูกพามาที่นี่ก่อนเข้าระบบ
//
// ไม่ได้เอา Discord มาแทน LINE — LINE ยังเป็นตัวยืนยันว่าเป็นใคร
// ส่วน Discord ผูกไว้เพื่อ mention ได้จริงเวลาแจ้งเตือน

'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/aoo'

const ERRORS: Record<string, string> = {
  denied: 'คุณกดยกเลิกที่หน้า Discord — ลองใหม่อีกครั้ง',
  no_code: 'Discord ไม่ได้ส่งรหัสยืนยันกลับมา ลองใหม่อีกครั้ง',
  bad_state: 'ลิงก์หมดอายุแล้ว (เกิน 10 นาที) กดเชื่อมต่อใหม่อีกครั้ง',
  token_failed: 'แลกรหัสกับ Discord ไม่สำเร็จ ลองใหม่อีกครั้ง',
  profile_failed: 'ดึงข้อมูลบัญชี Discord ไม่สำเร็จ ลองใหม่อีกครั้ง',
  already_linked: 'บัญชี Discord นี้ถูกผูกกับพนักงานคนอื่นไปแล้ว — แจ้ง HR ถ้าคิดว่าผิด',
  save_failed: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง',
  not_configured: 'ระบบยังตั้งค่าเชื่อมต่อ Discord ไม่ครบ — แจ้งผู้ดูแลระบบ',
  unknown: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ ลองใหม่อีกครั้ง',
}

// useSearchParams ต้องอยู่ใน Suspense ไม่งั้น Next สร้างหน้าล่วงหน้าไม่ได้
export default function LinkDiscordPage() {
  return (
    <Suspense>
      <LinkDiscord />
    </Suspense>
  )
}

function LinkDiscord() {
  const params = useSearchParams()
  const error = params.get('error')

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2]/10">
          <MessageSquare className="h-7 w-7 text-[#5865F2]" />
        </div>

        <h1 className="text-xl font-semibold text-gray-900">เชื่อมต่อบัญชี Discord</h1>

        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          พนักงานทุกคนต้องมีทั้ง <span className="font-medium text-gray-900">LINE</span> และ{' '}
          <span className="font-medium text-gray-900">Discord</span> เชื่อมต่อไว้
          เพื่อให้ระบบแจ้งเตือนถึงตัวคุณได้โดยตรง
        </p>

        <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-sm text-gray-600">
          <li>· แจ้งวันเกิด</li>
          <li>· เตือนเมื่อลืมเช็คเอาท์</li>
          <li>· แจ้งผลอนุมัติการลา</li>
        </ul>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{ERRORS[error] ?? ERRORS.unknown}</span>
          </div>
        )}

        <a href="/api/auth/discord/start" className="mt-6 block">
          <Button variant="primary" className="w-full">
            เชื่อมต่อ Discord
          </Button>
        </a>

        <p className="mt-4 text-xs text-gray-500">
          ระบบขอแค่ชื่อและรหัสบัญชีของคุณ ไม่สามารถอ่านข้อความหรือโพสต์แทนคุณได้
        </p>
      </div>
    </div>
  )
}

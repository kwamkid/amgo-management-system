'use client'

import { useEffect, useRef, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CircleCheck } from 'lucide-react'
import { signInBoth } from '@/lib/auth/dual-session'
import { isStandalone } from '@/lib/push/client'
import { offerHandoff, clearPwaLogin } from '@/lib/auth/pwaHandoff'
import { NONCE_RE } from '@/lib/auth/pwaState'

/**
 * แลก token_hash จาก LINE callback เป็น session ของ Supabase
 *
 * ต้องทำฝั่ง client เพราะ verifyOtp เป็นตัวที่เขียน cookie session ลงเบราว์เซอร์
 *
 * ── ล็อกอินเริ่มจากแอปที่ติดตั้ง (`?pwa=1&nonce=`) แต่หน้านี้เปิดใน Chrome/Safari ──
 * แอป LINE ยิง callback ให้เบราว์เซอร์หลัก ไม่ใช่แอป · ถ้าแลก token ที่นี่ session
 * จะไปอยู่ผิดที่ (iOS: Safari กับแอปคนละถังคุกกี้ — แอปไม่ได้ล็อกอิน) จึงไม่แลก
 * แต่ฝาก token ไว้ที่ /api/auth/handoff ตาม nonce แล้วบอกให้กลับไปที่แอป
 * ซึ่งกำลังวนถามอยู่ · ถ้าหน้านี้เปิด "ในแอป" อยู่แล้ว (isStandalone) ก็แลกตามปกติ
 */
function VerifyAuth() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [handoff, setHandoff] = useState<'ok' | null>(null)
  /**
   * แลก token ได้ครั้งเดียวต่อการเข้าหน้านี้หนึ่งครั้ง
   *
   * ── ทำไมต้องกั้น (พบ 21 ส.ค. 69) ────────────────────────────────
   * effect นี้มี router.replace() + router.refresh() อยู่ข้างใน ซึ่งทำให้
   * คอมโพเนนต์วาดใหม่ · เดิมใส่ [router, params] เป็น dependency effect
   * จึงรันซ้ำแล้วเรียก verifyOtp อีกรอบ — **verifyOtp ทุกครั้งสร้าง session
   * ใหม่ในฐานข้อมูล** ผลคือล็อกอินครั้งเดียวได้ session 2-4 อัน
   * (วัดจริง: ปู 3.8 อัน/ครั้ง · หน่อย 2.3 อัน/ครั้ง)
   *
   * React โหมดพัฒนายังรัน effect สองรอบอีกชั้นด้วย
   */
  const exchanged = useRef(false)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true

    const run = async () => {
      const tokenHash = params.get('token_hash')
      if (!tokenHash) {
        router.replace('/login?error=no_token')
        return
      }
      const next = params.get('next')
      const safeNext = next && next.startsWith('/') ? next : null

      const nonce = params.get('nonce')
      if (params.get('pwa') === '1' && nonce && NONCE_RE.test(nonce) && !isStandalone()) {
        // ฝากให้แอปมารับ — ฝากไม่สำเร็จค่อยแลกเองที่นี่ (อย่างน้อยเบราว์เซอร์นี้ก็เข้าได้)
        if (await offerHandoff(nonce, tokenHash, safeNext)) {
          setHandoff('ok')
          return
        }
      }

      try {
        await signInBoth({ tokenHash })
        clearPwaLogin() // ล็อกอินจบในแอปเอง (ไม่ผ่าน handoff) — ล้างตั๋วที่จำไว้ทิ้ง
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(msg)
        setError(msg)
        setTimeout(() => router.replace('/login?error=invalid_token'), 1500)
        return
      }

      // refresh() เพื่อให้ Server Component อ่าน cookie ใหม่เห็น session
      // ล็อกอินสำเร็จแล้วไปไหนต่อ — ปกติ /dashboard
      // แต่ถ้ายังทำสิ่งที่ต้องทำก่อนใช้งานไม่ครบ จะถูกส่งมาพร้อม next=/setup
      router.replace(safeNext ?? '/dashboard')
      router.refresh()
    }
    run()
    // ตั้งใจให้ว่าง — ต้องรันครั้งเดียวตอนเข้าหน้า ไม่ใช่ทุกครั้งที่วาดใหม่
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (handoff === 'ok') {
    // เลขขั้นตอนเป็นวงกลมขนาดเท่าบรรทัด (leading-7 = 28px · วง 24px + mt-0.5) จะได้ตรงกับ
    // บรรทัดแรกของข้อความเสมอ ไม่ลอยขึ้นไปมุมบนเมื่อข้อความตัดสองบรรทัด
    const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
      <li className="flex gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
          {n}
        </span>
        <span className="text-base leading-7 text-amber-950">{children}</span>
      </li>
    )
    return (
      <div className="text-center">
        <CircleCheck size={56} className="mx-auto mb-4 text-[#06C755]" />
        <h2 className="text-2xl font-semibold text-gray-900">ยืนยันตัวตนกับ LINE แล้ว</h2>
        <p className="mt-2 text-lg text-gray-700">ระบบจะเข้าแอปให้เองภายในไม่กี่วินาที</p>

        <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-left">
          <p className="text-base font-semibold text-amber-900">ขั้นตอนต่อไป</p>
          <ol className="mt-2 space-y-2">
            <Step n={1}>
              สลับกลับไปที่ <b className="font-semibold">แอป AMGO</b> — เลือกจากรายการแอปล่าสุด
            </Step>
            <Step n={2}>ปิดหน้านี้ได้เลย</Step>
          </ol>
        </div>

        <p className="mt-4 text-base leading-7 text-gray-600">
          ถ้าแอปยังขึ้นหน้าเข้าสู่ระบบอยู่ ให้กดปุ่ม LINE ในแอปอีกครั้ง
        </p>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent" />
      <h2 className="text-xl font-semibold text-gray-800">
        {error ? 'ยืนยันตัวตนไม่สำเร็จ' : 'กำลังยืนยันตัวตน…'}
      </h2>
      <p className="mt-2 text-gray-600">{error ?? 'กรุณารอสักครู่'}</p>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-lg sm:p-8">
        <Suspense
          fallback={
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-400 border-r-transparent" />
            </div>
          }
        >
          <VerifyAuth />
        </Suspense>
      </div>
    </div>
  )
}

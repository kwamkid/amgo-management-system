'use client'

// หน้าเข้าสู่ระบบ — หน้าแรกที่ทุกคนเห็น
//
// โทนมืด "high-tech" ตามที่เจ้าของขอ (4 ก.ย. 69): พื้นเกือบดำอุ่น + ตารางเส้นจาง +
// แสงส้มแบรนด์ + การ์ดกระจก · ปุ่ม LINE สูง 56px ใช้โลโก้ LINE จริง สีเขียวทางการ
// #06C755 · ตัวอักษรเล็กสุด 14px ทั้งหน้า
//
// ── ล็อกอินจากแอปที่ติดตั้ง (PWA) ───────────────────────────────────────
// แอป LINE ยิง callback ไปที่เบราว์เซอร์หลักของเครื่อง ไม่ใช่แอป (เจอจริง 4 ก.ย. 69:
// "กด login จาก LINE แล้วมันเด้งกลับไป Chrome") · iOS หนักกว่า: Safari กับแอปคนละ
// ถังคุกกี้ session ที่ได้ในนั้นแอปใช้ไม่ได้เลย
// ทางแก้: ตอนกดจากแอป ฝัง nonce ไว้ใน state ที่วิ่งผ่าน LINE → หน้า verify ใน
// เบราว์เซอร์ฝาก token ไว้ที่ server ตาม nonce → หน้านี้ (ยังเปิดอยู่ในแอป) วนถาม
// ด้วย nonce ของตัวเองแล้วแลกเป็น session **ในแอป** เอง (ดู lib/auth/pwaHandoff.ts)
//
// หน้านี้อยู่นอก layout หลังบ้าน จึงตั้งพื้นหลังเองได้ (ทั้งแอปล็อกโหมดสว่างอยู่)
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import { signInBoth } from '@/lib/auth/dual-session'
import { useLoading } from '@/lib/contexts/LoadingContext'
import { createClient } from '@/lib/supabase/client'
import { LineIcon } from '@/components/icons/LineIcon'
import { isStandalone } from '@/lib/push/client'
import { buildLineState, newNonce } from '@/lib/auth/pwaState'
import { startPwaLogin, pendingPwaLogin, clearPwaLogin, claimHandoff } from '@/lib/auth/pwaHandoff'

const ERROR_TEXT: Record<string, string> = {
  access_denied: 'คุณปฏิเสธการเข้าถึงข้อมูล',
  auth_failed: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่',
  no_code: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่',
  no_token: 'ลิงก์ยืนยันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
  invalid_token: 'ลิงก์ยืนยันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  account_deleted: 'บัญชีนี้ถูกลบออกจากระบบแล้ว',
  account_ended: 'บัญชีนี้พ้นสภาพพนักงานแล้ว',
  account_inactive: 'บัญชียังไม่ได้รับอนุมัติ — ติดต่อ HR',
  inactive: 'บัญชียังไม่ได้รับอนุมัติ — ติดต่อ HR',
}

function LoginForm() {
  const { showLoading, hideLoading } = useLoading()
  const [isLoading, setIsLoading] = useState(false)
  const [devLoading, setDevLoading] = useState(false)
  const [error, setError] = useState('')
  /** nonce ที่กำลังรอ session จากเบราว์เซอร์ (เฉพาะเมื่อกดจากแอปที่ติดตั้ง) */
  const [pending, setPending] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const isDev = process.env.NODE_ENV === 'development'

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) setError(ERROR_TEXT[errorParam] ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่')
  }, [searchParams])

  useEffect(() => {
    // กลับมาจาก LINE (เปิดในชีต/แท็บซ้อนบนแอป) ม่านโหลดเต็มจอต้องไม่ค้าง
    hideLoading()
    // ล็อกอินอยู่แล้ว (เช่น Android แชร์คุกกี้กับ Chrome) → เข้าเลย ไม่ต้องกดซ้ำ
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) window.location.replace('/dashboard')
      })
      .catch(() => {})
    const nonce = pendingPwaLogin()
    if (nonce) setPending(nonce)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // วนถาม server ว่า token มาหรือยัง — ทุก 2.5 วิ + ทันทีที่กลับมาเห็นหน้าจอ · เลิกรอใน 10 นาที
  useEffect(() => {
    if (!pending) return
    let stopped = false
    const tick = async () => {
      if (stopped) return
      const got = await claimHandoff(pending)
      if (!got || stopped) return
      stopped = true
      try {
        await signInBoth({ tokenHash: got.tokenHash })
        clearPwaLogin()
        window.location.replace(got.next && got.next.startsWith('/') ? got.next : '/dashboard')
      } catch (e) {
        console.error(e)
        clearPwaLogin()
        setPending(null)
        setIsLoading(false)
        setError('เข้าสู่ระบบไม่สำเร็จ กรุณากดปุ่ม LINE อีกครั้ง')
      }
    }
    tick()
    const id = setInterval(tick, 2500)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      setIsLoading(false) // กลับมาแล้ว — ปุ่มต้องกดซ้ำได้ถ้ารอบก่อนไม่สำเร็จ
      tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const giveUp = setTimeout(() => {
      stopped = true
      clearPwaLogin()
      setPending(null)
      setIsLoading(false)
    }, 10 * 60 * 1000)
    return () => {
      stopped = true
      clearInterval(id)
      clearTimeout(giveUp)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [pending])

  const handleDevLogin = async () => {
    try {
      setDevLoading(true)
      const res = await fetch('/api/auth/dev-login', { method: 'POST' })
      if (!res.ok) throw new Error('Dev login failed')
      const { tokenHash } = await res.json()
      await signInBoth({ tokenHash })
      window.location.replace('/dashboard')
    } catch (err) {
      setError('Dev login ล้มเหลว ลองใหม่อีกครั้ง')
      console.error(err)
    } finally {
      setDevLoading(false)
    }
  }

  const handleLineLogin = () => {
    setError('')
    const standalone = isStandalone()
    const nonce = standalone ? startPwaLogin() : newNonce()
    const state = buildLineState({ nonce, pwa: standalone })
    sessionStorage.setItem('line_auth_state', state)

    // ในแอป: ห้ามเปิดม่านโหลดเต็มจอ — LINE เปิดซ้อนบนหน้านี้ กลับมาแล้วม่านจะค้าง
    if (standalone) setPending(nonce)
    else showLoading()
    setIsLoading(true)

    const lineAuthUrl =
      `https://access.line.me/oauth2/v2.1/authorize?` +
      `response_type=code&` +
      `client_id=${process.env.NEXT_PUBLIC_LINE_CHANNEL_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL + '/api/auth/line/callback')}&` +
      `state=${encodeURIComponent(state)}&` +
      `scope=profile%20openid`

    window.location.href = lineAuthUrl
  }

  const cancelPending = () => {
    clearPwaLogin()
    setPending(null)
    setIsLoading(false)
  }

  return (
    <>
      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      )}

      {/* ปุ่ม LINE — สีเขียวทางการของ LINE · สูง 56px · โลโก้ซ้าย */}
      <button
        onClick={handleLineLogin}
        disabled={isLoading}
        className="lg-line-btn flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#06C755] px-5 text-base font-semibold text-white transition-all hover:bg-[#05B34C] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? <Loader2 size={26} className="animate-spin" /> : <LineIcon size={28} />}
        {isLoading ? 'กำลังเปิด LINE…' : pending ? 'เปิด LINE อีกครั้ง' : 'เข้าสู่ระบบด้วย LINE'}
      </button>

      {pending && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-gray-300">
          <Loader2 size={16} className="-mt-0.5 mr-2 inline animate-spin text-amber-400" />
          รอการยืนยันจาก LINE — ยืนยันในแอป LINE เสร็จแล้วกลับมาหน้านี้ ระบบจะเข้าให้เอง
          <button onClick={cancelPending} className="ml-2 text-gray-400 underline underline-offset-2 hover:text-white">
            ยกเลิก
          </button>
        </div>
      )}

      {isDev && (
        <button
          onClick={handleDevLogin}
          disabled={devLoading}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-amber-400/60 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-400/10 disabled:opacity-60"
        >
          🛠️ {devLoading ? 'กำลังเข้าสู่ระบบ…' : 'Dev Login (Admin)'}
        </button>
      )}
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="lg-root relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-white">
      <style>{`
        .lg-root {
          background:
            radial-gradient(60% 50% at 15% 10%, rgba(249, 161, 27, 0.22), transparent 70%),
            radial-gradient(50% 45% at 90% 90%, rgba(239, 74, 34, 0.18), transparent 70%),
            #0f0b09;
        }
        /* ตารางเส้นจาง ๆ ให้ความรู้สึก "แผงควบคุม" */
        .lg-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: radial-gradient(70% 70% at 50% 45%, #000 40%, transparent 100%);
          -webkit-mask-image: radial-gradient(70% 70% at 50% 45%, #000 40%, transparent 100%);
        }
        /* เส้นสแกนวิ่งลงช้า ๆ */
        .lg-scan {
          background: linear-gradient(180deg, transparent, rgba(249, 161, 27, 0.10), transparent);
          height: 28vh;
          animation: lg-scan 9s linear infinite;
        }
        @keyframes lg-scan { from { transform: translateY(-40vh); } to { transform: translateY(120vh); } }
        /* วงแหวนหมุนรอบโลโก้ */
        .lg-ring::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 9999px;
          background: conic-gradient(from 0deg, transparent 0 60%, rgba(249, 161, 27, 0.9) 85%, transparent 100%);
          animation: lg-spin 6s linear infinite;
        }
        @keyframes lg-spin { to { transform: rotate(360deg); } }
        .lg-dot { animation: lg-pulse 2s ease-in-out infinite; }
        @keyframes lg-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(6, 199, 85, 0.5); } 50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(6, 199, 85, 0); } }
        .lg-line-btn { box-shadow: 0 0 0 1px rgba(6, 199, 85, 0.35), 0 10px 32px rgba(6, 199, 85, 0.30); }
        .lg-line-btn:hover { box-shadow: 0 0 0 1px rgba(6, 199, 85, 0.5), 0 12px 36px rgba(6, 199, 85, 0.42); }
        @media (prefers-reduced-motion: reduce) {
          .lg-scan, .lg-ring::before, .lg-dot { animation: none; }
        }
      `}</style>

      {/* ฉากหลัง */}
      <div className="lg-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="lg-scan pointer-events-none absolute inset-x-0 top-0" aria-hidden />

      <div className="relative w-full max-w-md">
        {/* การ์ดกระจก */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-10">
          {/* โลโก้ + ชื่อ */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="lg-ring relative mb-5 h-24 w-24 rounded-full">
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#0f0b09]">
                <Image src="/amgo-logo.svg" alt="AMGO" width={72} height={72} priority className="h-[72px] w-[72px]" />
              </div>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">AMGO</h1>
            <p className="mt-1 font-mono text-sm uppercase tracking-[0.22em] text-amber-400">Management System</p>
            <p className="mt-3 text-base text-gray-300">ระบบบริหารจัดการพนักงาน</p>
          </div>

          <Suspense
            fallback={
              <div className="flex h-14 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          <p className="mt-5 text-center text-sm text-gray-400">
            ใช้บัญชี LINE ส่วนตัว · สำหรับพนักงาน AMGO เท่านั้น
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/10 pt-5 font-mono text-sm text-gray-500">
            <span className="lg-dot inline-block h-2 w-2 rounded-full bg-[#06C755]" />
            SECURE · LINE LOGIN
          </div>
        </div>

        <p className="mt-6 px-2 text-center text-sm leading-6 text-gray-500">
          <ShieldCheck size={16} className="-mt-0.5 mr-1.5 inline" />
          การเชื่อมต่อเข้ารหัส · ยังเข้าไม่ได้ ติดต่อ HR เพื่อขออนุมัติบัญชี
        </p>
      </div>
    </div>
  )
}

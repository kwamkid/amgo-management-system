'use client'

// หน้าเข้าสู่ระบบ — หน้าแรกที่ทุกคนเห็น
//
// หน้าตาตามที่เจ้าของขอ (30 ต.ค. 69): รูปถ่ายท้องฟ้าทางช้างเผือก + กระท่อมไม้
// (public/images/login-night-sky.jpg · เจ้าของส่งมาเอง) · จอใหญ่แบ่งซ้าย-ขวา: รูปซ้าย
// ฝั่งล็อกอินขวาโทนสว่าง · มือถือ: รูปเป็นพื้นหลังเต็มจอ การ์ดขาวซ้อนทับ · การ์ดไม่มีเงา
// ปุ่ม LINE สูง 56px ใช้โลโก้ LINE จริง สีเขียวทางการ #06C755 · ตัวอักษรเล็กสุด 14px
// (โทนมืด 4 ก.ย. 69 และฉากดาวเคราะห์ SVG เลิกใช้แล้ว)
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
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import { signInBoth } from '@/lib/auth/dual-session'
import { useLoading } from '@/lib/contexts/LoadingContext'
import { createClient } from '@/lib/supabase/client'
import { LineIcon } from '@/components/icons/LineIcon'
import { DiscordIcon } from '@/components/icons/DiscordIcon'
import { isStandalone } from '@/lib/push/client'
import { buildLineState, newNonce } from '@/lib/auth/pwaState'
import { startPwaLogin, pendingPwaLogin, clearPwaLogin, claimHandoff } from '@/lib/auth/pwaHandoff'
import { liffLoginUrl } from '@/lib/auth/liff'

/** มือถือที่น่าจะมีแอป LINE — iPadOS รายงานตัวเป็น Mac จึงดูจอสัมผัสด้วย */
function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

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
  discord_not_linked: 'บัญชี Discord นี้ยังไม่ได้ผูกกับพนักงาน — เข้าด้วย LINE แล้วผูก Discord ก่อน',
  discord_failed: 'เข้าสู่ระบบด้วย Discord ไม่สำเร็จ กรุณาลองใหม่',
  discord_off: 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย Discord',
}

function LoginForm() {
  const { showLoading, hideLoading } = useLoading()
  const [isLoading, setIsLoading] = useState(false)
  const [devLoading, setDevLoading] = useState(false)
  const [error, setError] = useState('')
  /** nonce ที่กำลังรอ session จากเบราว์เซอร์ (เฉพาะเมื่อกดจากแอปที่ติดตั้ง) */
  const claiming = useRef(false)
  const [pending, setPending] = useState<string | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [mobile, setMobile] = useState(false)
  const searchParams = useSearchParams()
  const isDev = process.env.NODE_ENV === 'development'

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) setError(ERROR_TEXT[errorParam] ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่')
  }, [searchParams])

  useEffect(() => {
    // กลับมาจาก LINE (เปิดในชีต/แท็บซ้อนบนแอป) ม่านโหลดเต็มจอต้องไม่ค้าง
    hideLoading()
    setStandalone(isStandalone())
    setMobile(isMobile())
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
    let failures = 0
    const fail = (message: string) => {
      stopped = true
      clearPwaLogin()
      setPending(null)
      setIsLoading(false)
      setError(message)
    }
    const tick = async () => {
      if (stopped || claiming.current || document.visibilityState === 'hidden') return
      claiming.current = true
      try {
        // Android อาจล็อกอินสำเร็จใน Chrome ระหว่างหน้านี้อยู่เบื้องหลัง
        const { data } = await createClient().auth.getSession()
        if (stopped) return
        if (data.session) {
          stopped = true
          clearPwaLogin()
          window.location.replace('/dashboard')
          return
        }
        if (pendingPwaLogin() !== pending) {
          fail('หมดเวลารอการยืนยัน กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง')
          return
        }
        const got = await claimHandoff(pending)
        if (stopped) return
        failures = 0
        if (!got) return
        stopped = true
        try {
          await signInBoth({ tokenHash: got.tokenHash })
          clearPwaLogin()
          window.location.replace(got.next && got.next.startsWith('/') && !got.next.startsWith('//') ? got.next : '/dashboard')
        } catch {
          fail('เข้าสู่ระบบไม่สำเร็จ กรุณากดปุ่ม LINE อีกครั้ง')
        }
      } catch {
        if (!stopped && ++failures >= 3) {
          fail('รับผลยืนยันจาก LINE ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
        }
      } finally {
        claiming.current = false
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
    window.addEventListener('pageshow', onVisible)
    const giveUp = setTimeout(() => {
      if (!stopped) fail('หมดเวลารอการยืนยัน กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง')
    }, 10 * 60 * 1000)
    return () => {
      stopped = true
      clearInterval(id)
      clearTimeout(giveUp)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
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

  /**
   * @param stayInApp ไม่เด้งไปแอป LINE — ใช้หน้าเว็บของ LINE ในแผ่นซ้อนของแอปแทน
   *   (พารามิเตอร์ disable_*_auto_login ของ LINE) · ต้องกรอกอีเมล+รหัสผ่าน LINE
   *   แต่กลับเข้าแอปเองโดยไม่ผ่าน Chrome/Safari · iPhone ไม่มีทางให้หน้าเว็บสั่งเปิด
   *   แอปที่ติดตั้ง — นี่คือทางเดียวที่ "ไม่ต้องสลับแอปเอง"
   */
  const handleLineLogin = (stayInApp = false) => {
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
      `scope=profile%20openid` +
      (stayInApp ? `&disable_ios_auto_login=true&disable_auto_login=true` : '')

    window.location.href = lineAuthUrl
  }

  /**
   * มือถือ: เปิดหน้า /liff ในแอป LINE แทนหน้า login ของ LINE (เพิ่ม 28 ต.ค. 69)
   * แอป LINE รู้อยู่แล้วว่าเป็นใคร — ไม่มีหน้ากรอกอีเมล ไม่โดน 2FA ของ channel
   * (ต้นเหตุที่ iPhone ของอ๋อมแอ๋มเข้าไม่ได้) · session กลับมาทาง handoff ตาม nonce
   * แบบเดียวกับแอปที่ติดตั้ง ทั้งในแอปที่ติดตั้งและ Safari/Chrome
   */
  const handleLiffLogin = () => {
    setError('')
    const nonce = startPwaLogin()
    setPending(nonce)
    setIsLoading(true)
    window.location.href = liffLoginUrl(nonce)
  }

  // สำรองให้คนที่ LINE เข้าไม่ได้ (เจอจริง 27 ต.ค. 69: iPhone ของอ๋อมแอ๋มเข้า LINE
  // ไม่ได้ทุกทาง เข้าได้แค่บนคอม) · ใช้ได้เฉพาะคนที่ผูก Discord ไว้แล้วตอน /setup
  const handleDiscordLogin = () => {
    setError('')
    const standalone = isStandalone()
    const q = new URLSearchParams({ mode: 'login' })
    if (standalone) {
      const nonce = startPwaLogin()
      q.set('nonce', nonce)
      setPending(nonce)
    } else showLoading()
    setIsLoading(true)
    window.location.href = `/api/auth/discord/start?${q}`
  }

  const cancelPending = () => {
    clearPwaLogin()
    setPending(null)
    setIsLoading(false)
  }

  return (
    <>
      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#F03D0E]/30 bg-[#F03D0E]/[0.07] px-4 py-3 text-sm text-[#9E2206]">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#F03D0E]" />
          <span>{error}</span>
        </div>
      )}

      {/* ปุ่ม LINE — สีเขียวทางการของ LINE · สูง 56px · โลโก้ซ้าย */}
      <button
        onClick={() => (mobile ? handleLiffLogin() : handleLineLogin(false))}
        disabled={isLoading}
        className="lg-line-btn flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#06C755] px-5 text-base font-semibold text-white transition-all hover:bg-[#05B34C] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? <Loader2 size={26} className="animate-spin" /> : <LineIcon size={28} />}
        {isLoading ? 'กำลังเปิด LINE…' : pending ? 'เปิด LINE อีกครั้ง' : 'เข้าสู่ระบบด้วย LINE'}
      </button>

      {mobile && (
        <button
          onClick={() => handleLineLogin(false)}
          disabled={isLoading}
          className="mt-3 w-full text-center text-sm text-gray-500 underline-offset-2 hover:text-[#F03D0E] hover:underline disabled:opacity-60"
        >
          ใช้หน้าเข้าสู่ระบบของ LINE แทน
        </button>
      )}

      {standalone && (
        <button
          onClick={() => handleLineLogin(true)}
          disabled={isLoading}
          className="mt-3 w-full text-center text-sm text-gray-500 underline-offset-2 hover:text-[#F03D0E] hover:underline disabled:opacity-60"
        >
          เข้าสู่ระบบโดยไม่ออกจากแอป (กรอกอีเมล LINE)
        </button>
      )}

      {pending && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
          <Loader2 size={16} className="-mt-0.5 mr-2 inline animate-spin text-[#F03D0E]" />
          รอการยืนยัน — ยืนยันใน LINE หรือ Discord เสร็จแล้วกลับมาหน้านี้ ระบบจะเข้าให้เอง
          <button onClick={cancelPending} className="ml-2 text-gray-500 underline underline-offset-2 hover:text-[#F03D0E]">
            ยกเลิก
          </button>
        </div>
      )}

      {isDev && (
        <button
          onClick={handleDevLogin}
          disabled={devLoading}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#F03D0E]/50 text-sm font-medium text-[#9E2206] transition-colors hover:bg-[#F03D0E]/[0.06] disabled:opacity-60"
        >
          🛠️ {devLoading ? 'กำลังเข้าสู่ระบบ…' : 'Dev Login (Admin)'}
        </button>
      )}

      {/* ทางสำรองเท่านั้น — เจ้าของไม่อยากให้เป็นทางหลัก (บัญชี Discord ยืมกันได้ง่ายกว่า LINE)
          จึงเหลือแค่ไอคอนเล็ก ๆ ด้านล่าง */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={handleDiscordLogin}
          disabled={isLoading}
          aria-label="เข้าสู่ระบบด้วย Discord"
          title="เข้าสู่ระบบด้วย Discord"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#5865F2] disabled:opacity-50"
        >
          <DiscordIcon size={18} />
        </button>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-[#FFFCFA] text-[#1A120E] lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <style>{`
        .lg-dot { animation: lg-pulse 2s ease-in-out infinite; }
        @keyframes lg-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(6, 199, 85, 0.45); } 50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(6, 199, 85, 0); } }
        /* รูปค่อย ๆ ซูมเข้าช้า ๆ ให้รู้สึกมีชีวิต */
        .lg-photo { animation: lg-zoom 40s ease-in-out infinite alternate; }
        @keyframes lg-zoom { from { transform: scale(1); } to { transform: scale(1.08); } }
        @media (prefers-reduced-motion: reduce) { .lg-dot, .lg-photo { animation: none; } }
      `}</style>

      {/* รูปท้องฟ้า — จอใหญ่: แผงซ้ายเต็มความสูง · มือถือ: พื้นหลังเต็มจอ */}
      <div className="absolute inset-0 overflow-hidden lg:relative lg:inset-auto lg:min-h-screen">
        <Image
          src="/images/login-night-sky.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="lg-photo object-cover object-[50%_100%] lg:object-[50%_80%]"
        />
        {/* ไล่เงาด้านล่างให้ตัวหนังสือบนรูปอ่านออก */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10 lg:from-black/60 lg:via-transparent lg:to-black/5" />
        <div className="absolute inset-x-0 bottom-0 hidden p-10 text-white lg:block xl:p-14">
          <p className="font-mono text-sm uppercase tracking-[0.22em] text-white/70">AMGO Management System</p>
          <p className="mt-3 max-w-md text-2xl font-semibold leading-snug xl:text-3xl">ระบบบริหารจัดการพนักงาน</p>
          <p className="mt-2 max-w-md text-base text-white/75">เช็คอิน · ลางาน · ส่งของ · งานของทีม — ครบในที่เดียว</p>
        </div>
      </div>

      {/* ฝั่งล็อกอิน */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-md">
          {/* การ์ดขาว (บนมือถือเป็นกระจกฝ้าทับรูป · บนจอใหญ่กลืนไปกับพื้นขาว) */}
          <div className="rounded-3xl border border-[#F03D0E]/15 bg-white/90 p-8 backdrop-blur-xl sm:p-10 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-0">
            {/* โลโก้ + ชื่อ */}
            <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#F03D0E]/20 bg-white">
                <Image src="/amgo-logo.svg" alt="AMGO" width={64} height={64} priority className="h-16 w-16" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#1A120E]">AMGO</h1>
              <p className="mt-1 font-mono text-sm uppercase tracking-[0.22em] text-[#F03D0E]">Management System</p>
              <p className="mt-3 text-base text-gray-600">เข้าสู่ระบบเพื่อเริ่มงานวันนี้</p>
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

            <p className="mt-5 text-center text-sm text-gray-500 lg:text-left">
              ใช้บัญชี LINE ส่วนตัว · สำหรับพนักงาน AMGO เท่านั้น
            </p>

            <div className="mt-6 flex items-center justify-center gap-2 border-t border-gray-200 pt-5 font-mono text-sm text-gray-500 lg:justify-start">
              <span className="lg-dot inline-block h-2 w-2 rounded-full bg-[#06C755]" />
              SECURE · LINE LOGIN
            </div>
          </div>

          <p className="mt-6 px-2 text-center text-sm leading-6 text-white/80 lg:px-0 lg:text-left lg:text-gray-500">
            <ShieldCheck size={16} className="-mt-0.5 mr-1.5 inline" />
            การเชื่อมต่อเข้ารหัส · ยังเข้าไม่ได้ ติดต่อ HR เพื่อขออนุมัติบัญชี
          </p>
        </div>
      </div>
    </div>
  )
}

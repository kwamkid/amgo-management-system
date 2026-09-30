'use client'

// การ์ด "เปิดแจ้งเตือน" บน Dashboard — ขึ้นจนกว่าจะเปิด ปิดทิ้งไม่ได้
//
// ── ทำไมต้องมี (เจ้าของสั่ง 30 ก.ย. 69) ──────────────────────────────
// เปิดแจ้งเตือนอยู่แค่ 1 จาก 41 คน — สวิตช์อยู่ลึกในหน้าโปรไฟล์ ไม่มีใครเข้าไปเจอ
// "ให้มีปุ่มตั้งอยู่ที่หน้า dashboard ของพนักงานเลย ให้เห็นง่าย ๆ แล้วบอกให้กดซะ"
//
// ขึ้นเฉพาะคนที่ยังไม่มีเครื่องไหนเปิดเลย (push_subscriptions ของตัวเอง = 0)
// เปิดบนมือถือแล้วมาเปิดคอม จะไม่ถูกตามซ้ำ · ปุ่มเปลี่ยนตามสภาพเครื่อง:
// iPhone ต้องติดตั้งก่อน · เปิดจาก LINE ต้องไปเปิดใน Safari/Chrome · เคยกดปฏิเสธ
// ต้องไปเปิดในตั้งค่า

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BellRing, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/aoo'
import { InfoPanel } from '@/components/shared'
import { enablePush, getPushState, inAppBrowser, type PushState } from '@/lib/push/client'

export default function NotifySetupCard() {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [needed, setNeeded] = useState(false)
  const [state, setState] = useState<PushState | null>(null)
  const [inApp, setInApp] = useState<'line' | 'facebook' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!userData?.id) return
    let alive = true
    setInApp(inAppBrowser())
    Promise.all([
      createClient().from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userData.id),
      getPushState(),
    ]).then(([subs, s]) => {
      if (!alive) return
      setState(s)
      // เครื่องไหนสักเครื่องเปิดไว้แล้ว = พอ · อ่านไม่ได้ให้ถือว่ายังไม่เปิด (ถามเกินดีกว่าตกหล่น)
      setNeeded(s !== 'subscribed' && !((subs.count ?? 0) > 0))
    })
    return () => {
      alive = false
    }
  }, [userData?.id])

  if (!needed || !state) return null

  const turnOn = async () => {
    setBusy(true)
    try {
      const next = await enablePush()
      setState(next)
      if (next === 'subscribed') {
        showToast('เปิดแจ้งเตือนแล้ว ขอบคุณครับ 🙏')
        setNeeded(false)
      } else if (next === 'denied') {
        showToast('เครื่องนี้ปิดการแจ้งเตือนไว้ — ทำตามขั้นตอนในการ์ดเพื่อเปิด', 'error')
      }
    } catch {
      showToast('เปิดแจ้งเตือนไม่สำเร็จ ลองอีกครั้ง', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <InfoPanel tone="sky" className="mb-5">
      <div className="flex items-start gap-3">
        <span className="aoo-title-icon mt-0.5" data-tone="sky">
          <BellRing size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-gray-900">กดเปิดแจ้งเตือนหน่อยครับ</h2>
          <p className="mt-0.5 text-sm text-gray-700">
            จะได้รู้ทันทีเมื่อใบลา/ใบสลับวันหยุดอนุมัติแล้ว และเตือนเวลาลืมเช็คเอาท์
          </p>

          <div className="mt-3">
            {inApp ? (
              // หน้า /install มีขั้นตอนออกจาก LINE พร้อมไอคอนของจริงแยก iPhone/Android อยู่แล้ว
              <Link href="/install">
                <Button icon="ExternalLink">
                  เปิดจาก {inApp === 'line' ? 'LINE' : 'Facebook'} อยู่ — ดูวิธีเปิดในเบราว์เซอร์
                </Button>
              </Link>
            ) : state === 'ios-needs-install' ? (
              <Link href="/install">
                <Button icon="Download">ติดตั้งแอปก่อน (iPhone ต้องติดตั้งถึงจะแจ้งเตือนได้)</Button>
              </Link>
            ) : state === 'denied' ? (
              <Guide text="เครื่องนี้เคยกดไม่อนุญาตไว้ — เข้าตั้งค่าของเบราว์เซอร์ → การแจ้งเตือน → อนุญาต app.amgovenger.com แล้วกลับมากดปุ่มนี้อีกครั้ง" />
            ) : state === 'unsupported' ? (
              <Guide text="เครื่อง/เบราว์เซอร์นี้รับแจ้งเตือนไม่ได้ — เปิดแอป AMGO จากมือถือแล้วกดปุ่มนี้ที่นั่น" />
            ) : (
              <Button onClick={turnOn} loading={busy}>
                {!busy && <BellRing size={16} />}
                {busy ? 'กำลังเปิด…' : 'เปิดแจ้งเตือน'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </InfoPanel>
  )
}

function Guide({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1 rounded-lg bg-white/70 px-3 py-2 text-sm text-gray-800">
      <ChevronRight size={16} className="mt-0.5 shrink-0" />
      {text}
    </p>
  )
}

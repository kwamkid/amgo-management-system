'use client'

// การ์ด "แอปบนอุปกรณ์นี้" ในหน้าโปรไฟล์ — สองเรื่องที่ผูกกับ *เครื่อง* ไม่ใช่บัญชี:
//   1. ติดตั้งเป็นแอป (Android/เดสก์ท็อปมีปุ่ม · iPhone ต้องกดแชร์เอง — Safari ไม่ให้เว็บสั่ง)
//   2. เปิด/ปิดแจ้งเตือนของเครื่องนี้ (+ ปุ่มส่งทดสอบ)
// ทำไมอยู่หน้าโปรไฟล์: เป็นหน้าเดียวที่ทุกตำแหน่งเข้าได้และเป็น "ของฉัน" อยู่แล้ว
import { useEffect, useState } from 'react'
import { Smartphone, Download, Share, Check, BellRing } from 'lucide-react'
import { Toggle } from '@/components/aoo'
import { useToast } from '@/hooks/useToast'
import { getPushState, enablePush, disablePush, isIos, isStandalone, type PushState } from '@/lib/push/client'

// เบราว์เซอร์ที่รองรับจะยิง event นี้เมื่อเว็บผ่านเกณฑ์ติดตั้ง — เก็บไว้เรียกตอนผู้ใช้กดปุ่ม
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
      <span className="flex items-center gap-2 text-sm text-gray-500">
        <span className="text-gray-400">{icon}</span>
        {label}
      </span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export default function DeviceCard() {
  const { showToast } = useToast()
  const [standalone, setStandalone] = useState<boolean | null>(null)
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null)
  const [push, setPush] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setStandalone(isStandalone())
    getPushState().then(setPush)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstallEvt(null)
      showToast('ติดตั้งแอป AMGO แล้ว — เปิดจากไอคอนบนหน้าจอโฮมได้เลย')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [showToast])

  const install = async () => {
    if (!installEvt) return
    await installEvt.prompt()
    const { outcome } = await installEvt.userChoice
    if (outcome === 'accepted') setInstallEvt(null)
  }

  const togglePush = async (on: boolean) => {
    setBusy(true)
    try {
      const next = on ? await enablePush() : await disablePush()
      setPush(next)
      if (on && next === 'subscribed') showToast('เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว')
      if (on && next === 'denied') showToast('การแจ้งเตือนถูกปิดไว้ในเบราว์เซอร์ — เปิดได้ในตั้งค่าเว็บไซต์', 'error')
      if (!on) showToast('ปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว')
    } catch (err) {
      console.error('[Push] toggle:', err)
      showToast('เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง', 'error')
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      showToast('ส่งแล้ว — รอสักครู่ แจ้งเตือนจะเด้งขึ้นมา')
    } catch {
      showToast('ส่งแจ้งเตือนทดสอบไม่สำเร็จ', 'error')
    } finally {
      setTesting(false)
    }
  }

  if (standalone === null || push === null) return null

  const ios = isIos()

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-2 font-semibold text-gray-900">แอปบนอุปกรณ์นี้</h3>

      <Row icon={<Smartphone size={14} />} label="ติดตั้งเป็นแอป">
        {standalone ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
            <Check size={14} /> เปิดจากแอปอยู่
          </span>
        ) : installEvt ? (
          <button
            onClick={install}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-700"
          >
            <Download size={14} /> ติดตั้งแอป
          </button>
        ) : (
          <span className="text-xs text-gray-500">
            {ios ? (
              <>กด <Share size={12} className="inline -mt-0.5" /> แชร์ใน Safari → “เพิ่มไปยังหน้าจอโฮม”</>
            ) : (
              'เมนูเบราว์เซอร์ → “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอหลัก”'
            )}
          </span>
        )}
      </Row>

      <Row icon={<BellRing size={14} />} label="แจ้งเตือนบนอุปกรณ์นี้">
        {push === 'ios-needs-install' ? (
          <span className="text-xs text-gray-500">ติดตั้งเป็นแอปก่อน แล้วเปิดจากไอคอนแอป</span>
        ) : push === 'unsupported' ? (
          <span className="text-xs text-gray-500">เบราว์เซอร์นี้ไม่รองรับ</span>
        ) : (
          <>
            {push === 'subscribed' && (
              <button
                onClick={sendTest}
                disabled={testing}
                className="text-xs text-gray-500 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {testing ? 'กำลังส่ง…' : 'ส่งทดสอบ'}
              </button>
            )}
            <Toggle
              checked={push === 'subscribed'}
              onChange={togglePush}
              disabled={push === 'denied'}
              loading={busy}
              size="sm"
              aria-label="แจ้งเตือนบนอุปกรณ์นี้"
            />
          </>
        )}
      </Row>

      {push === 'denied' && (
        <p className="mt-2 text-xs text-gray-500">
          การแจ้งเตือนถูกปิดไว้ในเบราว์เซอร์ — เปิดได้ในตั้งค่าเว็บไซต์ของเบราว์เซอร์ แล้วกลับมาเปิดสวิตช์นี้
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        แจ้งเตือนเรื่องใบลาและใบสลับวันหยุด — คนอนุมัติได้รับตอนมีใบใหม่ เจ้าของใบได้รับตอนมีผล
      </p>
    </div>
  )
}

'use client'

// การ์ด "แอปบนอุปกรณ์นี้" ในหน้าโปรไฟล์ — สองเรื่องที่ผูกกับ *เครื่อง* ไม่ใช่บัญชี:
//   1. ติดตั้งเป็นแอป (Android/เดสก์ท็อปมีปุ่ม · iPhone ต้องกดเอง → ลิงก์ไปหน้าวิธี /install)
//   2. เปิด/ปิดแจ้งเตือนของเครื่องนี้ (+ ปุ่มส่งทดสอบ)
// ทำไมอยู่หน้าโปรไฟล์: เป็นหน้าเดียวที่ทุกตำแหน่งเข้าได้และเป็น "ของฉัน" อยู่แล้ว
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Smartphone, Check, BellRing } from 'lucide-react'
import { Button, Pill, Toggle } from '@/components/aoo'
import { ListRow, ListRows, SectionCard } from '@/components/shared'
import { useToast } from '@/hooks/useToast'
import { getPushState, enablePush, disablePush, isStandalone, type PushState } from '@/lib/push/client'
import { useInstallPrompt } from '@/lib/push/installPrompt'

export default function DeviceCard() {
  const { showToast } = useToast()
  const [standalone, setStandalone] = useState<boolean | null>(null)
  const [push, setPush] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const { canPrompt, prompt } = useInstallPrompt()

  useEffect(() => {
    setStandalone(isStandalone())
    getPushState().then(setPush)
  }, [])

  const install = async () => {
    const outcome = await prompt()
    if (outcome === 'accepted') showToast('ติดตั้งแอป AMGO แล้ว — เปิดจากไอคอนบนหน้าจอโฮมได้เลย')
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

  return (
    <SectionCard title="แอปบนอุปกรณ์นี้">
      <ListRows>
        <ListRow
          leading={<Smartphone size={16} className="text-gray-400" />}
          title="ติดตั้งเป็นแอป"
          trailing={
            standalone ? (
              <Pill tone="success">
                <Check size={14} /> เปิดจากแอปอยู่
              </Pill>
            ) : canPrompt ? (
              <Button size="sm" icon="Download" onClick={install}>
                ติดตั้งแอป
              </Button>
            ) : (
              <Link href="/install">
                <Button variant="link" size="sm" iconRight="ChevronRight">
                  ดูวิธีติดตั้ง
                </Button>
              </Link>
            )
          }
        />

        <ListRow
          leading={<BellRing size={16} className="text-gray-400" />}
          title="แจ้งเตือนบนอุปกรณ์นี้"
          trailing={
            push === 'ios-needs-install' ? (
              <Link href="/install">
                <Button variant="link" size="sm" iconRight="ChevronRight">
                  ติดตั้งเป็นแอปก่อน
                </Button>
              </Link>
            ) : push === 'unsupported' ? (
              <span className="text-xs text-gray-500">เบราว์เซอร์นี้ไม่รองรับ</span>
            ) : (
              <>
                {push === 'subscribed' && (
                  <Button variant="link" size="sm" onClick={sendTest} loading={testing}>
                    {testing ? 'กำลังส่ง…' : 'ส่งทดสอบ'}
                  </Button>
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
            )
          }
        />
      </ListRows>

      {push === 'denied' && (
        <p className="mt-2 text-xs text-gray-500">
          การแจ้งเตือนถูกปิดไว้ในเบราว์เซอร์ — เปิดได้ในตั้งค่าเว็บไซต์ของเบราว์เซอร์ แล้วกลับมาเปิดสวิตช์นี้
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        แจ้งเตือนเรื่องใบลาและใบสลับวันหยุด — คนอนุมัติได้รับตอนมีใบใหม่ เจ้าของใบได้รับตอนมีผล · เตือนเมื่อเลยเวลาเลิกงานแล้วยังไม่เช็คเอาท์
      </p>
    </SectionCard>
  )
}

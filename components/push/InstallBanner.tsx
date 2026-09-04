'use client'

// แถบชวนติดตั้งแอป — โผล่เฉพาะ *มือถือที่เปิดจากเบราว์เซอร์* (ไม่ใช่จากไอคอนแอป)
//
// · Android/Chrome มี prompt ของระบบ → ปุ่ม "ติดตั้ง" ขึ้นหน้าต่างติดตั้งทันที
// · iOS ไม่มี → ปุ่ม "ดูวิธี" พาไปหน้า /install ที่บอกขั้นตอน
// · กด ✕ = เงียบ 7 วัน (จำในเครื่องนี้) — ไม่กวนทุกครั้งที่เปิด แต่ก็ไม่หายตลอดกาล
//   เผื่อวันหนึ่งเปลี่ยนใจ
// · เดสก์ท็อปไม่ขึ้น: งานที่ต้องเป็นแอปคือเช็คอิน/ถ่ายรูป/รับแจ้งเตือน ซึ่งอยู่บนมือถือ
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { isMobile, isStandalone } from '@/lib/push/client'
import { useInstallPrompt } from '@/lib/push/installPrompt'

const KEY = 'amgo-install-banner-snoozed-at'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

export default function InstallBanner() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const { canPrompt, prompt } = useInstallPrompt()

  useEffect(() => {
    if (!isMobile() || isStandalone()) return
    let snoozedAt = 0
    try {
      snoozedAt = Number(localStorage.getItem(KEY) || 0)
    } catch { /* โหมดส่วนตัว — ถือว่าไม่เคยกดปิด */ }
    if (Date.now() - snoozedAt < SNOOZE_MS) return
    setShow(true)
  }, [])

  // หน้า /install บอกขั้นตอนอยู่แล้ว ไม่ต้องมีแถบซ้อน
  if (!show || pathname === '/install') return null

  const snooze = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch { /* ignore */ }
    setShow(false)
  }

  const install = async () => {
    const outcome = await prompt()
    if (outcome === 'accepted') setShow(false)
  }

  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
      <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">ใช้ AMGO แบบแอปดีกว่า</p>
        <p className="truncate text-xs text-gray-600">เปิดจากไอคอนได้เลย · แจ้งเตือนเด้งถึงเครื่อง</p>
      </div>
      {canPrompt ? (
        <button
          onClick={install}
          className="h-8 shrink-0 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-700"
        >
          ติดตั้ง
        </button>
      ) : (
        <Link
          href="/install"
          className="h-8 shrink-0 rounded-lg bg-gray-900 px-3 text-sm font-medium leading-8 text-white hover:bg-gray-700"
        >
          ดูวิธี
        </Link>
      )}
      <button onClick={snooze} aria-label="ไว้ก่อน" className="shrink-0 rounded p-1 text-gray-500 hover:bg-amber-100">
        <X size={16} />
      </button>
    </div>
  )
}

'use client'

// สั่งของนำเข้า — หน้าแผนสั่งของ ยกมาจากหน้า order-plan ในเครื่องเจ้าของทั้งหน้า (29 ต.ค. 69)
// เจ้าของ: "copy หน้าตามาเลย เอาเหมือนที่ทำอยู่เป๊ะๆ" → ไม่ทำใหม่เป็น React แต่ฝังไฟล์เดิม
// (public/order-plan/index.html) ไว้ในกรอบเต็มพื้นที่ใต้แถบบน · ข้อมูลผ่าน /api/import/* (เช็คสิทธิ์ทุกครั้ง)
// รอบที่เปิดอยู่เก็บใน hash ของหน้านี้ (/import#p=C1-hape) — refresh / ส่งลิงก์แล้วเปิดรอบเดิม

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { TechLoader } from '@/components/shared'

export default function ImportPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [src, setSrc] = useState<string | null>(null)

  const canSee = !!userData?.importAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  // อ่าน hash ครั้งเดียวตอนเปิด — หลังจากนั้นกรอบเป็นคนเปลี่ยนเอง
  useEffect(() => {
    setSrc(`/order-plan/index.html${window.location.hash}`)
  }, [])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const d = e.data as { orderPlanHash?: string; title?: string } | null
      if (typeof d?.orderPlanHash !== 'string') return
      window.history.replaceState(null, '', `/import${d.orderPlanHash}`)
      if (d.title) document.title = d.title
    }
    // เปลี่ยน hash จากแถบที่อยู่ / ปุ่มย้อนกลับ → ส่งต่อเข้ากรอบ
    const onHash = () => {
      const w = document.querySelector<HTMLIFrameElement>('iframe[data-order-plan]')?.contentWindow
      if (w && w.location.hash !== window.location.hash) w.location.hash = window.location.hash
    }
    window.addEventListener('message', onMsg)
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('message', onMsg)
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  if (!canSee || !src) return <TechLoader />

  // ลบ padding ของ <main> ให้กรอบชิดขอบ · สูงเต็มจอลบแถบบน (h-14)
  return (
    <div className="-mx-4 -mb-10 -mt-5 lg:-mx-7">
      <iframe data-order-plan src={src} title="แผนสั่งของ" className="block h-[calc(100dvh-3.5rem)] w-full border-0" />
    </div>
  )
}

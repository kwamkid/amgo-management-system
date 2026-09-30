'use client'

// อัปเดตแอปเองเมื่อมี deploy ใหม่ (30 ก.ย. 69)
//
// แอปที่เปิดค้าง (โดยเฉพาะแอปที่ติดตั้งบนมือถือ) รันโค้ดชุดเก่าไปเรื่อย ๆ จนกว่าจะปิด
// แล้วเปิดใหม่ — แก้บั๊กไปแล้วคนยังเจออยู่ · เจ้าของ: "ถ้าจำเป็นต้อง reload ให้ขึ้นให้
// พนักงานเลย การบอกให้ทำอะไรค่อนข้างยาก"
//
// เทียบรหัสเวอร์ชันที่ฝังตอน build (NEXT_PUBLIC_BUILD_ID) กับ /api/version
//   · กลับมาเปิดแอป/สลับกลับมาที่แท็บ แล้วเจอเวอร์ชันใหม่ → โหลดใหม่ทันที
//     (จังหวะนี้ยังไม่ได้พิมพ์อะไรค้าง ไม่มีอะไรหาย)
//   · ใช้งานอยู่แล้วเจอ (เช็คทุก 5 นาที) → ขึ้นแถบให้กด ไม่ตัดกลางคันระหว่างกรอกฟอร์ม
// กันวนโหลดไม่จบ: โหลดใหม่อัตโนมัติได้ครั้งเดียวต่อเวอร์ชัน ถ้ายังเก่าอยู่ก็เหลือแค่แถบ

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
const POLL_MS = 5 * 60_000
const RELOADED_KEY = 'amgo:reloaded-for'

async function serverBuild(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' })
    if (!res.ok) return null
    const { build } = (await res.json()) as { build?: string }
    return build ?? null
  } catch {
    return null // ออฟไลน์/เน็ตหลุด — ไว้เช็ครอบหน้า
  }
}

function alreadyReloadedFor(build: string): boolean {
  try {
    return sessionStorage.getItem(RELOADED_KEY) === build
  } catch {
    return false
  }
}

function reloadFor(build: string) {
  try {
    sessionStorage.setItem(RELOADED_KEY, build)
  } catch {
    /* เก็บไม่ได้ก็โหลดได้ */
  }
  window.location.reload()
}

export default function UpdateWatcher() {
  const [newBuild, setNewBuild] = useState<string | null>(null)
  const checking = useRef(false)

  const check = useCallback(async (autoReload: boolean) => {
    if (BUILD === 'dev' || checking.current) return
    checking.current = true
    const latest = await serverBuild()
    checking.current = false
    if (!latest || latest === 'dev' || latest === BUILD) return

    if (autoReload && !alreadyReloadedFor(latest)) reloadFor(latest)
    else setNewBuild(latest)
  }, [])

  useEffect(() => {
    if (BUILD === 'dev') return
    check(true) // เพิ่งเปิดแอป — ยังไม่มีอะไรค้าง โหลดใหม่ได้เลย

    const onVisible = () => {
      if (document.visibilityState === 'visible') check(true)
    }
    document.addEventListener('visibilitychange', onVisible)

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') check(false)
    }, POLL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [check])

  if (!newBuild) return null

  return (
    <button
      type="button"
      onClick={() => reloadFor(newBuild)}
      className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-2 bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <RefreshCw size={16} />
      มีเวอร์ชันใหม่ — แตะตรงนี้เพื่ออัปเดต
    </button>
  )
}

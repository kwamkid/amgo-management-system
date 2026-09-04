// lib/push/client.ts
//
// Web Push ฝั่งเบราว์เซอร์ — จัดการ service worker + subscription ของ "อุปกรณ์นี้"
// (เครื่องเดียวกันเปิดหลายเบราว์เซอร์ = หลาย subscription · แต่ละอันเปิด/ปิดแยกกัน)
//
// แบบเดียวกับ aoocommerce แต่ตัด "สาย" (audience) ออก — amgo มีแอปเดียว
'use client'

export type PushState =
  | 'unsupported'       // เบราว์เซอร์ไม่รองรับ push เลย
  | 'ios-needs-install' // iPhone/iPad ยังไม่ได้เพิ่มไปยังหน้าจอโฮม (iOS ให้ push เฉพาะแอปที่ติดตั้งแล้ว)
  | 'denied'            // ผู้ใช้เคยกดปฏิเสธ — ต้องไปเปิดเองในตั้งค่าเบราว์เซอร์
  | 'subscribed'        // เปิดแจ้งเตือนอยู่
  | 'unsubscribed'      // รองรับแต่ยังไม่เปิด

export function isIos(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ แกล้งเป็น Mac ใน UA — ดูจากจอสัมผัสแทน
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent)
}

export function isMobile(): boolean {
  return isIos() || isAndroid()
}

/**
 * เปิดอยู่ในเบราว์เซอร์ฝังของ LINE/Facebook — ตัวนี้**ไม่มี**เมนู "เพิ่มไปยังหน้าจอโฮม"
 * และ iOS ไม่ให้ push จากในนั้น · พนักงานส่วนใหญ่เปิดจากลิงก์ใน LINE จึงต้องบอกให้
 * เปิดใน Safari/Chrome ก่อนเป็นขั้นแรก
 */
export function inAppBrowser(): 'line' | 'facebook' | null {
  const ua = navigator.userAgent
  if (/\bLine\//i.test(ua)) return 'line'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'
  return null
}

/** เปิดจากไอคอนแอป (ไม่ใช่แท็บเบราว์เซอร์) */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** ลงทะเบียน service worker (idempotent — เรียกซ้ำได้ทุกครั้งที่เปิดแอป) */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.error('[Push] ลงทะเบียน service worker ไม่สำเร็จ:', err)
    return null
  }
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported'
  if (isIos() && !isStandalone()) return 'ios-needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    if (!reg) return 'unsubscribed'
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'subscribed' : 'unsubscribed'
  } catch {
    return 'unsubscribed'
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0))
}

/** ขอ permission + subscribe + บันทึกลง server — คืนสถานะใหม่ */
export async function enablePush(): Promise<PushState> {
  const state = await getPushState()
  if (state === 'unsupported' || state === 'ios-needs-install' || state === 'denied') return state

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unsubscribed'

  const reg = await registerServiceWorker()
  if (!reg) return 'unsupported'

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) {
    console.error('[Push] ยังไม่ได้ตั้ง NEXT_PUBLIC_VAPID_PUBLIC_KEY')
    return 'unsupported'
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  })

  const json = sub.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })
  if (!res.ok) {
    // server ไม่รับ = ไม่มีใครส่งหาเครื่องนี้ได้ — ถอย subscription ฝั่งเบราว์เซอร์ด้วย
    await sub.unsubscribe().catch(() => {})
    throw new Error('บันทึกอุปกรณ์ไม่สำเร็จ')
  }
  return 'subscribed'
}

/** ยกเลิกแจ้งเตือนของอุปกรณ์นี้ */
export async function disablePush(): Promise<PushState> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {}) // server ลบไม่ได้ก็ยัง unsubscribe ฝั่งเบราว์เซอร์ต่อ (ส่งไปก็ตีกลับ 410 แล้วโดนลบเอง)
      await sub.unsubscribe()
    }
  } catch (err) {
    console.error('[Push] ปิดแจ้งเตือนไม่สำเร็จ:', err)
  }
  return 'unsubscribed'
}

/**
 * ล้างเลขบนไอคอนแอป — เรียกตอนผู้ใช้เปิดแอปมาเห็นแล้ว
 * ตัวนับอยู่ที่ service worker แต่หน้าเว็บล้างไอคอนได้เร็วกว่า จึงทำทั้งสองฝั่ง
 */
export async function clearAppBadge(): Promise<void> {
  const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> }
  if (typeof nav.clearAppBadge === 'function') {
    try { await nav.clearAppBadge() } catch { /* ไม่ได้ติดตั้งเป็นแอป */ }
  }
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    ;(reg?.active || reg?.waiting || reg?.installing)?.postMessage({ type: 'clear-badge' })
  } catch { /* ignore */ }
}

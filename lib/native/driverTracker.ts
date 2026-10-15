// lib/native/driverTracker.ts
//
// ส่งตำแหน่งคนขับตลอดกะ — ทำงานเฉพาะตอนเปิด amgo ในแอป Android ประจำรถ (โปรเจกต์ ~/amgo-driver-app:
// Capacitor ที่โหลด app.amgovenger.com + ปลั๊กอิน @capacitor-community/background-geolocation)
// เบราว์เซอร์/PWA ธรรมดา = ไม่ทำอะไร
//
// ลำดับ: ปลั๊กอินส่งตำแหน่งมาเรื่อย ๆ (แม้จอดับ — foreground service + แจ้งเตือนค้าง)
//   → เก็บทุก KEEP_EVERY_MS หรือขยับเกิน KEEP_MOVE_M ลงคิวในเครื่อง (localStorage — ไม่มีสัญญาณก็ไม่หาย)
//   → ส่งเป็นชุดทุก FLUSH_EVERY_MS เข้า RPC record_driver_locations ผ่าน CapacitorHttp (native)
//     ไม่ใช้ fetch ของ WebView: Android ชะลอ HTTP จาก WebView หลังอยู่เบื้องหลัง 5 นาที (README ปลั๊กอิน)
//   → ส่งตรงเข้า Supabase ไม่ผ่าน Vercel · ตำแหน่งขึ้นแผนที่สด /delivery/live เอง (broadcast)

import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
import { createClient } from '@/lib/supabase/client'

/** เก็บจุดถี่สุดเท่านี้ (จอดนิ่งก็ยังได้จุดทุก 15 วิ = แผนที่รู้ว่ายังอยู่) */
const KEEP_EVERY_MS = 15_000
/** ขยับเกินกี่เมตรเก็บทันที (เลี้ยวเร็ว ๆ ไม่หลุดเส้น) */
const KEEP_MOVE_M = 50
/** ส่งเป็นชุดทุกเท่านี้ */
const FLUSH_EVERY_MS = 20_000
/** คิวในเครื่องสูงสุด (~8 ชม. ที่ 15 วิ) — เกินทิ้งจุดเก่าสุด */
const MAX_QUEUE = 2000
const BATCH = 500
const QUEUE_KEY = 'amgo-track-queue'

type Loc = { latitude: number; longitude: number; accuracy: number; speed: number | null; bearing: number | null; time: number | null }
type Point = { t: number; lat: number; lng: number; acc?: number; spd?: number; hdg?: number; bat?: number }

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: { backgroundMessage?: string; backgroundTitle?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number },
    callback: (position?: Loc, error?: { code?: string; message: string }) => void
  ): Promise<string>
  removeWatcher(options: { id: string }): Promise<void>
  openSettings(): Promise<void>
}
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
const LocalNotifications = registerPlugin<{ requestPermissions(): Promise<{ display: string }> }>('LocalNotifications')

/** เปิดอยู่ในแอป Android ประจำรถ */
export const isDriverApp = () => typeof window !== 'undefined' && Capacitor.isNativePlatform()

function readQueue(): Point[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}
function writeQueue(q: Point[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)))
  } catch { /* เต็ม — รอบหน้าส่งแล้วจะว่าง */ }
}

function distM(a: Point, b: { lat: number; lng: number }) {
  const r = 6371e3
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(x))
}

let battery: number | undefined
async function watchBattery() {
  try {
    const b = await (navigator as unknown as { getBattery?: () => Promise<{ level: number; addEventListener: (e: string, f: () => void) => void }> }).getBattery?.()
    if (!b) return
    const set = () => (battery = Math.round(b.level * 100))
    set()
    b.addEventListener('levelchange', set)
  } catch { /* ไม่มีก็ไม่เป็นไร */ }
}

let flushing = false
let lastFlush = 0
/** ส่งคิวในเครื่องเข้า Supabase — สำเร็จค่อยตัดออกจากคิว */
async function flush() {
  if (flushing) return
  flushing = true
  lastFlush = Date.now()
  try {
    const { data } = await createClient().auth.getSession() // หมดอายุ = refresh ให้เอง
    const token = data.session?.access_token
    if (!token) return
    let q = readQueue()
    while (q.length) {
      const batch = q.slice(0, BATCH)
      const res = await CapacitorHttp.post({
        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/record_driver_locations`,
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: { points: batch },
      })
      if (res.status >= 300) {
        console.warn('[DriverTracker] ส่งไม่สำเร็จ', res.status, res.data)
        return
      }
      // คิวอาจโตระหว่างส่ง — ตัดเฉพาะชุดที่ส่งไปแล้ว
      q = readQueue().slice(batch.length)
      writeQueue(q)
    }
  } catch (e) {
    console.warn('[DriverTracker] ส่งไม่สำเร็จ (จะลองใหม่)', e)
  } finally {
    flushing = false
  }
}

let watcherId: string | null = null
let timer: ReturnType<typeof setInterval> | null = null
let last: Point | null = null

/** เริ่มติดตาม (เรียกซ้ำได้ ไม่ซ้อน) — คืนข้อความ error ถ้าเริ่มไม่ได้ */
export async function startDriverTracking(): Promise<string | null> {
  if (!isDriverApp() || watcherId) return null
  await LocalNotifications.requestPermissions().catch(() => null) // Android 13+ ต้องมี ไม่งั้นแจ้งเตือนค้างไม่ขึ้น
  void watchBattery()
  try {
    watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: 'amgo กำลังส่งตำแหน่ง',
        backgroundMessage: 'ระหว่างกะส่งของ — แตะเพื่อเปิดแอป',
        requestPermissions: true,
        stale: false,
        distanceFilter: 0, // ได้จุดเรื่อย ๆ แม้จอดนิ่ง แล้วค่อยกรองเองด้านล่าง (เครื่องเสียบชาร์จในรถ)
      },
      (loc, err) => {
        if (err) {
          if (err.code === 'NOT_AUTHORIZED') void BackgroundGeolocation.openSettings()
          console.warn('[DriverTracker]', err.message)
          return
        }
        if (!loc) return
        const p: Point = {
          t: loc.time ?? Date.now(),
          lat: loc.latitude,
          lng: loc.longitude,
          acc: loc.accuracy,
          spd: loc.speed ?? undefined,
          hdg: loc.bearing ?? undefined,
          bat: battery,
        }
        if (last && p.t - last.t < KEEP_EVERY_MS && distM(last, p) < KEEP_MOVE_M) return
        last = p
        writeQueue([...readQueue(), p])
        // ตัวจับเวลาของ WebView ถูกชะลอตอนจอดับ — ให้จุดใหม่เป็นตัวกระตุ้นส่งด้วย
        if (Date.now() - lastFlush >= FLUSH_EVERY_MS) void flush()
      }
    )
  } catch (e) {
    return (e as Error).message
  }
  timer = setInterval(() => void flush(), FLUSH_EVERY_MS)
  void flush() // ค้างจากรอบก่อน (ปิดแอปตอนไม่มีสัญญาณ)
  return null
}

export async function stopDriverTracking() {
  if (timer) clearInterval(timer)
  timer = null
  if (watcherId) await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => null)
  watcherId = null
  last = null
  await flush()
}

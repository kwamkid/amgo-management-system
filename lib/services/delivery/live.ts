// lib/services/delivery/live.ts
//
// ตำแหน่งคนขับสด — อ่าน driver_live ครั้งแรก แล้วฟัง Broadcast 'delivery:live' (private)
// ที่ trigger ใน DB ส่งมาทุกครั้งที่จุดล่าสุดเปลี่ยน (ไม่ poll · ไม่ postgres_changes — aoo-techstack/realtime)
// แอปเขียนตำแหน่งผ่าน RPC record_driver_locations (ไม่ผ่าน Vercel)

import { createClient } from '@/lib/supabase/client'

const sb = () => createClient()

export type DriverLive = {
  driverId: string
  driverName: string
  lat: number
  lng: number
  accuracy: number | null
  /** เมตร/วินาที */
  speed: number | null
  heading: number | null
  battery: number | null
  recordedAt: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const fromRow = (r: any): DriverLive => ({
  driverId: r.driver_id,
  driverName: r.driver_name,
  lat: r.lat,
  lng: r.lng,
  accuracy: r.accuracy,
  speed: r.speed,
  heading: r.heading,
  battery: r.battery,
  recordedAt: r.recorded_at,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getDriversLive(): Promise<DriverLive[]> {
  const { data, error } = await sb().from('driver_live').select('*').order('driver_name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(fromRow)
}

/** ฟังตำแหน่งสด — คืนฟังก์ชันเลิกฟัง */
export function subscribeDriversLive(onChange: (d: DriverLive) => void, onStatus?: (ok: boolean) => void) {
  const client = sb()
  let channel: ReturnType<typeof client.channel> | null = null
  let stopped = false
  ;(async () => {
    await client.realtime.setAuth() // private channel ต้องมี token ของคนที่ล็อกอิน (RLS บน realtime.messages)
    if (stopped) return
    channel = client
      .channel('delivery:live', { config: { private: true } })
      .on('broadcast', { event: 'location' }, ({ payload }) => onChange(fromRow(payload)))
      .subscribe((status) => onStatus?.(status === 'SUBSCRIBED'))
  })()
  return () => {
    stopped = true
    if (channel) client.removeChannel(channel)
  }
}

/** แอปบนเครื่องคนขับ: ส่งตำแหน่งเป็นชุด → คืนจำนวนที่บันทึก */
export type TrackPoint = { t: number; lat: number; lng: number; acc?: number; spd?: number; hdg?: number; bat?: number }
export async function recordDriverLocations(points: TrackPoint[]) {
  const { data, error } = await sb().rpc('record_driver_locations', { points })
  if (error) throw new Error(error.message)
  return data ?? 0
}

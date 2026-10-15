'use client'

// คนขับตอนนี้ (แผนที่สด) — HR/แอดมินเท่านั้น (ตำแหน่งคนเป็นข้อมูลส่วนตัว · RLS ปล่อยแค่ is_hr)
//
// ทาง A (เจ้าของ 15 ต.ค. 69): เครื่อง Android ประจำรถ รันแอป amgo (Capacitor) ส่งตำแหน่งตลอดกะแม้จอดับ
// → RPC record_driver_locations → driver_live → trigger broadcast 'delivery:live' → หน้านี้ขยับเอง ไม่ poll
// เงียบเกิน STALE_MIN นาที = เทา (แอปปิด / ไม่มีสัญญาณ / แบตหมด)

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { BatteryMedium, Gauge, MapPin, Radio, Truck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { GOOGLE_MAPS_LOADER } from '@/lib/maps'
import { getDriversLive, subscribeDriversLive, type DriverLive } from '@/lib/services/delivery/live'
import { Card, CardContent, EmptyState, Pill } from '@/components/aoo'
import { ListRow, ListRows, PageHeader, TechLoader } from '@/components/shared'

/** เงียบเกินกี่นาทีถือว่าขาดการติดต่อ */
const STALE_MIN = 5
const BANGKOK = { lat: 13.7563, lng: 100.5018 }
const MAP_OPTIONS: google.maps.MapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [{ featureType: 'transit', stylers: [{ visibility: 'off' }] }],
}

const minutesAgo = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
const agoText = (m: number) => (m < 1 ? 'เมื่อกี้' : m < 60 ? `${m} นาทีที่แล้ว` : `${Math.floor(m / 60)} ชม. ${m % 60} นาทีที่แล้ว`)
/** สีจาก token กลาง (Google Maps อ่าน CSS var ตรง ๆ ไม่ได้) */
const token = (name: string) =>
  typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export default function DeliveryLivePage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  const canSee = userData?.role === 'admin' || userData?.role === 'hr'
  const { isLoaded } = useJsApiLoader(GOOGLE_MAPS_LOADER)

  const [drivers, setDrivers] = useState<Map<string, DriverLive> | null>(null)
  const [connected, setConnected] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  // นาฬิกาสำหรับ "x นาทีที่แล้ว" — คำนวณในเครื่อง ไม่ยิงเน็ต
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  useEffect(() => {
    if (!canSee) return
    getDriversLive()
      .then((list) => setDrivers(new Map(list.map((d) => [d.driverId, d]))))
      .catch((e) => {
        showToast((e as Error).message, 'error')
        setDrivers(new Map())
      })
    const stop = subscribeDriversLive(
      (d) => setDrivers((prev) => new Map(prev ?? []).set(d.driverId, d)),
      setConnected
    )
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      stop()
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  const list = useMemo(
    () => [...(drivers?.values() ?? [])].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    [drivers]
  )

  // เปิดมาครั้งแรก: ซูมให้เห็นทุกคัน
  useEffect(() => {
    if (!map || !list.length) return
    const b = new google.maps.LatLngBounds()
    list.forEach((d) => b.extend({ lat: d.lat, lng: d.lng }))
    map.fitBounds(b, 60)
    if (list.length === 1) map.setZoom(15)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, list.length])

  const focus = (d: DriverLive) => {
    setSelected(d.driverId)
    map?.panTo({ lat: d.lat, lng: d.lng })
    map?.setZoom(16)
  }

  if (!canSee || drivers === null || !isLoaded) return <TechLoader />

  const live = token('--leaf-500')
  const stale = token('--warm-500')

  return (
    <div>
      <PageHeader
        title="คนขับตอนนี้"
        description={`ตำแหน่งสดจากเครื่องประจำรถ · เงียบเกิน ${STALE_MIN} นาทีขึ้นสีเทา`}
        icon={Truck}
        actions={
          <Pill tone={connected ? 'success' : 'neutral'}>
            <Radio size={14} /> {connected ? 'เชื่อมต่อสด' : 'กำลังเชื่อมต่อ…'}
          </Pill>
        }
      />

      {!list.length ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<MapPin size={28} />}
              title="ยังไม่มีคนขับส่งตำแหน่ง"
              body="ตำแหน่งจะขึ้นเมื่อคนขับเปิดแอป amgo บนเครื่องประจำรถและเริ่มกะ"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardContent>
              <ListRows>
                {list.map((d) => {
                  const m = minutesAgo(d.recordedAt, now)
                  const isStale = m >= STALE_MIN
                  return (
                    <ListRow
                      key={d.driverId}
                      onClick={() => focus(d)}
                      leading={<Truck size={18} className={isStale ? 'text-gray-400' : 'text-[var(--leaf-500)]'} />}
                      title={<span className={selected === d.driverId ? 'font-bold' : ''}>{d.driverName || 'ไม่ทราบชื่อ'}</span>}
                      meta={
                        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span>{agoText(m)}</span>
                          {d.speed != null && (
                            <span className="inline-flex items-center gap-1">
                              <Gauge size={12} /> {Math.round(d.speed * 3.6)} กม./ชม.
                            </span>
                          )}
                          {d.battery != null && (
                            <span className="inline-flex items-center gap-1">
                              <BatteryMedium size={12} /> {d.battery}%
                            </span>
                          )}
                        </span>
                      }
                      trailing={<Pill tone={isStale ? 'neutral' : 'success'}>{isStale ? 'เงียบ' : 'สด'}</Pill>}
                    />
                  )
                })}
              </ListRows>
            </CardContent>
          </Card>

          <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-xl border border-gray-200">
            <GoogleMap
              mapContainerClassName="h-full w-full"
              center={BANGKOK}
              zoom={11}
              options={MAP_OPTIONS}
              onLoad={setMap}
              onUnmount={() => setMap(null)}
            >
              {list.map((d) => {
                const isStale = minutesAgo(d.recordedAt, now) >= STALE_MIN
                return (
                  <Marker
                    key={d.driverId}
                    position={{ lat: d.lat, lng: d.lng }}
                    title={d.driverName}
                    onClick={() => focus(d)}
                    label={{ text: d.driverName.slice(0, 12), color: token('--fg-1') || 'black', fontSize: '12px', fontWeight: '700' }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      fillColor: isStale ? stale : live,
                      fillOpacity: 1,
                      strokeColor: 'white',
                      strokeWeight: 3,
                      scale: selected === d.driverId ? 13 : 10,
                      labelOrigin: new google.maps.Point(0, -2.4),
                    }}
                  />
                )
              })}
            </GoogleMap>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

// รูปสต็อก/หน้าร้านย้อนหลัง รายสาขา รายวัน — HR/ผู้จัดการ/แอดมิน
//
// เจ้าของสั่ง 4 ก.ย. 69: ไว้ดูว่าสาขาไหนของหาย หายตั้งแต่เมื่อไหร่ ใครอยู่เวร
// รูปบอกได้ว่า "เปลี่ยนเมื่อไหร่ ตรงไหน" ไม่ได้นับว่าหายกี่ชิ้น — ใช้คู่กับการนับสต็อก
//
// โครง: เลือกสาขา → แถบวันที่มีรูป (กดข้ามวันว่างได้) → รูปของวันนั้นแยกหน้าร้าน/สต็อก
// เลื่อนวันก่อน/หลังด้วยลูกศร เอาไว้ไล่ดูทีละวันเหมือนเลื่อนฟิล์ม

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, eachDayOfInterval, format, subDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { createClient } from '@/lib/supabase/client'
import { DatePicker, EmptyState } from '@/components/aoo'
import { FilterBar, FilterSelect, PageHeader, SectionCard, Segmented, Skeleton, UserCell } from '@/components/shared'
import {
  listPhotos,
  listPhotoDays,
  listPhotoPeople,
  KIND_LABEL,
  type StockPhoto,
  type StockPhotoKind,
} from '@/lib/services/stockPhotoService'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export default function StockPhotosReportPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [locations, setLocations] = useState<{ value: string; label: string }[]>([])
  const [locationId, setLocationId] = useState<string | null>(null)
  const [day, setDay] = useState(iso(new Date()))

  // มุมมองรายคน — เจ้าของ/ผู้จัดการดูหน้าร้านของแต่ละคนตามช่วงเวลา (เจ้าของสั่ง 4 ก.ย. 69)
  const [mode, setMode] = useState<'day' | 'person'>('day')
  const [people, setPeople] = useState<{ value: string; label: string }[]>([])
  const [personId, setPersonId] = useState<string | null>(null)
  const [rangeFrom, setRangeFrom] = useState(iso(subDays(new Date(), 13)))
  const [rangeTo, setRangeTo] = useState(iso(new Date()))
  const [rangePhotos, setRangePhotos] = useState<StockPhoto[]>([])
  const [days, setDays] = useState<{ workDate: string; storefront: number; stock: number }[]>([])
  const [photos, setPhotos] = useState<StockPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<StockPhoto | null>(null)

  useEffect(() => {
    if (userData && !['hr', 'admin', 'manager'].includes(userData.role)) router.push('/unauthorized')
  }, [userData, router])

  useEffect(() => {
    listPhotoPeople()
      .then((list) => setPeople(list.map((p) => ({ value: p.id, label: p.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    createClient()
      .from('locations')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setLocations((data ?? []).map((l) => ({ value: l.id, label: l.name }))))
  }, [])

  // แถบวัน — ย้อนหลัง 60 วันจากวันที่ดูอยู่
  const reloadDays = useCallback(async () => {
    try {
      const to = new Date(`${day}T00:00:00`)
      setDays(await listPhotoDays({ locationId, from: subDays(to, 60), to: addDays(to, 7) }))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, day])

  const reloadPhotos = useCallback(async () => {
    try {
      setLoading(true)
      const d = new Date(`${day}T00:00:00`)
      setPhotos(await listPhotos({ locationId, from: d, to: d }))
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, day])

  useEffect(() => {
    if (mode === 'day') {
      reloadDays()
      reloadPhotos()
    }
  }, [mode, reloadDays, reloadPhotos])

  const reloadRange = useCallback(async () => {
    if (!personId) {
      setRangePhotos([])
      return
    }
    try {
      setLoading(true)
      setRangePhotos(
        await listPhotos({
          userId: personId,
          from: new Date(`${rangeFrom}T00:00:00`),
          to: new Date(`${rangeTo}T00:00:00`),
        })
      )
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, rangeFrom, rangeTo])

  useEffect(() => {
    if (mode === 'person') reloadRange()
  }, [mode, reloadRange])

  /** มุมมองรายคน: แถวละวัน (รวมวันที่ไม่ถ่าย — ต้องเห็นวันที่หายด้วย) */
  const rangeByDay = useMemo(() => {
    const from = new Date(`${rangeFrom}T00:00:00`)
    const to = new Date(`${rangeTo}T00:00:00`)
    if (from > to) return []
    const byDate = new Map<string, StockPhoto[]>()
    for (const p of rangePhotos) byDate.set(p.workDate, [...(byDate.get(p.workDate) ?? []), p])
    return eachDayOfInterval({ start: from, end: to })
      .map((d) => iso(d))
      .reverse()
      .map((d) => ({ date: d, photos: byDate.get(d) ?? [] }))
  }, [rangePhotos, rangeFrom, rangeTo])

  const byKind = useMemo(() => {
    const m: Record<StockPhotoKind, StockPhoto[]> = { storefront: [], stock: [] }
    for (const p of photos) m[p.kind].push(p)
    return m
  }, [photos])

  const shift = (n: number) => setDay(iso(addDays(new Date(`${day}T00:00:00`), n)))

  const kindBlock = (kind: StockPhotoKind) => {
    const list = byKind[kind]
    return (
      <SectionCard key={kind} title={`${KIND_LABEL[kind]} (${list.length})`}>
        {list.length === 0 ? (
          <p className="text-sm text-gray-400">ไม่มีรูป{KIND_LABEL[kind]}วันนี้</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLightbox(p)}
                className="group overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-left"
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                  <span className="truncate text-gray-700">{p.userName}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">
                    {format(new Date(p.takenAt), 'HH:mm')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="รูปสต็อก / หน้าร้าน"
        description="ไล่ดูรายสาขา รายวัน — ของหายตั้งแต่วันไหน ใครอยู่เวรวันนั้น"
        icon={Camera}
      />

      <FilterBar>
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          options={[
            { value: 'day', label: 'รายวัน (ทุกคน)' },
            { value: 'person', label: 'รายคน (ช่วงเวลา)' },
          ]}
        />
        {mode === 'day' ? (
          <>
            <FilterSelect label="สาขา" value={locationId} options={locations} onChange={setLocationId} />
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shift(-1)} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50">
                <ChevronLeft size={16} />
              </button>
              <DatePicker value={day} onChange={setDay} />
              <button type="button" onClick={() => shift(1)} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50">
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            <FilterSelect label="พนักงาน" value={personId} options={people} onChange={setPersonId} />
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <DatePicker value={rangeFrom} onChange={setRangeFrom} />
              <span>–</span>
              <DatePicker value={rangeTo} onChange={setRangeTo} />
            </div>
          </>
        )}
      </FilterBar>

      {mode === 'day' && (
        <>
      {/* วันที่มีรูป — กดข้ามไปวันที่มีของได้เลย ไม่ต้องเลื่อนทีละวันผ่านวันว่าง */}
      {days.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {days.slice(0, 40).map((d) => (
            <button
              key={d.workDate}
              type="button"
              onClick={() => setDay(d.workDate)}
              className={`rounded-md px-2 py-1 text-xs ${
                d.workDate === day
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={`หน้าร้าน ${d.storefront} · สต็อก ${d.stock}`}
            >
              {format(new Date(`${d.workDate}T00:00:00`), 'd MMM', { locale: th })}
              <span className="ml-1 opacity-60">{d.storefront + d.stock}</span>
            </button>
          ))}
        </div>
      )}

      <h2 className="text-sm font-medium text-gray-600">
        {format(new Date(`${day}T00:00:00`), 'EEEE d MMMM yyyy', { locale: th })}
      </h2>

      {loading ? (
        <Skeleton rows={4} />
      ) : photos.length === 0 ? (
        <EmptyState
          icon={<Camera size={28} />}
          title="ไม่มีรูปวันนี้"
          body={locationId ? 'สาขานี้ยังไม่มีใครถ่ายรูปในวันนี้' : 'ยังไม่มีใครถ่ายรูปในวันนี้'}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {kindBlock('storefront')}
          {kindBlock('stock')}
        </div>
      )}

        </>
      )}

      {mode === 'person' && (
        !personId ? (
          <EmptyState icon={<Camera size={28} />} title="เลือกพนักงานก่อน" body="แล้วจะเห็นรูปหน้าร้าน/สต็อกของคนนั้นเรียงตามวัน" />
        ) : loading ? (
          <Skeleton rows={5} />
        ) : (
          <div className="space-y-3">
            {rangeByDay.map(({ date, photos: list }) => (
              <SectionCard
                key={date}
                title={
                  <span className="flex items-center gap-2">
                    {format(new Date(`${date}T00:00:00`), 'EEE d MMM yyyy', { locale: th })}
                    {list.length === 0 ? (
                      <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">ไม่ได้ถ่าย</span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        หน้าร้าน {list.filter((p) => p.kind === 'storefront').length} · สต็อก {list.filter((p) => p.kind === 'stock').length}
                        {list[0]?.locationName ? ` · ${list[0].locationName}` : ''}
                      </span>
                    )}
                  </span>
                }
              >
                {list.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {list.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setLightbox(p)}
                        className="relative h-28 w-36 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50"
                      >
                        {p.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                        <span className={`absolute left-1 top-1 rounded px-1 text-xs text-white ${p.kind === 'storefront' ? 'bg-sky-600' : 'bg-amber-600'}`}>
                          {KIND_LABEL[p.kind]}
                        </span>
                        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-xs text-white">
                          {format(new Date(p.takenAt), 'HH:mm')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </SectionCard>
            ))}
          </div>
        )
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button type="button" className="absolute right-4 top-4 text-white" onClick={() => setLightbox(null)}>
            <X size={24} />
          </button>
          <div className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {lightbox.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt="" className="max-h-[85vh] w-auto rounded-lg" />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/90">
              <UserCell name={lightbox.userName} />
              <span>{KIND_LABEL[lightbox.kind]}</span>
              <span>{lightbox.locationName}</span>
              <span>{format(new Date(lightbox.takenAt), 'd MMM yyyy HH:mm', { locale: th })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

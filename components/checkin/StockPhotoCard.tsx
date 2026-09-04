'use client'

// การ์ด "รูปประจำวัน" บนหน้าเช็คอิน — โผล่เฉพาะคนที่ถูกตั้งค่าให้ถ่าย
//
// เจ้าของสั่ง 4 ก.ย. 69: ต้องเป็นเมนูอยู่หน้าเขาเลยว่าวันนี้ยังไม่ได้ถ่าย
// กดถ่ายแล้วเลือกว่าหน้าร้านหรือสต็อก — ไม่ผูกกับตอนเช็คอิน เพราะตอนนั้น
// อาจยังอยู่หน้าประตูห้าง ไม่ถึงร้าน · ถ่ายไม่ครบทั้งสองอย่าง เช็คเอาท์ไม่ได้
//
// ถ่ายอิสระ ไม่กำหนดจุด (เจ้าของเลือก) — กี่รูปก็ได้ต่ออย่าง

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Camera, Check, Trash2, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { SectionCard } from '@/components/shared'
import BurstCamera from './BurstCamera'
import {
  addStockPhoto,
  deleteMyPhotoToday,
  listMyPhotosToday,
  stockPhotoStatus,
  KIND_LABEL,
  type StockPhoto,
  type StockPhotoKind,
} from '@/lib/services/stockPhotoService'

export default function StockPhotoCard({
  locationId,
  locationName,
  onStatusChange,
}: {
  /** สาขาจากกะที่เช็คอินอยู่ — รูปผูกกับสาขานี้ */
  locationId: string | null
  locationName: string
  /** บอกหน้าแม่ว่าครบหรือยัง (ด่านเช็คเอาท์ใช้) */
  onStatusChange?: (complete: boolean) => void
}) {
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [photos, setPhotos] = useState<StockPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [shooting, setShooting] = useState<StockPhotoKind | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | undefined>()

  const status = stockPhotoStatus(photos)

  const reload = useCallback(async () => {
    if (!userData?.id) return
    try {
      const list = await listMyPhotosToday(userData.id)
      setPhotos(list)
      onStatusChange?.(stockPhotoStatus(list).complete)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.id])

  useEffect(() => {
    reload()
  }, [reload])

  /** กล้องรัวส่งมาหลายรูป — อัปโหลดทีละรูปพร้อมตัวนับ (ย่อแล้วจากฝั่งกล้อง) */
  const captureMany = async (blobs: Blob[]) => {
    if (!shooting || !userData?.id || !blobs.length) return
    const kind = shooting
    try {
      setUploading(true)
      setProgress({ done: 0, total: blobs.length })
      const added: StockPhoto[] = []
      for (const blob of blobs) {
        const photo = await addStockPhoto({
          userId: userData.id,
          userName: userData.displayName || userData.fullName || '',
          locationId,
          locationName,
          kind,
          blob,
        })
        added.push(photo)
        setProgress({ done: added.length, total: blobs.length })
      }
      const next = [...photos, ...added]
      setPhotos(next)
      onStatusChange?.(stockPhotoStatus(next).complete)
      showToast(`บันทึกรูป${KIND_LABEL[kind]} ${added.length} รูปแล้ว`, 'success')
    } catch (e) {
      // ที่อัปโหลดไปแล้วบางส่วนยังอยู่ — โหลดใหม่ให้ตรงกับของจริง
      showToast((e as Error).message, 'error')
      reload()
    } finally {
      setUploading(false)
      setProgress(undefined)
      setShooting(null)
    }
  }

  // กดแล้วลบทันที ไม่ถาม (เจ้าของสั่ง 4 ก.ย. 69 "ให้มันลบไปเลย") — รูปถ่ายใหม่ได้ใน 2 วิ
  // ไม่คุ้มให้ตอบกล่องยืนยันทุกครั้ง · ปุ่มใหญ่พอนิ้วและอยู่มุมบนขวาเสมอ กันกดพลาดพอแล้ว
  const remove = async (p: StockPhoto) => {
    const next = photos.filter((x) => x.id !== p.id)
    setPhotos(next) // เอาออกจากจอก่อน — รอ server แล้วค่อยหายจะรู้สึกว่ากดไม่ติด
    onStatusChange?.(stockPhotoStatus(next).complete)
    try {
      await deleteMyPhotoToday(p.id)
      showToast(`ลบรูป${KIND_LABEL[p.kind]}แล้ว`)
    } catch (e) {
      setPhotos(photos) // ลบไม่สำเร็จ — คืนรูปกลับมา
      onStatusChange?.(stockPhotoStatus(photos).complete)
      showToast((e as Error).message, 'error')
    }
  }

  const kindRow = (kind: StockPhotoKind) => {
    const mine = photos.filter((p) => p.kind === kind)
    const done = mine.length > 0
    return (
      <div key={kind} className="rounded-lg border border-gray-100 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                done ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}
            >
              {done ? <Check size={14} /> : <X size={14} />}
            </span>
            <span className="font-medium">{KIND_LABEL[kind]}</span>
            <span className="text-sm text-gray-500">
              {done ? `${mine.length} รูป` : 'ยังไม่ได้ถ่าย'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShooting(kind)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            <Camera size={14} /> ถ่ายรูป
          </button>
        </div>

        {mine.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {mine.map((p) => (
              <div key={p.id} className="group relative h-20 w-20 overflow-hidden rounded-md border border-gray-100 bg-gray-50">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                ) : null}
                <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 text-xs text-white">
                  {format(new Date(p.takenAt), 'HH:mm')}
                </span>
                {/* โชว์ตลอด — มือถือไม่มี hover (เดิม group-hover:block กดไม่ได้เลยบนจอสัมผัส) */}
                <button
                  type="button"
                  onClick={() => remove(p)}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white active:bg-red-600"
                  aria-label="ลบรูปนี้"
                  title="ลบ (ถ่ายพลาด)"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return null

  return (
    <>
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Camera size={16} />
            รูปประจำวัน
            {status.complete ? (
              <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                ครบแล้ว
              </span>
            ) : (
              <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                ยังไม่ครบ — เช็คเอาท์ไม่ได้
              </span>
            )}
          </span>
        }
        description={`ถ่ายหน้าร้านและสต็อกของ${locationName || 'สาขา'} กี่รูปก็ได้ แต่ต้องมีทั้งสองอย่าง`}
      >
        <div className="space-y-2">
          {kindRow('storefront')}
          {kindRow('stock')}
        </div>
      </SectionCard>

      {shooting && (
        <BurstCamera
          title={`ถ่ายรูป${KIND_LABEL[shooting]}`}
          onDone={captureMany}
          onCancel={() => setShooting(null)}
          uploading={uploading}
          progress={progress}
        />
      )}
    </>
  )
}

'use client'

// กล้องถ่ายรัว — สำหรับรูปสต็อก/หน้าร้านที่ต้องถ่ายทีละหลายจุด
//
// เจ้าของสั่ง 4 ก.ย. 69:
//   · ถ่ายสดเท่านั้น ห้ามเลือกจากคลังรูป — ไม่มีทางสำรองแบบเลือกไฟล์เลย
//     (เจ้าของย้ำซ้ำ 4 ก.ย. 69) รูปทุกใบมาจาก canvas ที่วาดจาก stream กล้อง
//   · กดถ่ายรัว ๆ ได้เลย ไม่ต้องปิด-เปิดกล้องทุกรูป แล้วค่อยอัปโหลดทีเดียว
//   · ย่อรูปก่อนส่ง (resizeImage)
//
// ต่างจาก CameraCapture (เซลฟี่เช็คอิน): กล้องหลัง · ไม่กลับด้าน · stream
// เปิดค้างไว้ตลอดจนกว่าจะกดเสร็จ · เก็บหลายรูปในคิวก่อนส่ง
//
// ปิดกล้องด้วย ref ตอน unmount เสมอ — เคยเจอบั๊ก stale closure ไม่ปล่อยกล้อง
// แล้ว Android ล็อกกล้อง "ไม่สามารถเข้าถึงกล้องได้" (13 ส.ค. 69)

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, Check, Loader2, RotateCcw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resizeImage } from '@/lib/utils/resizeImage'

interface Shot {
  id: number
  blob: Blob
  preview: string
}

export default function BurstCamera({
  title,
  onDone,
  onCancel,
  uploading = false,
  /** ความคืบหน้าตอนอัปโหลด — "3/7" */
  progress,
}: {
  title: string
  onDone: (blobs: Blob[]) => void
  onCancel: () => void
  uploading?: boolean
  progress?: { done: number; total: number }
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [shots, setShots] = useState<Shot[]>([])
  const [cameraLoading, setCameraLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
      // ปล่อย object URL ของ preview ทุกรูป
      setShots((cur) => {
        cur.forEach((s) => URL.revokeObjectURL(s.preview))
        return []
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCamera = async () => {
    try {
      setCameraLoading(true)
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        // กล้องหลัง ขอความละเอียดสูงหน่อย — ย่อทีหลังอยู่แล้ว แต่ต้นทางต้องชัดพอซูมดูของ
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setTimeout(() => setCameraLoading(false), 2500)
    } catch {
      setError(
        'ไม่สามารถเข้าถึงกล้องได้ — รูปสต็อกต้องถ่ายสดเท่านั้น ' +
          'กรุณาอนุญาตการใช้กล้องในการตั้งค่าเบราว์เซอร์ แล้วกด "ลองอีกครั้ง"'
      )
      setCameraLoading(false)
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const addShot = async (raw: Blob) => {
    setProcessing(true)
    try {
      const blob = await resizeImage(raw)
      setShots((cur) => [...cur, { id: Date.now() + Math.random(), blob, preview: URL.createObjectURL(blob) }])
    } finally {
      setProcessing(false)
    }
  }

  /** ถ่ายจาก stream — กล้องยังเปิดอยู่ ถ่ายต่อได้ทันที */
  const snap = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    // แว้บขาวให้รู้ว่าถ่ายติดแล้ว — ไม่มีเสียงชัตเตอร์บนเว็บ
    setFlash(true)
    setTimeout(() => setFlash(false), 120)
    canvas.toBlob((b) => b && addShot(b), 'image/jpeg', 0.92)
  }

  const remove = (id: number) =>
    setShots((cur) => {
      const gone = cur.find((s) => s.id === id)
      if (gone) URL.revokeObjectURL(gone.preview)
      return cur.filter((s) => s.id !== id)
    })

  const finish = () => {
    stopCamera()
    onDone(shots.map((s) => s.blob))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* หัว */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <h3 className="flex items-center gap-2 font-semibold">
          <Camera size={18} /> {title}
        </h3>
        <button type="button" onClick={onCancel} disabled={uploading} className="rounded-full p-1 hover:bg-white/10">
          <X size={20} />
        </button>
      </div>

      {/* จอกล้อง */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {cameraLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="mb-3 h-12 w-12 text-red-400" />
            <p className="text-sm text-white">{error}</p>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          onLoadedMetadata={() => setCameraLoading(false)}
          onCanPlay={() => setCameraLoading(false)}
        />
        {flash && <div className="absolute inset-0 bg-white/80" />}
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-white" />
            <p className="text-sm text-white">
              กำลังอัปโหลด{progress ? ` ${progress.done}/${progress.total}` : '...'}
            </p>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* แถบรูปที่ถ่ายแล้ว */}
      {shots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto bg-black/90 px-3 py-2">
          {shots.map((s, i) => (
            <div key={s.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.preview} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-0 left-0 bg-black/60 px-1 text-[10px] text-white">{i + 1}</span>
              <button
                type="button"
                onClick={() => remove(s.id)}
                disabled={uploading}
                className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ปุ่ม */}
      <div className="space-y-2 bg-black px-4 pb-6 pt-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={uploading}>
            ยกเลิก
          </Button>

          {error ? (
            <Button className="flex-1" onClick={startCamera} disabled={uploading}>
              <RotateCcw className="mr-2 h-4 w-4" /> ลองอีกครั้ง
            </Button>
          ) : (
            <button
              type="button"
              onClick={snap}
              disabled={cameraLoading || uploading || processing}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-white/20 active:bg-white/60 disabled:opacity-40"
              title="ถ่าย (กดได้เรื่อย ๆ)"
            >
              <span className="h-11 w-11 rounded-full bg-white" />
            </button>
          )}

          <Button
            className="flex-1 bg-teal-600 text-white hover:bg-teal-700"
            onClick={finish}
            disabled={shots.length === 0 || uploading || processing}
          >
            <Check className="mr-2 h-4 w-4" />
            อัปโหลด {shots.length > 0 ? `${shots.length} รูป` : ''}
          </Button>
        </div>

        {/* ไม่มีทางสำรองแบบเลือกไฟล์ — เจ้าของย้ำ 4 ก.ย. 69 "ถ่ายสดนะ อัพโหลดรูปไม่ได้นะ"
            <input type=file capture=…> บนเครื่องบางรุ่นยังเปิดคลังรูปได้ จึงตัดทิ้งทั้งก้อน
            กล้องถูกบล็อก = ต้องไปเปิดสิทธิ์ ไม่มีประตูหลัง (ต่างจากเซลฟี่เช็คอินที่ยังมี) */}
      </div>
    </div>
  )
}

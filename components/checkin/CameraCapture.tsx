// components/checkin/CameraCapture.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, RotateCcw, Check, X, Loader2, AlertCircle } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void
  onCancel: () => void
  uploading?: boolean
}

export default function CameraCapture({ onCapture, onCancel, uploading = false }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [photo, setPhoto] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    try {
      setCameraLoading(true)
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // iOS/WebView บางตัวไม่เริ่มเล่นเองแม้มี autoPlay — ภาพดำแล้วปุ่มถ่ายค้าง disabled
        videoRef.current.play().catch(() => {})
      }
      // บางเครื่อง onLoadedMetadata ไม่ยิง → ปลดล็อกปุ่มถ่ายเองหลังได้ stream แล้ว
      setTimeout(() => setCameraLoading(false), 2500)
    } catch {
      setError('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้กล้องในการตั้งค่าเบราว์เซอร์ หรือใช้ปุ่ม "ถ่ายด้วยแอปกล้องของเครื่อง" ด้านล่าง')
      setCameraLoading(false)
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  // ทางสำรอง: แอปกล้องของเครื่อง (ใช้ได้แม้เบราว์เซอร์ถูกบล็อกสิทธิ์กล้อง)
  // วาดลง canvasRef แล้วเข้าเส้นทางยืนยัน/ถ่ายใหม่เดิมได้เลย
  const photoFromFile = (file: File) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      setPhoto(canvas.toDataURL('image/jpeg', 0.85))
      URL.revokeObjectURL(url)
      stopCamera()
    }
    img.src = url
  }

  const capturePhoto = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    // ภาพยังไม่มา (videoWidth = 0) — ถ่ายไปก็ได้รูปดำ
    if (!video.videoWidth) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext('2d')!
    // Mirror horizontally so selfie looks natural
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)

    setPhoto(canvas.toDataURL('image/jpeg', 0.85))
    stopCamera()
  }

  const retake = () => {
    setPhoto(null)
    startCamera()
  }

  const confirm = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      if (blob) onCapture(blob)
    }, 'image/jpeg', 0.85)
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-600" />
            ถ่ายรูปเพื่อเช็คอิน
          </h3>
          <button
            onClick={onCancel}
            disabled={uploading}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Camera / Photo area */}
        <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
          {/* Loading indicator */}
          {cameraLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
              <p className="text-white text-sm">{error}</p>
            </div>
          )}

          {/* Live camera feed */}
          {!photo && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              onLoadedMetadata={() => setCameraLoading(false)}
              onCanPlay={() => setCameraLoading(false)}
            />
          )}

          {/* Captured photo preview */}
          {photo && (
            <img src={photo} alt="selfie" className="w-full h-full object-cover" />
          )}

          {/* Face guide oval — shows when camera is live */}
          {!photo && !error && !cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-44 h-60 border-4 border-white/70 rounded-full" />
            </div>
          )}

          {/* Uploading overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
              <p className="text-white text-sm">กำลังบันทึก...</p>
            </div>
          )}
        </div>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        <div className="p-4">
          {!photo ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onCancel}
                  disabled={uploading}
                >
                  ยกเลิก
                </Button>
                {error ? (
                  <Button
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={startCamera}
                    disabled={uploading}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    ลองอีกครั้ง
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={capturePhoto}
                    disabled={cameraLoading || uploading}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    ถ่ายรูป
                  </Button>
                )}
              </div>
              {/* ทางสำรองเมื่อเบราว์เซอร์ใช้กล้องไม่ได้ — เรียกแอปกล้องของเครื่องแทน */}
              <label className="block w-full text-center text-sm text-gray-500 underline cursor-pointer">
                กล้องไม่ขึ้น? ถ่ายด้วยแอปกล้องของเครื่อง
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  disabled={uploading}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) photoFromFile(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={retake}
                disabled={uploading}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                ถ่ายใหม่
              </Button>
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={confirm}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                ยืนยัน
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// components/checkin/CameraCapture.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, RotateCcw, Check, X, Loader2, AlertCircle } from 'lucide-react'

import { Button } from '@/components/aoo'
import { cameraFailureMessage, chromeCheckinIntent } from '@/lib/camera/recovery'
interface CameraCaptureProps {
  onCapture: (blob: Blob) => void
  onCancel: () => void
  uploading?: boolean
}

export default function CameraCapture({ onCapture, onCancel, uploading = false }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const requestRef = useRef(0)
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other')
  const [chromeUrl, setChromeUrl] = useState('')

  const [photo, setPhoto] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    requestRef.current += 1
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current)
    readyTimerRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startCamera = useCallback(async () => {
    stopCamera()
    const request = requestRef.current
    setCameraLoading(true)
    setError(null)
    const cameraError = 'ยังไม่ได้รับภาพจากกล้อง หากมีหน้าต่างขอสิทธิ์ให้กดอนุญาต แล้วลองอีกครั้ง หรือตรวจสอบสิทธิ์ตามขั้นตอนด้านล่าง'
    // บาง WebView ไม่ส่งภาพหรือไม่ตอบคำขอสิทธิ์ — อย่าปลดปุ่มถ่ายด้วยเวลาอย่างเดียว
    readyTimerRef.current = setTimeout(() => {
      if (request !== requestRef.current) return
      stopCamera()
      setError(cameraError)
      setCameraLoading(false)
    }, 20000)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        stopCamera()
        setError('เบราว์เซอร์นี้เปิดกล้องไม่ได้ กรุณาเปิดหน้าเช็คอินใน Chrome หรือ Safari โดยตรง')
        setCameraLoading(false)
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      // ปิดหน้าต่าง/ลองใหม่ระหว่างรออนุญาต: ปล่อยกล้องจากคำขอเก่าทันที
      if (request !== requestRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stopCamera()
        return
      }
      video.srcObject = stream
      await video.play()
    } catch (cause) {
      if (request !== requestRef.current) return
      stopCamera()
      setError(cameraFailureMessage(cause))
      setCameraLoading(false)
    }
  }, [stopCamera])

  useEffect(() => {
    const ua = navigator.userAgent ?? ''
    setPlatform(/Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'other')
    if (/Android/i.test(ua)) setChromeUrl(chromeCheckinIntent(window.location.origin))
    void startCamera()
    return stopCamera
  }, [startCamera, stopCamera])

  const cameraReady = () => {
    const video = videoRef.current
    if (!streamRef.current || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current)
    readyTimerRef.current = null
    setCameraLoading(false)
  }

  const capturePhoto = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    const track = streamRef.current?.getVideoTracks()[0]
    if (!canvas || !video || cameraLoading || error || uploading) return
    if (!track || track.readyState !== 'live' || track.muted || video.paused || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      stopCamera()
      setError('ภาพจากกล้องหยุดแล้ว กรุณากด “ลองอีกครั้ง” เพื่อถ่ายสด')
      return
    }

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
    if (!canvas || !photo || uploading) return
    canvas.toBlob(blob => {
      if (blob) onCapture(blob)
    }, 'image/jpeg', 0.85)
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-y-auto max-h-[90dvh] w-full max-w-sm shadow-2xl">
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
        <div className="relative bg-black" style={{ aspectRatio: error ? undefined : '3/4' }}>
          {/* Loading indicator */}
          {cameraLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div role="alert" className="relative flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
              <p className="text-white text-sm">{error}</p>
            </div>
          )}

          {/* Live camera feed */}
          <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover${photo || error ? ' hidden' : ''}`}
              style={{ transform: 'scaleX(-1)' }}
              onCanPlay={cameraReady}
              onPlaying={cameraReady}
            />

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
                <Button variant="soft" className="flex-1" onClick={onCancel} disabled={uploading}>
                  ยกเลิก
                </Button>
                {error ? (
                  <Button className="flex-1" onClick={startCamera} disabled={uploading}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    ลองอีกครั้ง
                  </Button>
                ) : (
                  <Button className="flex-1" onClick={capturePhoto} disabled={cameraLoading || uploading}>
                    <Camera className="w-4 h-4 mr-2" />
                    ถ่ายรูป
                  </Button>
                )}
              </div>
              {error && (
                <div className="space-y-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  {platform === 'android' && chromeUrl && (
                    <>
                      <a href={chromeUrl} className="flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">
                        เปิดหน้าเช็คอินใน Chrome
                      </a>
                      <p>ถ้าปุ่มไม่เปิด Chrome ให้กดเมนู ⋮ ของเบราว์เซอร์ แล้วเลือกเปิดใน Chrome หรือเปิดลิงก์นี้ใน Chrome เอง: <span className="break-all select-all">https://app.amgovenger.com/checkin</span></p>
                    </>
                  )}
                  <details>
                    <summary className="min-h-11 cursor-pointer py-2 font-semibold text-teal-800">ดูวิธีอนุญาตกล้อง</summary>
                    {platform === 'ios' ? (
                      <ol className="list-decimal space-y-2 pl-5">
                        <li>เปิดหน้าเช็คอินใน Safari แล้วเปิดเมนูหน้าเว็บ → การตั้งค่าเว็บไซต์ → กล้อง → อนุญาต</li>
                        <li>กลับมาหน้าเช็คอิน แล้วกด “ลองอีกครั้ง”</li>
                      </ol>
                    ) : (
                      <ol className="list-decimal space-y-2 pl-5">
                        <li>เปิด Chrome → ⋮ → การตั้งค่า → การตั้งค่าเว็บไซต์ → กล้อง</li>
                        <li>เปิดให้เว็บไซต์ขอใช้กล้องได้ หากพบ app.amgovenger.com ในรายการที่บล็อก ให้เลือกเว็บไซต์แล้วกดอนุญาต</li>
                        {platform === 'android' && <li>ถ้ายังไม่ได้: เปิดการตั้งค่ามือถือ → แอป → Chrome → สิทธิ์ → กล้อง → อนุญาตขณะใช้แอป และตรวจว่าสวิตช์ “การเข้าถึงกล้อง” ของเครื่องเปิดอยู่</li>}
                        <li>กลับมาหน้าเช็คอิน แล้วกด “ลองอีกครั้ง”</li>
                      </ol>
                    )}
                    <p className="mt-3">หากเปิดเว็บผ่านแอปอื่น ให้ตรวจสิทธิ์กล้องของแอปนั้นด้วย ชื่อเมนูอาจต่างกันตามเครื่อง</p>
                  </details>
                </div>
              )}
              <p className="text-center text-sm text-gray-500">
                ต้องถ่ายจากกล้องสด ไม่สามารถเลือกรูปจากคลังได้
              </p>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="soft" className="flex-1" onClick={retake} disabled={uploading}>
                <RotateCcw className="w-4 h-4 mr-2" />
                ถ่ายใหม่
              </Button>
              <Button className="flex-1" onClick={confirm} disabled={uploading}>
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

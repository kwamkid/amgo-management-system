'use client'

/**
 * <ImageCropper /> — crop แบบ Instagram/Canva: กรอบ crop รูปทรงคงที่
 * แล้วลาก + ซูม "ตัวรูป" ข้างในกรอบเพื่อเลือกส่วนที่จะเอา
 *
 * พอร์ตมาจาก aoosocial (image-cropper.tsx) — ตัด smartcrop ออก
 * (ของเดิมใช้หาหน้าคนเพื่อตั้งกรอบเริ่มต้น — ที่นี่ใช้ crop โลโก้/รูปทั่วไป
 * ให้ react-easy-crop จัดกึ่งกลางเองพอ) และตัด next-intl (โปรเจกต์นี้ไทยล้วน)
 *
 * aspect chips: "เต็มรูป" (null) = กรอบตามสัดส่วนรูปเอง ไม่ตัดอะไรทิ้ง
 * · อัตราส่วนอื่นเป็นกรอบคงที่ ผู้ใช้ลาก/ซูมเลือกเอง
 */

import { useCallback, useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { Button } from './button'

/** อัตราส่วนที่ให้เลือก — `aspect: null` = "เต็มรูป" (ทั้งรูป ไม่ตัด) */
export interface AspectOption {
  label: string
  aspect: number | null
}

export const DEFAULT_ASPECT_OPTIONS: AspectOption[] = [
  { label: 'เต็มรูป', aspect: null },
  { label: '1:1', aspect: 1 },
  { label: '4:5', aspect: 4 / 5 },
  { label: '16:9', aspect: 16 / 9 },
]

export interface ImageCropperProps {
  /** Object URL หรือ data URL ของรูปต้นทาง */
  src: string
  /** ตัวเลือกอัตราส่วน — ตัวแรกคือค่าเริ่มต้น */
  aspectOptions?: AspectOption[]
  /** ความยาวด้านยาวของรูปผลลัพธ์ (px) — ค่าเริ่มต้น 1080 */
  outputSize?: number
  /** ชนิดไฟล์ผลลัพธ์ — png คงพื้นหลังโปร่งของโลโก้ไว้ได้ */
  outputType?: 'image/jpeg' | 'image/png'
  /** คุณภาพ JPEG 0–1 (ค่าเริ่มต้น 0.9) */
  quality?: number
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.2

export function ImageCropper({
  src,
  aspectOptions = DEFAULT_ASPECT_OPTIONS,
  outputSize = 1080,
  outputType = 'image/jpeg',
  quality = 0.9,
  onConfirm,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedAspect, setSelectedAspect] = useState<number | null>(
    aspectOptions[0]?.aspect ?? null
  )

  // สัดส่วนจริงของรูป — ใช้เป็นกรอบของโหมด "เต็มรูป"
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled && img.naturalHeight > 0) {
        setNaturalAspect(img.naturalWidth / img.naturalHeight)
      }
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  const effectiveAspect = selectedAspect ?? naturalAspect ?? 1

  const onAspectChange = (aspect: number | null) => {
    setSelectedAspect(aspect)
    setZoom(1)
    setCrop({ x: 0, y: 0 })
  }

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setAreaPixels(pixels)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!areaPixels) return
    setBusy(true)
    try {
      const blob = await renderCroppedBlob(src, areaPixels, outputSize, outputType, quality)
      if (blob) onConfirm(blob)
    } finally {
      setBusy(false)
    }
  }, [areaPixels, src, outputSize, outputType, quality, onConfirm])

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* aspect chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {aspectOptions.map((opt) => {
          const isActive = selectedAspect === opt.aspect
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onAspectChange(opt.aspect)}
              style={{
                padding: '5px 12px',
                fontSize: 13,
                fontWeight: 500,
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-2)'}`,
                background: isActive ? 'var(--accent-soft)' : 'var(--bg-surface)',
                color: isActive ? 'var(--accent)' : 'var(--fg-2)',
                borderRadius: 'var(--r-md)',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* กรอบ crop รูปทรงคงที่ — รูปลาก/ซูมข้างใน
          ใช้ objectFit="contain" เสมอ: โหมด cover ของ react-easy-crop คำนวณแกนพลาด
          ทำรูปยืด (บทเรียนจาก aoosocial) — contain ไม่บิดรูป ซูมเข้าเองเมื่ออยากตัด */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: effectiveAspect >= 1 ? '100%' : 'auto',
            maxWidth: 380,
            height: effectiveAspect >= 1 ? 'auto' : 475,
            aspectRatio: String(effectiveAspect),
            background: 'var(--bg-inverse, #1a1a1a)',
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
          }}
        >
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={effectiveAspect}
            minZoom={ZOOM_MIN}
            maxZoom={ZOOM_MAX}
            objectFit="contain"
            restrictPosition
            showGrid={selectedAspect !== null}
            key={String(effectiveAspect)}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
      </div>

      {/* zoom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--fg-2)' }}>
        <span>ซูม</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
          disabled={zoom <= ZOOM_MIN}
          aria-label="ซูมออก"
        >
          <Minus size={16} />
        </Button>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
          disabled={zoom >= ZOOM_MAX}
          aria-label="ซูมเข้า"
        >
          <Plus size={16} />
        </Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          ยกเลิก
        </Button>
        <Button size="sm" onClick={handleConfirm} disabled={busy || !areaPixels}>
          {busy ? 'กำลังตัดรูป...' : 'ใช้รูปนี้'}
        </Button>
      </div>
    </div>
  )
}

/** วาดส่วนที่เลือกลง canvas แล้วคืนเป็น Blob — area อยู่ในพิกัดพิกเซลของรูปจริง */
export async function renderCroppedBlob(
  src: string,
  area: Area,
  outputSize: number,
  type: string,
  quality: number
): Promise<Blob | null> {
  const img = await loadImage(src)
  const ratio = area.width / area.height
  const outW = ratio >= 1 ? outputSize : Math.round(outputSize * ratio)
  const outH = ratio >= 1 ? Math.round(outputSize / ratio) : outputSize
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outW, outH)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

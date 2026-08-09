'use client'

import { useEffect, useState } from 'react'
import { getImageUrl, type Bucket } from '@/lib/supabase/storage'

/**
 * แสดงรูปที่เก็บใน Supabase Storage
 *
 * ฐานข้อมูลเก็บเป็น "path" ไม่ใช่ URL เพราะ bucket ไม่เปิดสาธารณะ
 * ลิงก์ต้องเซ็นตอนจะแสดงและมีอายุจำกัด — คอมโพเนนต์นี้จัดการให้
 *
 * ข้อมูลเก่าที่ย้ายมาจาก Firebase เก็บเป็น URL เต็ม ก็ใช้ได้เลยไม่ต้องเซ็น
 */
export default function StorageImage({
  bucket,
  path,
  alt,
  className,
  fallback = null,
}: {
  bucket: Bucket
  path?: string | null
  alt: string
  className?: string
  fallback?: React.ReactNode
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    if (!path) {
      setUrl(null)
      return
    }
    getImageUrl(bucket, path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [bucket, path])

  if (!path || failed) return <>{fallback}</>
  if (!url) return <div className={`${className ?? ''} animate-pulse bg-gray-100`} />

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} onError={() => setFailed(true)} />
}

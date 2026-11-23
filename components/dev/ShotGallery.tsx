'use client'

// Dev tracker — row of picture thumbnails that open the shared Lightbox (UAT result history, bug pictures, step pictures)

import { useState } from 'react'
import { Lightbox as AooLightbox } from '@/components/aoo'

/** full-screen viewer (components/aoo Lightbox) over a list of picture URLs */
export function ShotLightbox({ urls, index, onClose }: { urls: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index)
  return <AooLightbox open onClose={onClose} media={urls.map((url) => ({ url }))} index={i} onIndexChange={setI} />
}

export default function ShotGallery({ urls, size = 88 }: { urls: string[]; size?: number }) {
  const [open, setOpen] = useState<number | null>(null)
  if (urls.length === 0) return null
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {urls.map((u, i) => (
          <button key={u} type="button" aria-label={`เปิดรูปที่ ${i + 1}`} onClick={() => setOpen(i)} style={{ padding: 0, border: 0, background: 'none', cursor: 'zoom-in' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
            <img src={u} alt="" loading="lazy" style={{ width: size, height: size, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--border-1)' }} />
          </button>
        ))}
      </div>
      {open !== null && <ShotLightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
    </>
  )
}

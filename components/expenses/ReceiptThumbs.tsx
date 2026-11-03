'use client'

// รูปใบเสร็จ/สลิปย่อ — bucket expense-receipts เป็น private ต้องขอ signed URL ก่อน
// กดรูปแล้วเปิด Lightbox (เลื่อนดูทุกรูปของใบได้) · PDF เปิดในแท็บใหม่

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { Lightbox } from '@/components/aoo'
import { receiptUrls } from '@/lib/services/expenseService'

const isPdf = (p: string) => p.toLowerCase().endsWith('.pdf')

export default function ReceiptThumbs({
  paths,
  size = 48,
  slipPath,
}: {
  paths: string[]
  size?: number
  /** สลิปโอนที่บัญชีแนบ — ต่อท้ายพร้อมป้าย "สลิป" */
  slipPath?: string | null
}) {
  const all = slipPath ? [...paths, slipPath] : paths
  const key = all.join('|')
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    if (!key) return
    let alive = true
    receiptUrls(key.split('|')).then((m) => alive && setUrls(m))
    return () => {
      alive = false
    }
  }, [key])

  if (!all.length) return null

  const images = all.filter((p) => !isPdf(p) && urls.get(p))
  const media = images.map((p) => ({ url: urls.get(p)!, note: p === slipPath ? 'สลิปโอน' : undefined }))

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {all.map((p) => {
        const url = urls.get(p)
        const box = 'relative flex items-center justify-center overflow-hidden rounded-md bg-gray-100 ring-1 ring-gray-200'
        const label = p === slipPath ? 'สลิปโอน' : 'ใบเสร็จ'
        if (isPdf(p) || !url) {
          return (
            <a key={p} href={url} target="_blank" rel="noreferrer" className={box} style={{ width: size, height: size }} title={`เปิด ${label}`}>
              <FileText size={18} className="text-gray-400" />
            </a>
          )
        }
        return (
          <button
            key={p}
            type="button"
            className={box}
            style={{ width: size, height: size }}
            title={`ดู${label}`}
            onClick={() => setOpen(images.indexOf(p))}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="h-full w-full object-cover" />
            {p === slipPath && (
              <span className="absolute inset-x-0 bottom-0 bg-green-700 text-center text-[9px] font-semibold leading-3 text-white">สลิป</span>
            )}
          </button>
        )
      })}
      <Lightbox open={open !== null} onClose={() => setOpen(null)} media={media} index={open ?? 0} onIndexChange={setOpen} />
    </div>
  )
}

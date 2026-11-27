'use client'

// รูปใบเสร็จ/ใบแจ้งหนี้/สลิปของใบเดียว แบบใหญ่ — หน้ารายละเอียดใบเบิก (เจ้าของ 3 พ.ย. 69: บัญชีต้องเห็นรูปชัดก่อนอนุมัติ)
// รูปหลักใหญ่ + แถบรูปย่อสลับรูป · กดรูปหลักเปิด Lightbox เต็มจอ · PDF แสดงตัวอย่างในกรอบ (iframe) + ปุ่มเปิดแท็บใหม่

import { useEffect, useState } from 'react'
import { ExternalLink, FileText, Maximize2 } from 'lucide-react'
import { Lightbox } from '@/components/aoo'
import { receiptUrls } from '@/lib/services/expenseService'

const isPdf = (p: string) => p.toLowerCase().endsWith('.pdf')

export default function ReceiptGallery({ paths, slipPath }: { paths: string[]; slipPath?: string | null }) {
  const all = slipPath ? [...paths, slipPath] : paths
  const key = all.join('|')
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [current, setCurrent] = useState(0)
  const [zoom, setZoom] = useState<number | null>(null)

  useEffect(() => {
    setCurrent(0)
    if (!key) return
    let alive = true
    receiptUrls(key.split('|')).then((m) => alive && setUrls(m))
    return () => {
      alive = false
    }
  }, [key])

  if (!all.length) return null
  const path = all[Math.min(current, all.length - 1)]
  const url = urls.get(path)
  const label = (p: string) => (p === slipPath ? 'สลิปโอน' : `ไฟล์ ${all.indexOf(p) + 1}`)
  const images = all.filter((p) => !isPdf(p) && urls.get(p))

  return (
    <div className="space-y-2">
      <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl bg-gray-100">
        {!url ? (
          <span className="text-sm text-gray-400">กำลังโหลด…</span>
        ) : isPdf(path) ? (
          <>
            {/* ตัวอย่าง PDF ในกรอบ (เจ้าของ 27 พ.ย.) — เบราว์เซอร์มือถือบางตัวโชว์แค่หน้าแรก จึงคงปุ่มเปิดแท็บใหม่ไว้ */}
            <iframe src={`${url}#view=FitH`} title={label(path)} className="h-full w-full border-0 bg-white" />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white hover:bg-black/75"
            >
              เปิดแท็บใหม่ <ExternalLink size={12} />
            </a>
          </>
        ) : (
          <button type="button" className="h-full w-full" onClick={() => setZoom(images.indexOf(path))} title="ดูเต็มจอ">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label(path)} className="h-full w-full object-contain" />
            <span className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white">
              <Maximize2 size={14} />
            </span>
          </button>
        )}
        {path === slipPath && (
          <span className="absolute left-2 top-2 rounded-full bg-green-700 px-2 py-0.5 text-xs font-semibold text-white">สลิปโอน</span>
        )}
      </div>

      {all.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {all.map((p, i) => {
            const u = urls.get(p)
            return (
              <button
                key={p}
                type="button"
                onClick={() => setCurrent(i)}
                aria-pressed={i === current}
                title={label(p)}
                className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-gray-100 ring-2 ${
                  i === current ? 'ring-red-500' : 'ring-transparent'
                }`}
              >
                {u && !isPdf(p) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u} alt={label(p)} className="h-full w-full object-cover" />
                ) : (
                  <FileText size={18} className="text-gray-400" />
                )}
              </button>
            )
          })}
        </div>
      )}

      <Lightbox
        open={zoom !== null}
        onClose={() => setZoom(null)}
        media={images.map((p) => ({ url: urls.get(p)!, note: p === slipPath ? 'สลิปโอน' : undefined }))}
        index={zoom ?? 0}
        onIndexChange={setZoom}
      />
    </div>
  )
}

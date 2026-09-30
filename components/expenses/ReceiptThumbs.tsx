'use client'

// รูปใบเสร็จย่อ — bucket expense-receipts เป็น private ต้องขอ signed URL ก่อน
// กดแล้วเปิดรูปเต็มในแท็บใหม่ (PDF ก็เปิดได้ในแท็บ)

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { receiptUrls } from '@/lib/services/expenseService'

export default function ReceiptThumbs({ paths, size = 48 }: { paths: string[]; size?: number }) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!paths.length) return
    let alive = true
    receiptUrls(paths).then((m) => alive && setUrls(m))
    return () => {
      alive = false
    }
  }, [paths])

  if (!paths.length) return null

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {paths.map((p) => {
        const url = urls.get(p)
        const isPdf = p.toLowerCase().endsWith('.pdf')
        return (
          <a
            key={p}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center overflow-hidden rounded-md bg-gray-100 ring-1 ring-gray-200"
            style={{ width: size, height: size }}
            title="ดูใบเสร็จ"
          >
            {url && !isPdf ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="ใบเสร็จ" className="h-full w-full object-cover" />
            ) : (
              <FileText size={18} className="text-gray-400" />
            )}
          </a>
        )
      })}
    </div>
  )
}

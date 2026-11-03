'use client'

// รูปย่อหน้าแถวใบเบิก = รูปแรกของใบ (เจ้าของ 3 พ.ย. 69) · มีหลายไฟล์ขึ้นจำนวนที่มุม · ไม่มีรูป = ไอคอนหมวด
// ขอลิงก์รูปแรกของทุกใบในรายการทีเดียว (useFirstReceiptUrls) — ไม่ยิงทีละแถว

import { useEffect, useState } from 'react'
import { IconChip } from '@/components/aoo'
import { formSectionOf, receiptUrls, type ExpenseClaim } from '@/lib/services/expenseService'
import { SECTION_VISUAL } from './expenseVisuals'

const firstImage = (c: ExpenseClaim) => c.receiptPaths.find((p) => !p.toLowerCase().endsWith('.pdf')) ?? null

/** claimId → signed URL ของรูปแรก */
export function useFirstReceiptUrls(claims: ExpenseClaim[]): Map<string, string> {
  const key = claims.map((c) => firstImage(c) ?? '').join('|')
  const [map, setMap] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    const paths = claims.map(firstImage).filter((p): p is string => !!p)
    if (!paths.length) {
      setMap(new Map())
      return
    }
    let alive = true
    receiptUrls(paths).then((urls) => {
      if (!alive) return
      const m = new Map<string, string>()
      for (const c of claims) {
        const p = firstImage(c)
        const u = p && urls.get(p)
        if (u) m.set(c.id, u)
      }
      setMap(m)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return map
}

export default function ClaimThumb({ claim, url, size = 48 }: { claim: ExpenseClaim; url?: string; size?: number }) {
  const files = claim.receiptPaths.length + (claim.slipPath ? 1 : 0)
  if (!url) {
    const sec = formSectionOf(claim.category, claim.vatAmount)
    return <IconChip icon={SECTION_VISUAL[sec].icon} tone={SECTION_VISUAL[sec].tone} size={size} />
  }
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      {files > 1 && (
        <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/65 px-1 text-[11px] font-semibold leading-4 text-white">
          {files}
        </span>
      )}
    </span>
  )
}

'use client'

// หน้าให้โรงงานต่างประเทศดาวน์โหลดไฟล์ฉลาก สคบ. (ไม่ต้องล็อกอิน · เจ้าของ 30 ต.ค. 69)
// ภาษาอังกฤษ + จีน เพราะคนเปิดคือโรงงาน (Hape Ningbo) · ไม่มีทุน/FOB ในหน้านี้
// ไฟล์ PDF สร้างสดจากข้อมูลล่าสุดทุกครั้งที่กด — เจ้าของแก้แล้วลิงก์เดิมได้ไฟล์ใหม่เลย

import { use, useEffect, useState } from 'react'
import { Sticker } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { Alert } from '@/components/aoo'
import { LabelDownloads } from '@/components/labels/LabelDownloads'
import { DataTable, TechLoader } from '@/components/shared'

interface Share {
  name: string
  sharedAt: string | null
  sizes: { size: string; lines: number; copies: number }[]
  lines: { code: string; name: string; size: string; qty: number; copies: number }[]
}

const mm = (s: string) => s.replace('x', ' × ') + ' mm'


export default function LabelSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<Share | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch(`/api/labels/share?t=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true))
  }, [token])

  if (err) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Alert tone="error" title="Link not available · 链接无效">This link was closed or does not exist. Please ask AG Dragon for a new link. · 此链接已关闭或不存在，请联系 AG Dragon 获取新链接。</Alert>
      </main>
    )
  }
  if (!data) return <TechLoader />

  const total = data.sizes.reduce((s, x) => s + x.copies, 0)

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* print errors (LabelDownloads → toast) — the admin layout has its own Toaster, this page has none */}
      <Toaster />
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-[var(--fg-3)]"><Sticker size={16} /> AG Dragon Co., Ltd. · Thailand</div>
        <h1 className="text-2xl font-semibold">Thai product labels · 泰国产品标签</h1>
        <p className="text-[var(--fg-2)]">{data.name}</p>
      </header>

      <Alert tone="info" title="Please print and stick one label on every retail box · 请打印并在每个零售包装盒上贴一张标签">
        Thai consumer-protection (OCPB / สคบ.) labels. Print at <b>100% scale (actual size)</b>, black only. Text is already converted to outlines — no Thai font needed.
        Copies include spare labels. {total.toLocaleString()} labels in total.
        <br />
        泰国消费者保护局 (OCPB) 标签。请按 <b>100% 实际尺寸</b> 黑色打印。文字已转曲，无需泰文字体。数量已含备用标签，共 {total.toLocaleString()} 张。
      </Alert>

      <section className="border-t border-[var(--border-1)] pt-5">
        <LabelDownloads lang="en" fileName="labels" lines={data.lines}
          pdfUrl={(size, mode, dl) => `/api/labels/pdf?t=${encodeURIComponent(token)}&size=${size}&mode=${mode}${dl ? '&dl=1' : ''}`} />
      </section>

      <section className="space-y-3 border-t border-[var(--border-1)] pt-5">
        <h2 className="text-lg font-semibold">Quantities · 数量</h2>
        <DataTable
          rows={data.lines}
          rowKey={(l) => l.code}
          columns={[
            { key: 'code', header: 'Item · 货号', mobilePrimary: true, cell: (l) => <b>{l.code}</b>, sortValue: (l) => l.code },
            { key: 'name', header: 'Name · 名称', cell: (l) => l.name },
            { key: 'size', header: 'Size · 尺寸', cell: (l) => <span className="whitespace-nowrap">{mm(l.size)}</span>, sortValue: (l) => l.size },
            { key: 'qty', header: 'Ordered · 订购', align: 'right', cell: (l) => l.qty.toLocaleString() },
            { key: 'copies', header: 'Labels · 标签', align: 'right', cell: (l) => l.copies.toLocaleString(), sortValue: (l) => l.copies },
          ]}
        />
      </section>
    </main>
  )
}

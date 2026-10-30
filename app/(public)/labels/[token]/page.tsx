'use client'

// หน้าให้โรงงานต่างประเทศดาวน์โหลดไฟล์ฉลาก สคบ. (ไม่ต้องล็อกอิน · เจ้าของ 30 ต.ค. 69)
// ภาษาอังกฤษ + จีน เพราะคนเปิดคือโรงงาน (Hape Ningbo) · ไม่มีทุน/FOB ในหน้านี้
// ไฟล์ PDF สร้างสดจากข้อมูลล่าสุดทุกครั้งที่กด — เจ้าของแก้แล้วลิงก์เดิมได้ไฟล์ใหม่เลย

import { use, useEffect, useState } from 'react'
import { Download, FileText, Sticker } from 'lucide-react'
import { Alert, Button } from '@/components/aoo'
import { DataTable, TechLoader } from '@/components/shared'

interface Share {
  name: string
  sharedAt: string | null
  sizes: { size: string; lines: number; copies: number }[]
  lines: { code: string; name: string; size: string; qty: number; copies: number }[]
}

const mm = (s: string) => s.replace('x', ' × ') + ' mm'

const MODES = [
  { mode: 'sheet', en: 'A4 sheets, all copies (crop marks)', zh: 'A4 排版，全部数量（含裁切线）' },
  { mode: 'single', en: 'One label per page, all copies (roll / label printer)', zh: '每页一张，全部数量（卷筒标签打印机）' },
  { mode: 'master', en: 'One page per item code — set copies from the table below', zh: '每个货号一页 — 按下表设置打印份数' },
]

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
  const pdf = (size: string, mode: string) => `/api/labels/pdf?t=${encodeURIComponent(token)}&size=${size}&mode=${mode}&dl=1`

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
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

      {data.sizes.map((s) => (
        <section key={s.size} className="space-y-3 border-t border-[var(--border-1)] pt-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText size={18} /> Label size · 标签尺寸 {mm(s.size)}
          </h2>
          <p className="text-sm text-[var(--fg-3)]">
            {s.lines} item codes · 货号 — {s.copies.toLocaleString()} labels · 张
          </p>
          <div className="flex flex-col gap-2">
            {MODES.map((m) => (
              <div key={m.mode} className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <div>{m.en}</div>
                  <div className="text-[var(--fg-3)]">{m.zh}</div>
                </div>
                <Button variant={m.mode === 'sheet' ? 'primary' : 'secondary'} icon={Download} href={pdf(s.size, m.mode)}>PDF</Button>
              </div>
            ))}
          </div>
        </section>
      ))}

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

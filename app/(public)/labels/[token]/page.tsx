'use client'

// หน้าให้โรงงานต่างประเทศดาวน์โหลดไฟล์ฉลาก สคบ. (ไม่ต้องล็อกอิน · เจ้าของ 30 ต.ค. 69)
// ปุ่มเปลี่ยนภาษาแบบ aoo (อังกฤษ · จีน · ไทย) — เริ่มตามภาษาเบราว์เซอร์ จำไว้ในเครื่อง · ไม่มีทุน/FOB ในหน้านี้
// ไฟล์ PDF สร้างสดจากข้อมูลล่าสุดทุกครั้งที่กด — เจ้าของแก้แล้วลิงก์เดิมได้ไฟล์ใหม่เลย

import { use, useEffect, useMemo, useState } from 'react'
import { Search, Sticker } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { Alert, Input, Pagination } from '@/components/aoo'
import { LabelDownloads } from '@/components/labels/LabelDownloads'
import { DataTable, LanguageSwitcher, TechLoader, type UiLang } from '@/components/shared'

interface Share {
  name: string
  sharedAt: string | null
  sizes: { size: string; lines: number; copies: number }[]
  lines: { code: string; name: string; size: string; qty: number; copies: number }[]
}

const LANG_KEY = 'labels.lang'
const PAGE_SIZE = 20

const T: Record<UiLang, {
  title: string; noticeTitle: string; notice: (n: number) => string; expiredTitle: string; expired: string
  qty: string; search: string; item: string; name: string; size: string; ordered: string; labels: string
  shown: (a: number, b: number, n: number) => string; none: string
}> = {
  en: {
    title: 'Thai product labels',
    noticeTitle: 'Please print and stick one label on every retail box',
    notice: (n) => `Thai consumer-protection (OCPB / สคบ.) labels. Text is already converted to outlines — no Thai font needed. Quantities include spare labels: ${n.toLocaleString()} labels in total.`,
    expiredTitle: 'Link not available', expired: 'This link was closed or does not exist. Please ask AG Dragon for a new link.',
    qty: 'Quantities', search: 'Search item code or name', item: 'Item', name: 'Name', size: 'Size', ordered: 'Ordered', labels: 'Labels',
    shown: (a, b, n) => `${a}–${b} of ${n}`, none: 'No matching items',
  },
  zh: {
    title: '泰国产品标签',
    noticeTitle: '请打印并在每个零售包装盒上贴一张标签',
    notice: (n) => `泰国消费者保护局 (OCPB / สคบ.) 标签。文字已转曲，无需泰文字体。数量已含备用标签：共 ${n.toLocaleString()} 张。`,
    expiredTitle: '链接无效', expired: '此链接已关闭或不存在，请联系 AG Dragon 获取新链接。',
    qty: '数量', search: '搜索货号或名称', item: '货号', name: '名称', size: '尺寸', ordered: '订购', labels: '标签',
    shown: (a, b, n) => `第 ${a}–${b} 项，共 ${n} 项`, none: '没有符合的货号',
  },
  th: {
    title: 'ฉลากสินค้า สคบ.',
    noticeTitle: 'พิมพ์แล้วติดฉลาก 1 ดวงบนกล่องสินค้าทุกกล่อง',
    notice: (n) => `ฉลากตามกฎ สคบ. ตัวหนังสือแปลงเป็นเส้นแล้ว ไม่ต้องมีฟอนต์ไทยในเครื่อง · จำนวนรวมเผื่อเสียแล้ว ทั้งหมด ${n.toLocaleString()} ดวง`,
    expiredTitle: 'ลิงก์ใช้ไม่ได้', expired: 'ลิงก์นี้ถูกปิดหรือไม่มีอยู่ ติดต่อ AG Dragon เพื่อขอลิงก์ใหม่',
    qty: 'จำนวน', search: 'ค้นหารหัสหรือชื่อสินค้า', item: 'รหัส', name: 'ชื่อ', size: 'ขนาด', ordered: 'สั่ง', labels: 'ดวง',
    shown: (a, b, n) => `${a}–${b} จาก ${n}`, none: 'ไม่พบรายการ',
  },
}

const mm = (s: string) => s.replace('x', ' × ') + ' mm'

function startLang(): UiLang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'zh' || saved === 'th') return saved
  } catch { /* storage blocked */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : ''
  return nav.startsWith('zh') ? 'zh' : nav.startsWith('th') ? 'th' : 'en'
}

export default function LabelSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<Share | null>(null)
  const [err, setErr] = useState(false)
  const [lang, setLangState] = useState<UiLang>('en')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => { setLangState(startLang()) }, [])
  const setLang = (l: UiLang) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch { /* storage blocked */ }
  }

  useEffect(() => {
    fetch(`/api/labels/share?t=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true))
  }, [token])

  const t = T[lang]
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase()
    return (data?.lines ?? []).filter((l) => !k || l.code.toLowerCase().includes(k) || l.name.toLowerCase().includes(k))
  }, [data, q])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const cur = Math.min(page, pageCount)
  const shown = rows.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-[var(--fg-3)]"><Sticker size={16} /> AG Dragon Co., Ltd. · Thailand</div>
        <h1 className="text-xl font-semibold sm:text-2xl">{t.title}</h1>
        {data && <p className="text-[var(--fg-2)]">{data.name}</p>}
      </div>
      <LanguageSwitcher value={lang} onChange={setLang} />
    </div>
  )

  if (err) {
    return (
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        {header}
        <Alert tone="error" title={t.expiredTitle}>{t.expired}</Alert>
      </main>
    )
  }
  if (!data) return <TechLoader />

  const total = data.sizes.reduce((s, x) => s + x.copies, 0)

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:space-y-6 sm:py-8" lang={lang === 'zh' ? 'zh-CN' : lang}>
      {/* print/download errors (LabelDownloads → toast) — the admin layout has its own Toaster, this page has none */}
      <Toaster />
      {header}

      <Alert tone="info" compact title={t.noticeTitle}>{t.notice(total)}</Alert>

      <section className="border-t border-[var(--border-1)] pt-5">
        <LabelDownloads lang={lang} fileName="labels" lines={data.lines}
          previewUrl={(code) => `/api/labels/preview?t=${encodeURIComponent(token)}&code=${encodeURIComponent(code)}`}
          pdfUrl={(size, mode, dl) => `/api/labels/pdf?t=${encodeURIComponent(token)}&size=${size}&mode=${mode}${dl ? '&dl=1' : ''}`} />
      </section>

      <section className="space-y-3 border-t border-[var(--border-1)] pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{t.qty}</h2>
          <div className="ml-auto w-full sm:w-72">
            <Input prefix={<Search size={16} />} value={q} placeholder={t.search} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          </div>
        </div>
        {/* phones: one compact line per item (DataTable's card view used ~160 px per item) */}
        <div className="divide-y divide-[var(--border-1)] rounded-lg border border-[var(--border-1)] bg-[var(--bg-surface)] sm:hidden">
          {shown.length ? shown.map((l) => (
            <div key={l.code} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm"><b>{l.code}</b> <span className="text-[var(--fg-2)]">{l.name}</span></div>
                <div className="text-xs text-[var(--fg-3)]">{mm(l.size)} · {t.ordered} {l.qty.toLocaleString()}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold">{l.copies.toLocaleString()}</div>
                <div className="text-xs text-[var(--fg-3)]">{t.labels}</div>
              </div>
            </div>
          )) : <div className="px-3 py-6 text-center text-sm text-[var(--fg-3)]">{t.none}</div>}
        </div>
        <div className="hidden sm:block">
        <DataTable
          rows={shown}
          rowKey={(l) => l.code}
          emptyTitle={t.none}
          columns={[
            { key: 'code', header: t.item, mobilePrimary: true, cell: (l) => <b>{l.code}</b> },
            { key: 'name', header: t.name, cell: (l) => l.name },
            { key: 'size', header: t.size, cell: (l) => <span className="whitespace-nowrap">{mm(l.size)}</span> },
            { key: 'qty', header: t.ordered, align: 'right', cell: (l) => l.qty.toLocaleString() },
            { key: 'copies', header: t.labels, align: 'right', cell: (l) => l.copies.toLocaleString() },
          ]}
        />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-[var(--fg-3)]">
            {rows.length ? t.shown((cur - 1) * PAGE_SIZE + 1, Math.min(cur * PAGE_SIZE, rows.length), rows.length) : ''}
          </span>
          {pageCount > 1 && <Pagination currentPage={cur} pageCount={pageCount} onPageChange={setPage} />}
        </div>
      </section>
    </main>
  )
}

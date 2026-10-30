'use client'

// เลือกแบบพิมพ์ฉลาก สคบ. ของหน้าโรงงาน /labels/<token> — 3 แบบ มีภาพตัวอย่าง (ใช้ฉลากจริงของรอบนั้น)
// แยกตามขนาดสติ๊กเกอร์ · "พิมพ์" = วิธีเดียวกับบิล AOO (lib/utils/printPdf.ts) · "ดาวน์โหลด" = bgDownload
// ไฟล์เกิน MAX_PRINT_PAGES ไม่มีปุ่มพิมพ์ (หน้าต่างพิมพ์ของ Chrome ค้างที่ "Loading preview") — บอกให้ดาวน์โหลดแทน
// (หน้าแอดมินใช้ "ติ๊กแถว → พิมพ์…" + "ดาวน์โหลดทั้งตู้" ของตัวเอง)

import { useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/aoo'
import type { UiLang } from '@/components/shared'
import { useToast } from '@/hooks/useToast'
import { bgDownload, type BgDownloadText } from '@/lib/utils/bgDownload'
import { fetchPdf, printWithPreOpen } from '@/lib/utils/printPdf'
import { parseSize, perSheet } from '@/lib/labels/types'

export type LabelPdfMode = 'sheet' | 'single' | 'master'
export interface LabelLineCount { code: string; size: string; copies: number }

const MAX_PRINT_PAGES = 300

const DL_TEXT: Record<'en' | 'zh', BgDownloadText> = {
  en: { already: (l) => `${l} is already being prepared`, working: (l) => `Preparing ${l}… you can keep working, it saves by itself`, done: (f) => `Saved ${f}`, fail: (m) => `Could not build the PDF: ${m}` },
  zh: { already: (l) => `${l} 正在生成`, working: (l) => `正在生成 ${l}…可继续操作，完成后自动保存`, done: (f) => `已保存 ${f}`, fail: (m) => `无法生成 PDF：${m}` },
}
// "one of each" first + default — what the factory uses most (owner 30 Oct)
const MODES: LabelPdfMode[] = ['master', 'single', 'sheet']

const TEXT: Record<UiLang, {
  choose: string; name: Record<LabelPdfMode, string>; desc: Record<LabelPdfMode, (size: string) => string>
  size: (s: string) => string; count: (lines: number, copies: number) => string; pages: (n: number) => string
  print: string; dl: string; tooBig: string; note: string; fail: string
}> = {
  en: {
    choose: 'Choose how to print',
    name: { single: 'One label per page', sheet: 'A4 sheets', master: 'One of each item' },
    desc: {
      single: (s) => `For a roll / label printer. Each page is one ${s} label — set the printer's paper size to ${s}.`,
      sheet: () => 'For an office printer. Several labels per A4 page with crop marks; cut along the marks.',
      master: () => 'One label of each item code, to check them — or print and set copies per item yourself.',
    },
    size: (s) => `Label size ${s.replace('x', ' × ')} mm`,
    count: (lines, copies) => `${lines} item codes · ${copies.toLocaleString()} labels (all copies)`,
    pages: (n) => `${n.toLocaleString()} pages`,
    print: 'Print', dl: 'Download PDF',
    tooBig: 'Too many pages to print straight from the browser — download the PDF and print it from a PDF app (Acrobat / Preview).',
    note: 'Always print at 100% / Actual size — never "Fit to page".',
    fail: 'Could not build the PDF',
  },
  zh: {
    choose: '选择打印方式',
    name: { single: '每页一张', sheet: 'A4 排版', master: '每个货号一张' },
    desc: {
      single: (s) => `适用于卷筒标签打印机。每页一张 ${s} 标签——请把打印机纸张尺寸设为 ${s}。`,
      sheet: () => '适用于普通打印机。每张 A4 多个标签，含裁切线，沿线裁切。',
      master: () => '每个货号打印一张，用于核对——或自行在打印机设置每个货号的份数。',
    },
    size: (s) => `标签尺寸 ${s.replace('x', ' × ')} 毫米`,
    count: (lines, copies) => `${lines} 个货号 · 共 ${copies.toLocaleString()} 张（全部数量）`,
    pages: (n) => `${n.toLocaleString()} 页`,
    print: '打印', dl: '下载 PDF',
    tooBig: '页数过多，无法直接在浏览器打印——请下载 PDF，用 PDF 软件（Acrobat / 预览）打印。',
    note: '请按 100% / 实际尺寸打印，不要选择"适合页面"。',
    fail: '无法生成 PDF',
  },
  th: {
    choose: 'เลือกแบบที่จะพิมพ์',
    name: { single: 'หน้าละ 1 ดวง', sheet: 'กระดาษ A4', master: 'รหัสละ 1 ดวง' },
    desc: {
      single: (s) => `สำหรับเครื่องพิมพ์ฉลากแบบม้วน หน้าละ 1 ดวง ขนาด ${s} — ตั้งขนาดกระดาษในเครื่องพิมพ์ให้เป็น ${s}`,
      sheet: () => 'สำหรับเครื่องพิมพ์ทั่วไป A4 หน้าละหลายดวง มีเส้นตัดที่มุม ตัดตามเส้น',
      master: () => 'พิมพ์รหัสละ 1 ดวงไว้ตรวจ หรือพิมพ์แล้วตั้งจำนวนต่อรหัสเองในเครื่องพิมพ์',
    },
    size: (s) => `สติ๊กเกอร์ ${s.replace('x', ' × ')} มม.`,
    count: (lines, copies) => `${lines} รหัส · ${copies.toLocaleString()} ดวง (ครบจำนวน)`,
    pages: (n) => `${n.toLocaleString()} หน้า`,
    print: 'พิมพ์', dl: 'ดาวน์โหลด PDF',
    tooBig: 'หน้าเยอะเกินจะพิมพ์จากเบราว์เซอร์ — ดาวน์โหลด PDF แล้วพิมพ์จากโปรแกรมอ่าน PDF',
    note: 'พิมพ์ที่ 100% / Actual size เสมอ ห้าม Fit to page',
    fail: 'สร้างไฟล์ไม่สำเร็จ',
  },
}

/** small picture of what each layout prints, built from the real label image of the round */
function LayoutPreview({ mode, img, imgs, w, h }: { mode: LabelPdfMode; img: string; imgs: string[]; w: number; h: number }) {
  if (mode === 'single') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="border border-dashed border-[var(--border-1)] bg-white p-0.5" style={{ width: '70%', maxWidth: 96, aspectRatio: `${w} / ${h}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG label */}
          <img src={img} alt="" className="h-full w-full" />
        </div>
      </div>
    )
  }
  if (mode === 'sheet') {
    const cols = Math.max(1, Math.floor((210 - 16 + 4) / (w + 4)))
    return (
      <div className="flex h-full items-center justify-center">
        <div className="border border-[var(--border-1)] bg-white p-[4%]" style={{ height: '100%', maxHeight: 122, aspectRatio: '210 / 297' }}>
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: Math.min(perSheet(w, h), 30) }, (_, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- same cached SVG tiled
              <img key={i} src={img} alt="" className="w-full" style={{ aspectRatio: `${w} / ${h}` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="relative flex h-full items-center justify-center">
      {imgs.slice(0, 3).map((src, i) => (
        <div key={i} className="absolute border border-[var(--border-1)] bg-white p-0.5"
          style={{ width: '55%', maxWidth: 74, aspectRatio: `${w} / ${h}`, transform: `translate(${(i - 1) * 22}%, ${(i - 1) * 14}%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG label */}
          <img src={src} alt="" className="h-full w-full" />
        </div>
      ))}
    </div>
  )
}

export function LabelDownloads({ lines, pdfUrl, previewUrl, lang = 'en', fileName = 'labels' }: {
  lines: LabelLineCount[]
  /** builds /api/labels/pdf?…  — `dl` = attachment instead of inline */
  pdfUrl: (size: string, mode: LabelPdfMode, dl: boolean) => string
  /** SVG of one label (by code) for the layout pictures */
  previewUrl: (code: string) => string
  lang?: UiLang
  fileName?: string
}) {
  const t = TEXT[lang]
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState<Record<string, LabelPdfMode>>({})

  const sizes = useMemo(() => [...new Set(lines.map((l) => l.size))].map((size) => {
    const ls = lines.filter((l) => l.size === size)
    const copies = ls.reduce((n, l) => n + l.copies, 0)
    const { w, h } = parseSize(size)
    const pages: Record<LabelPdfMode, number> = { sheet: Math.ceil(copies / perSheet(w, h)), single: copies, master: ls.length }
    return { size, w, h, codes: ls.map((l) => l.code), lines: ls.length, copies, pages }
  }), [lines])

  const print = (size: string, mode: LabelPdfMode) => {
    setBusy(true)
    printWithPreOpen(() => fetchPdf(pdfUrl(size, mode, false)), `${fileName} ${size}`)
      .catch((e) => showToast(`${t.fail}: ${(e as Error).message}`, 'error'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {sizes.map((s) => {
        const mode = pick[s.size] ?? 'master'
        const tooBig = s.pages[mode] > MAX_PRINT_PAGES
        return (
          <section key={s.size} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{t.size(s.size)}</h2>
              <div className="text-sm text-[var(--fg-3)]">{t.count(s.lines, s.copies)}</div>
            </div>
            <div className="text-sm font-medium">{t.choose}</div>
            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              {MODES.map((m) => (
                // phones: one compact row per layout (thumb left, text right, description only when picked)
                <button key={m} type="button" onClick={() => setPick((p) => ({ ...p, [s.size]: m }))} aria-pressed={mode === m}
                  className={`flex items-center gap-3 rounded-lg border-2 p-2 text-left sm:flex-col sm:items-stretch sm:gap-2 sm:p-3 ${mode === m ? 'border-[var(--accent)]' : 'border-[var(--border-1)]'} bg-[var(--bg-surface)]`}>
                  <div className="h-20 w-20 shrink-0 rounded bg-[var(--bg-sunken)] p-1 sm:h-[140px] sm:w-full sm:p-2">
                    <LayoutPreview mode={m} img={previewUrl(s.codes[0])} imgs={s.codes.slice(0, 3).map(previewUrl)} w={s.w} h={s.h} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
                    <div className="flex items-baseline justify-between gap-2 sm:block">
                      <span className="font-medium">{t.name[m]}</span>
                      <span className="shrink-0 text-xs font-medium sm:hidden">{t.pages(s.pages[m])}</span>
                    </div>
                    <div className={`text-xs text-[var(--fg-3)] ${mode === m ? '' : 'hidden sm:block'}`}>{t.desc[m](`${s.w}×${s.h} mm`)}</div>
                    <div className="hidden text-xs font-medium sm:block">{t.pages(s.pages[m])}</div>
                  </div>
                </button>
              ))}
            </div>
            {/* phones: buttons full width, sticky at the bottom so they stay reachable under the cards */}
            <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-1)] bg-[var(--bg-app)] px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
              <Button variant="primary" icon={Download}
                onClick={() => { const f = `${fileName}-${s.size}mm-${mode}.pdf`; bgDownload(pdfUrl(s.size, mode, true), f, f, lang === 'th' ? undefined : DL_TEXT[lang]) }}>{t.dl}</Button>
              {!tooBig && <Button variant="secondary" icon={Printer} loading={busy} onClick={() => print(s.size, mode)}>{t.print}</Button>}
              <span className="w-full text-xs text-[var(--fg-3)] sm:w-auto">{tooBig ? t.tooBig : t.note}</span>
            </div>
          </section>
        )
      })}
    </div>
  )
}

'use client'

// ปุ่มพิมพ์/ดาวน์โหลดฉลาก สคบ. ของหน้าโรงงาน /labels/<token>
// (หน้าแอดมินใช้ "ติ๊กแถว → พิมพ์ที่เลือก" + "ดาวน์โหลดทั้งตู้" แทน — เจ้าของ 30 ต.ค. 69 งงหน้าต่างหลายตัวเลือก)
// แยกไฟล์ตามขนาดสติ๊กเกอร์ × 3 แบบ (A4 เรียงดวง · ดวงละหน้า · รหัสละ 1 หน้า) — PDF ขนาดจริงจาก /api/labels/pdf
// "พิมพ์" = วิธีเดียวกับบิล AOO (lib/utils/printPdf.ts): คอมเปิดหน้าต่างพิมพ์ทันที · มือถือเปิดแท็บ PDF
// ไฟล์ใหญ่ (ครบ 15,000 ดวง = 15,000 หน้า) ทำหน้าต่างพิมพ์ของ Chrome ค้าง → เกิน MAX_PRINT_PAGES ให้ดาวน์โหลดแทน

import { useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/aoo'
import { useToast } from '@/hooks/useToast'
import { bgDownload } from '@/lib/utils/bgDownload'
import { fetchPdf, printWithPreOpen } from '@/lib/utils/printPdf'
import { parseSize, perSheet } from '@/lib/labels/types'

export type LabelPdfMode = 'sheet' | 'single' | 'master'
export interface LabelLineCount { code: string; size: string; copies: number }
/** Chrome's print preview renders every page first — beyond this it sits on "Loading preview" */
const MAX_PRINT_PAGES = 300

const TEXT = {
  th: {
    modes: {
      sheet: 'กระดาษ A4 เรียงหลายดวง (มีเส้นตัด)',
      single: 'หน้าละ 1 ดวง (เครื่องพิมพ์สติ๊กเกอร์ม้วน)',
      master: 'รหัสละ 1 ดวง (ไว้ตรวจ)',
    },
    size: (s: string) => `สติ๊กเกอร์ ${s.replace('x', ' × ')} มม.`,
    count: (lines: number, copies: number) => `${lines} รหัส · ${copies.toLocaleString()} ดวง`,
    pages: (n: number) => `${n.toLocaleString()} หน้า`,
    open: 'พิมพ์',
    dl: 'ดาวน์โหลด',
    tooBig: `เกิน ${MAX_PRINT_PAGES} หน้า — กดพิมพ์จะค้าง ใช้ดาวน์โหลด หรือเลือกรหัส/จำนวนให้น้อยลง`,
    note: 'ตอนสั่งพิมพ์เลือกขนาด 100% / Actual size (ห้าม Fit to page) ฉลากจะออกมาขนาดจริง',
    fail: 'สร้างไฟล์ไม่สำเร็จ',
  },
  en: {
    modes: {
      sheet: 'A4 sheets, all copies (crop marks) · A4 排版，全部数量（含裁切线）',
      single: 'One label per page, all copies (roll printer) · 每页一张，全部数量',
      master: 'One page per item code — set copies yourself · 每个货号一页',
    },
    size: (s: string) => `Label size · 标签尺寸 ${s.replace('x', ' × ')} mm`,
    count: (lines: number, copies: number) => `${lines} item codes · 货号 — ${copies.toLocaleString()} labels · 张`,
    pages: (n: number) => `${n.toLocaleString()} pages · 页`,
    open: 'Print · 打印',
    dl: 'PDF',
    tooBig: `Over ${MAX_PRINT_PAGES} pages — download the PDF and print from a PDF app · 页数过多，请下载后打印`,
    note: 'Print at 100% / Actual size (not "Fit to page"). · 请按 100% 实际尺寸打印（不要"适合页面"）。',
    fail: 'Could not build the PDF',
  },
}

export function LabelDownloads({ lines, pdfUrl, lang = 'th', fileName = 'labels' }: {
  lines: LabelLineCount[]
  /** builds /api/labels/pdf?…  — `dl` = attachment instead of inline */
  pdfUrl: (size: string, mode: LabelPdfMode, dl: boolean) => string
  lang?: 'th' | 'en'
  fileName?: string
}) {
  const t = TEXT[lang]
  const { showToast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const sizes = useMemo(() => {
    return [...new Set(lines.map((l) => l.size))].map((size) => {
      const ls = lines.filter((l) => l.size === size)
      const copies = ls.reduce((n, l) => n + l.copies, 0)
      const { w, h } = parseSize(size)
      return { size, lines: ls.length, copies, pages: { sheet: Math.ceil(copies / perSheet(w, h)), single: copies, master: ls.length } }
    })
  }, [lines])

  const run = (key: string, job: () => Promise<void>) => {
    setBusy(key)
    job()
      .catch((e) => showToast(`${t.fail}: ${(e as Error).message}`, 'error'))
      .finally(() => setBusy((b) => (b === key ? null : b)))
  }
  const print = (size: string, mode: LabelPdfMode) =>
    run(`p|${size}|${mode}`, () => printWithPreOpen(() => fetchPdf(pdfUrl(size, mode, false)), `${fileName} ${size}`))
  // built in the background with a toast (a plain link looked frozen for ~10 s)
  const download = (size: string, mode: LabelPdfMode) =>
    run(`d|${size}|${mode}`, async () => { await bgDownload(pdfUrl(size, mode, true), `${fileName}-${size}mm-${mode}.pdf`) })

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--fg-3)]">{t.note}</p>
      {sizes.map((s) => (
        <section key={s.size} className="space-y-2 border-t border-[var(--border-1)] pt-3">
          <div>
            <div className="font-medium">{t.size(s.size)}</div>
            <div className="text-xs text-[var(--fg-3)]">{t.count(s.lines, s.copies)}</div>
          </div>
          {(Object.keys(t.modes) as LabelPdfMode[]).map((mode) => {
            const tooBig = s.pages[mode] > MAX_PRINT_PAGES
            return (
              <div key={mode} className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <div>{t.modes[mode]} <span className="text-[var(--fg-3)]">· {t.pages(s.pages[mode])}</span></div>
                  {tooBig && <div className="text-xs text-[var(--fg-3)]">{t.tooBig}</div>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" icon={Printer} disabled={tooBig} loading={busy === `p|${s.size}|${mode}`}
                    onClick={() => print(s.size, mode)}>{t.open}</Button>
                  <Button variant="secondary" size="sm" icon={Download} loading={busy === `d|${s.size}|${mode}`}
                    onClick={() => download(s.size, mode)}>{t.dl}</Button>
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}

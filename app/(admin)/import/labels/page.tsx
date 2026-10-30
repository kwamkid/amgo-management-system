'use client'

// ฉลาก สคบ. — ตรวจ/กรอกข้อมูลฉลากของรอบสั่งของ แล้วสร้างลิงก์ให้โรงงานพิมพ์ (เจ้าของ 30 ต.ค. 69)
// ข้อมูลเก็บที่ label_specs ไล่ชั้น ค่ากลาง → แบรนด์ → หมวด → สินค้า (กรอกครั้งเดียว ใช้ทุกรอบ)
// รอบที่เปิดอยู่อยู่ใน ?r=<slug> · ตัววาด/ไฟล์ PDF อยู่ฝั่ง server (lib/labels)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ClipboardCopy, Copy, Download, Eye, Link2, Printer, Save, Settings2, Sticker, Tags } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Alert, Button, Checkbox, Field, Input, Modal, Pill, SelectMenu, Textarea, Toggle, type SelectOption } from '@/components/aoo'
import { DataTable, PageHeader, Segmented, StatCard, StatGrid, TechLoader } from '@/components/shared'
import type { Column } from '@/components/shared'
import { bgDownload } from '@/lib/utils/bgDownload'
import { fetchPdf, printWithPreOpen } from '@/lib/utils/printPdf'
import { LABEL_SIZES, parseSize, perSheet, MIN_QR_MODULE_MM, MIN_READABLE_PT, TIS_TYPES } from '@/lib/labels/types'

// ── types (mirror of /api/labels) ──────────────────────────────────────────
type Field =
  | 'header' | 'type_th' | 'warning' | 'age' | 'usage' | 'manufacturer' | 'country' | 'importer' | 'address'
  | 'contact' | 'tis_text' | 'tis_license' | 'show_license' | 'qr_url' | 'size' | 'tis_type' | 'price' | 'icon_03' | 'skip'
type Val = string | number | boolean | null
type Scope = 'brand' | 'group' | 'product'
type Spec = { brand: string; scope: Scope; key: string } & Partial<Record<Field, Val>>
interface Line {
  code: string; name: string; grp: string; part: string; img: string | null; qty: number; copies: number; skip: boolean
  values: Partial<Record<Field, Val>>; from: Partial<Record<Field, string>>; missing: Field[]; size: string
  fit: { bodyPt: number; overflow: boolean; qrModule: number }
}
interface Data {
  round: { id: string; slug: string; name: string; brand: string; arrive: string | null; status: string }
  settings: { import_month: string; import_month_set: boolean; extra_pct: number; default_size: string; share_token: string | null; shared_at: string | null }
  parts: { key: string; name: string }[]
  lines: Line[]
  specs: Spec[]
  canEdit: boolean
}

const LABEL: Record<Field, string> = {
  header: 'หัวฉลาก (บรรทัดใหญ่บนสุด)', type_th: 'ชื่อ/ประเภทสินค้า (ไทย)', warning: 'คำเตือน', age: 'อายุผู้เล่น',
  usage: 'วิธีการใช้', manufacturer: 'ผู้ผลิต', country: 'ประเทศผู้ผลิต', importer: 'ผู้นำเข้า', address: 'ที่อยู่ผู้นำเข้า',
  contact: 'ช่องทางติดต่อ', tis_text: 'ข้อความใต้โลโก้ มอก.', tis_license: 'เลขใบอนุญาต มอก.', show_license: 'พิมพ์เลขใบอนุญาตบนฉลาก',
  qr_url: 'ลิงก์ใน QR', size: 'ขนาดสติ๊กเกอร์', tis_type: 'ประเภทตามใบอนุญาต มอก.', price: 'ราคา (บาท)',
  icon_03: 'ไอคอนห้ามเด็ก 0-3 ปี', skip: 'ไม่ต้องทำฉลาก (เช่น ชั้นวางโชว์)',
}
const LAYER: Record<string, string> = {
  all: 'ค่ากลาง', brand: 'แบรนด์', part: 'แบรนด์ย่อย', group: 'หมวด', product: 'สินค้า', srp: 'SRP Calculator',
  agreed: 'ราคาที่ตกลงไว้ในรอบสั่ง', aoo: 'ราคาหน้าร้าน aoo', round: 'ค่าเริ่มต้นของรอบ',
}
const SIZE_NAME: Record<string, string> = { '50x50': '5 × 5 ซม.', '40x40': '4 × 4 ซม.', '30x30': '3 × 3 ซม.', '50x30': '5 × 3 ซม. (แนวนอน)' }
const sizeName = (s: string) => SIZE_NAME[s] ?? `${s.replace('x', ' × ')} มม.`
/** options for the shared SelectMenu (owner 30 Oct: no native dropdowns) — keeps a custom saved size listed */
const sizeOptions = (cur?: string): SelectOption[] => [
  ...LABEL_SIZES.map((x) => ({ value: x, label: sizeName(x) })),
  ...(cur && !(LABEL_SIZES as readonly string[]).includes(cur) ? [{ value: cur, label: sizeName(cur) }] : []),
]
const LONG: Field[] = ['warning', 'age', 'usage', 'address']

/** fields editable per level */
const PRODUCT_FIELDS: Field[] = ['header', 'type_th', 'warning', 'age', 'usage', 'icon_03', 'tis_type', 'size', 'price', 'skip']
const BRAND_FIELDS: Field[] = ['header', 'manufacturer', 'country', 'warning', 'age', 'usage', 'size']
const ALL_FIELDS: Field[] = ['importer', 'address', 'contact', 'tis_text', 'tis_license', 'show_license', 'qr_url', 'size']

const imgUrl = (img: string | null) =>
  !img ? null : /^https?:/.test(img) ? img : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/import-images/${img}`

/** what's wrong with a line, worst first */
function problems(l: Line): { tone: 'danger' | 'warning'; text: string }[] {
  const p: { tone: 'danger' | 'warning'; text: string }[] = []
  if (l.skip) return p
  if (l.missing.length) p.push({ tone: 'danger', text: `ขาด ${l.missing.map((f) => LABEL[f].split(' (')[0]).join(', ')}` })
  if (l.fit.overflow) p.push({ tone: 'danger', text: 'ข้อความล้นดวง' })
  else if (l.fit.bodyPt < MIN_READABLE_PT) p.push({ tone: 'warning', text: `ตัวอักษรเล็ก ${l.fit.bodyPt} pt` })
  if (l.fit.qrModule < MIN_QR_MODULE_MM) p.push({ tone: 'warning', text: 'QR เล็ก อาจสแกนไม่ติด' })
  return p
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body as T
}

// ── page ───────────────────────────────────────────────────────────────────
export default function LabelsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  // import_access หรือ role admin/manager (เจ้าของ 30 ต.ค. 69 — ผู้จัดการทุกคนดู/แก้/เพิ่มได้ · server เช็คซ้ำใน labelGuard)
  const canSee = !!userData?.importAccess || ['admin', 'manager'].includes(userData?.role ?? '')
  const [slug, setSlug] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])
  useEffect(() => {
    setSlug(new URLSearchParams(window.location.search).get('r'))
  }, [])

  const open = (s: string | null) => {
    window.history.pushState(null, '', s ? `/import/labels?r=${encodeURIComponent(s)}` : '/import/labels')
    setSlug(s)
  }

  if (!canSee || slug === undefined) return <TechLoader />
  return slug ? <RoundLabels slug={slug} onBack={() => open(null)} /> : <RoundPicker onPick={open} />
}

type RoundRow = {
  slug: string; name: string; brand: string; arrive: string | null; status: string; parts: string[]
  lines: number; copies: number; missing: number; shared: boolean
}

function RoundPicker({ onPick }: { onPick: (slug: string) => void }) {
  const [rounds, setRounds] = useState<RoundRow[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    api<RoundRow[]>('/api/labels/rounds').then(setRounds).catch((e) => setErr(e.message))
  }, [])
  if (err) return <Alert tone="error" title="โหลดไม่สำเร็จ">{err}</Alert>
  const columns: Column<RoundRow>[] = [
    { key: 'name', header: 'ตู้', mobilePrimary: true, sortValue: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'parts', header: 'แบรนด์', cell: (r) => r.parts.join(' + ') },
    { key: 'arrive', header: 'ตู้ถึง', sortValue: (r) => r.arrive, cell: (r) => <span className="whitespace-nowrap">{r.arrive ? new Date(r.arrive).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</span> },
    { key: 'status', header: 'ออเดอร์', cell: (r) => <Pill tone={r.status === 'sent' ? 'success' : 'neutral'}>{r.status === 'sent' ? 'ส่งแล้ว' : r.status === 'approved' ? 'อนุมัติแล้ว' : 'ร่าง'}</Pill> },
    { key: 'lines', header: 'รหัส', align: 'right', sortValue: (r) => r.lines, cell: (r) => r.lines.toLocaleString() },
    { key: 'copies', header: 'ดวง', align: 'right', sortValue: (r) => r.copies, cell: (r) => r.copies.toLocaleString() },
    {
      key: 'ready', header: 'ฉลาก', sortValue: (r) => r.missing,
      cell: (r) => r.missing ? <Pill tone="danger">ข้อมูลไม่ครบ {r.missing} รหัส</Pill> : <Pill tone="success">ครบ</Pill>,
    },
    { key: 'shared', header: 'โรงงาน', cell: (r) => r.shared ? <Pill tone="info">ส่งลิงก์แล้ว</Pill> : <span className="text-[var(--fg-3)]">—</span> },
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="ฉลาก สคบ." icon={Sticker} description="เลือกตู้ที่จะทำฉลากให้โรงงานพิมพ์" />
      <DataTable columns={columns} rows={rounds ?? []} loading={!rounds} rowKey={(r) => r.slug} onRowClick={(r) => onPick(r.slug)}
        emptyTitle="ยังไม่มีรอบสั่งของ" />
    </div>
  )
}

type Filter = 'all' | 'bad' | 'ok'

function RoundLabels({ slug, onBack }: { slug: string; onBack: () => void }) {
  const { showToast } = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editLine, setEditLine] = useState<Line | null>(null)
  const [brandOpen, setBrandOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [rev, setRev] = useState(0) // bumps preview image urls after a save

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/labels?r=${encodeURIComponent(slug)}`))
      setRev((v) => v + 1)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [slug])
  useEffect(() => { load() }, [load])

  const saveSpecs = async (rows: Spec[]) => {
    await api('/api/labels/specs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
    showToast('บันทึกแล้ว')
    await load()
  }
  const saveRound = async (body: Record<string, unknown>) => {
    try {
      await api(`/api/labels?r=${encodeURIComponent(slug)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      await load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const rows = useMemo(() => {
    if (!data) return []
    return data.lines.filter((l) => filter === 'all' || (filter === 'bad') === problems(l).length > 0)
  }, [data, filter])

  if (err) return <Alert tone="error" title="โหลดไม่สำเร็จ">{err}</Alert>
  if (!data) return <TechLoader />

  const bad = data.lines.filter((l) => problems(l).length).length
  const missing = data.lines.filter((l) => l.missing.length).length
  const copies = data.lines.reduce((s, l) => s + (l.skip ? 0 : l.copies), 0)
  const spec = (brand: string, scope: Scope, key: string) => data.specs.find((s) => s.brand === brand && s.scope === scope && s.key === key)
  const ro = !data.canEdit
  const sizes = [...new Set(data.lines.filter((l) => !l.skip).map((l) => l.size))]
  // whole container = A4 sheets, one file per sticker size, built in the background (owner 30 Oct)
  const downloadAll = () => {
    for (const size of sizes) {
      bgDownload(`/api/labels/pdf?r=${encodeURIComponent(slug)}&size=${size}&mode=sheet&dl=1`, `${slug}-${size}mm-A4.pdf`, `ทั้งตู้ ${sizeName(size)}`)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="ฉลาก สคบ."
        icon={Sticker}
        description={data.round.name}
        onBack={onBack}
        actions={
          <>
            <Button variant="secondary" icon={Settings2} onClick={() => setBrandOpen(true)}>ข้อมูลแบรนด์ / ค่ากลาง</Button>
            <Button variant="secondary" icon={Download} onClick={downloadAll}>ดาวน์โหลดทั้งตู้</Button>
            <Button variant="primary" icon={Link2} onClick={() => setShareOpen(true)}>ส่งให้โรงงาน</Button>
          </>
        }
      />

      <StatGrid cols={4} compact>
        <StatCard label="รายการที่สั่ง" value={data.lines.length} unit="รหัส" icon={Tags} tone="neutral" onClick={() => setFilter('all')} selected={filter === 'all'} />
        <StatCard label="ดวงที่ต้องพิมพ์" value={copies.toLocaleString()} unit="ดวง" hint={`เผื่อเสีย ${data.settings.extra_pct}%`} icon={Sticker} tone="info" />
        <StatCard label="ต้องแก้" value={bad} unit="รหัส" hint={missing ? `${missing} รหัสข้อมูลไม่ครบ` : undefined} icon={AlertTriangle} tone={bad ? 'danger' : 'muted'} onClick={() => setFilter('bad')} selected={filter === 'bad'} />
        <StatCard label="พร้อมพิมพ์" value={data.lines.length - bad} unit="รหัส" icon={CheckCircle2} tone="success" onClick={() => setFilter('ok')} selected={filter === 'ok'} />
      </StatGrid>

      <RoundSettings data={data} ro={ro} onSave={saveRound} />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={filter} onChange={(v) => setFilter(v as Filter)} options={[
          { value: 'all', label: `ทั้งหมด ${data.lines.length}` }, { value: 'bad', label: `ต้องแก้ ${bad}` }, { value: 'ok', label: `พร้อม ${data.lines.length - bad}` },
        ]} />
      </div>

      <LabelGrid slug={slug} lines={rows} specs={data.specs} ro={ro} onOpen={setEditLine} onSave={saveSpecs} />

      {editLine && (
        <LineModal
          line={data.lines.find((l) => l.code === editLine.code) ?? editLine}
          own={spec(editLine.part, 'product', editLine.code)}
          slug={slug} rev={rev} ro={ro}
          onClose={() => setEditLine(null)}
          onSave={saveSpecs}
        />
      )}
      {brandOpen && <BrandModal data={data} ro={ro} onClose={() => setBrandOpen(false)} onSave={saveSpecs} />}
      {shareOpen && <ShareModal data={data} bad={bad} ro={ro} onClose={() => setShareOpen(false)} onShare={(on) => saveRound({ share: on })} />}
    </div>
  )
}

// ── spreadsheet grid (owner 30 Oct: "ทำเป็นตารางเหมือน excel แล้ว copy & paste ได้") ──────────
// Edits are per product (label_specs scope 'product'). A grey value = inherited from category/brand;
// typing over it makes a product value, clearing it goes back to the inherited one.
// Paste a block copied from Excel into any cell → fills right/down. Paste a whole sheet that starts
// with a "รหัส" header (what "คัดลอกทั้งตาราง" gives) → rows matched by code, columns by header.
const GRID: { f: Field; label: string; w: number }[] = [
  { f: 'type_th', label: 'ชื่อสินค้า (ไทย)', w: 200 },
  { f: 'warning', label: 'คำเตือน', w: 340 },
  { f: 'age', label: 'อายุผู้เล่น', w: 250 },
  { f: 'usage', label: 'วิธีการใช้', w: 210 },
  { f: 'icon_03', label: 'ไอคอน 0-3', w: 90 },
  { f: 'size', label: 'ขนาดสติ๊กเกอร์', w: 170 },
  { f: 'price', label: 'ราคา', w: 80 },
  { f: 'skip', label: 'ไม่ทำฉลาก', w: 90 },
]
const BOOL: Field[] = ['icon_03', 'skip']

const toCell = (f: Field, v: Val | undefined): string =>
  v == null ? '' : BOOL.includes(f) ? (v ? 'ใช่' : 'ไม่') : String(v)

/** what a typed/pasted cell means; undefined = can't read it */
function fromCell(f: Field, raw: string): Val | undefined {
  const t = raw.trim()
  if (!t) return null
  if (BOOL.includes(f)) {
    if (/^(1|y|yes|true|ใช่|มี|✓|x)$/i.test(t)) return true
    if (/^(0|n|no|false|ไม่|ไม่มี|-)$/i.test(t)) return false
    return undefined
  }
  if (f === 'price') {
    const n = Number(t.replace(/[,฿\s]|บาท/g, ''))
    return Number.isFinite(n) && n >= 0 ? n : undefined
  }
  if (f === 'size') {
    const m = /^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(ซม\.?|cm)?$/i.exec(t)
    if (!m) return undefined
    const cm = !!m[3] || (+m[1] <= 15 && +m[2] <= 15) // "5x5" = cm
    return `${+m[1] * (cm ? 10 : 1)}x${+m[2] * (cm ? 10 : 1)}`
  }
  return t
}

function LabelGrid({ slug, lines, specs, ro, onOpen, onSave }: {
  slug: string; lines: Line[]; specs: Spec[]; ro: boolean; onOpen: (l: Line) => void; onSave: (rows: Spec[]) => Promise<void>
}) {
  const { showToast } = useToast()
  // tick rows → "พิมพ์…" opens PrintDialog (size · layout · qty per code) — owner 30 Oct
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [printOpen, setPrintOpen] = useState(false)
  const toggle = (code: string) => setSel((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n })
  const printable = lines.filter((l) => !l.skip)
  const allOn = printable.length > 0 && printable.every((l) => sel.has(l.code))
  const [edits, setEdits] = useState<Record<string, Partial<Record<Field, string>>>>({})
  const [saving, setSaving] = useState(false)
  const dirty = Object.keys(edits).length
  const byCode = useMemo(() => new Map(lines.map((l) => [l.code, l])), [lines])

  const own = (l: Line, f: Field) => (l.from[f] === 'product' ? toCell(f, l.values[f]) : '')
  const shown = (l: Line, f: Field) => edits[l.code]?.[f] ?? own(l, f)
  const inherited = (l: Line, f: Field) => (l.from[f] && l.from[f] !== 'product' ? toCell(f, l.values[f]) : '')

  const setCell = (next: typeof edits, l: Line, f: Field, v: string) => {
    const row = { ...(next[l.code] ?? {}) }
    if (v === own(l, f)) delete row[f]
    else row[f] = v
    if (Object.keys(row).length) next[l.code] = row
    else delete next[l.code]
  }
  const set = (l: Line, f: Field, v: string) => setEdits((e) => { const n = { ...e }; setCell(n, l, f, v); return n })

  const paste = (text: string, r0: number, c0: number) => {
    const rows = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((r) => r.split('\t'))
    const next = { ...edits }
    let n = 0
    if (rows[0][0]?.trim() === 'รหัส') {
      // a whole sheet: columns by header, rows by code
      const cols = rows[0].map((h) => GRID.find((g) => g.label === h.trim())?.f)
      for (const r of rows.slice(1)) {
        const l = byCode.get(r[0]?.trim())
        if (!l) continue
        cols.forEach((f, j) => {
          if (!f || r[j] == null) return
          const v = r[j].trim()
          if (v === inherited(l, f) && !own(l, f)) return // same as what it inherits → keep inheriting
          setCell(next, l, f, v); n++
        })
      }
    } else {
      rows.forEach((r, i) => r.forEach((v, j) => {
        const l = lines[r0 + i]
        const g = GRID[c0 + j]
        if (l && g) { setCell(next, l, g.f, v.trim()); n++ }
      }))
    }
    setEdits(next)
    showToast(`วางแล้ว ${n} ช่อง — กดบันทึกเพื่อเก็บ`)
  }

  const copyAll = async () => {
    const head = ['รหัส', 'ชื่อ (EN)', ...GRID.map((g) => g.label)]
    const body = lines.map((l) => [l.code, l.name.replace(/\s+/g, ' '), ...GRID.map((g) => shown(l, g.f) || inherited(l, g.f))])
    await navigator.clipboard.writeText([head, ...body].map((r) => r.join('\t')).join('\n'))
    showToast('คัดลอกแล้ว — วางใน Excel แก้แล้วคัดลอกทั้งแผ่นกลับมาวางช่องไหนก็ได้')
  }

  const save = async () => {
    const bad: string[] = []
    const rows: Spec[] = []
    for (const [code, e] of Object.entries(edits)) {
      const l = byCode.get(code)
      if (!l) continue
      const cur = specs.find((x) => x.brand === l.part && x.scope === 'product' && x.key === code)
      const row: Spec = { ...(cur ?? {}), brand: l.part, scope: 'product', key: code }
      for (const [f, raw] of Object.entries(e) as [Field, string][]) {
        const v = fromCell(f, raw)
        if (v === undefined) bad.push(`${code} ${GRID.find((g) => g.f === f)?.label}: "${raw}"`)
        else row[f] = v
      }
      rows.push(row)
    }
    if (bad.length) { showToast(`อ่านค่าไม่ได้ ${bad.length} ช่อง เช่น ${bad[0]}`, 'error'); return }
    setSaving(true)
    try {
      await onSave(rows)
      setEdits({})
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const move = (r: number, c: number) => document.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`)?.focus()

  return (
    <div className="space-y-2">
      {printOpen && (
        <PrintDialog slug={slug} lines={lines.filter((l) => sel.has(l.code) && !l.skip)} onClose={() => setPrintOpen(false)} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {sel.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">เลือก {sel.size} รหัส</span>
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => setPrintOpen(true)}>พิมพ์…</Button>
            <Button variant="ghost" size="sm" onClick={() => setSel(new Set())}>ยกเลิกเลือก</Button>
          </div>
        ) : (
          <span className="text-xs text-[var(--fg-3)]">ติ๊กหน้ารหัสเพื่อพิมพ์เอง · ตัวเทา = ค่าของหมวด/แบรนด์ · วางจาก Excel ได้หลายช่อง</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" icon={ClipboardCopy} onClick={copyAll}>คัดลอกทั้งตาราง</Button>
          {!ro && (
            <>
              {dirty > 0 && <Button variant="ghost" size="sm" onClick={() => setEdits({})}>ยกเลิกที่แก้</Button>}
              <Button variant="primary" size="sm" icon={Save} loading={saving} disabled={!dirty} onClick={save}>
                บันทึก{dirty ? ` ${dirty} รหัส` : ''}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-[var(--border-1)] bg-[var(--bg-surface)]">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--bg-sunken)]">
            <tr>
              <th className="sticky left-0 z-20 min-w-[200px] border-b border-r border-[var(--border-1)] bg-[var(--bg-sunken)] px-2 py-2 text-left font-medium">
                <label className="flex items-center gap-2">
                  <Checkbox checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(printable.map((l) => l.code)))} aria-label="เลือกทั้งหมด" />
                  รหัส
                </label>
              </th>
              {GRID.map((g) => (
                <th key={g.f} style={{ minWidth: g.w }} className="border-b border-r border-[var(--border-1)] px-2 py-2 text-left font-medium">{g.label}</th>
              ))}
              <th className="border-b border-r border-[var(--border-1)] px-2 py-2 text-right font-medium">ดวง</th>
              <th className="min-w-[180px] border-b border-[var(--border-1)] px-2 py-2 text-left font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, r) => {
              const p = problems(l)
              return (
                <tr key={l.code} className={l.skip ? 'opacity-50' : undefined}>
                  <td className="sticky left-0 z-[5] border-b border-r border-[var(--border-1)] bg-[var(--bg-surface)] px-2 py-1">
                    <div className="flex items-center gap-2">
                    <Checkbox checked={sel.has(l.code)} disabled={l.skip} onChange={() => toggle(l.code)} aria-label={`เลือก ${l.code}`} />
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onOpen(l)} title="ดูตัวอย่างฉลาก">
                      <Eye size={14} className="shrink-0 text-[var(--fg-3)]" />
                      <span className="min-w-0">
                        <span className="block font-medium">{l.code}</span>
                        <span className="block max-w-[140px] truncate text-xs text-[var(--fg-3)]">{l.name}</span>
                      </span>
                    </button>
                    </div>
                  </td>
                  {GRID.map((g, c) => {
                    const v = shown(l, g.f)
                    const edited = edits[l.code]?.[g.f] !== undefined
                    if (BOOL.includes(g.f)) {
                      // yes/no columns = tick box (owner 30 Oct) · unticking an inherited "yes" stores "ไม่" on the product
                      const inh = inherited(l, g.f)
                      const on = (v || inh) === 'ใช่'
                      return (
                        <td key={g.f} className={`border-b border-r border-[var(--border-1)] px-2 py-1 ${edited ? 'bg-[var(--bg-sunken)]' : ''}`}>
                          <Checkbox checked={on} disabled={ro || (g.f === 'icon_03' && l.skip)} aria-label={`${g.label} ${l.code}`}
                            onChange={(x) => set(l, g.f, x ? (inh === 'ใช่' ? '' : 'ใช่') : inh === 'ใช่' ? 'ไม่' : '')} />
                        </td>
                      )
                    }
                    if (g.f === 'size') {
                      // size = dropdown (owner 30 Oct: "ตรงไหนให้เลือกขนาด label")
                      const inh = inherited(l, g.f)
                      return (
                        <td key={g.f} className={`border-b border-r border-[var(--border-1)] p-0 ${edited ? 'bg-[var(--bg-sunken)]' : ''}`}>
                          <SelectMenu size="sm" variant="flat" value={v || null} disabled={ro}
                            options={sizeOptions(v)} placeholder={inh ? `${sizeName(inh)} (ค่าตู้)` : 'ตามตู้'}
                            clearable={inh ? `ตามตู้ (${sizeName(inh)})` : 'ตามตู้'} onChange={(x) => set(l, g.f, x ?? '')} />
                        </td>
                      )
                    }
                    return (
                      <td key={g.f} className={`border-b border-r border-[var(--border-1)] p-0 ${edited ? 'bg-[var(--bg-sunken)]' : ''}`}>
                        <input
                          data-cell={`${r}-${c}`}
                          value={v}
                          placeholder={inherited(l, g.f)}
                          readOnly={ro}
                          title={v || inherited(l, g.f)}
                          onChange={(e) => set(l, g.f, e.target.value)}
                          onPaste={(e) => {
                            const t = e.clipboardData.getData('text/plain')
                            if (ro || !/[\t\n]/.test(t.replace(/\n+$/, ''))) return
                            e.preventDefault()
                            paste(t, r, c)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.shiftKey)) { e.preventDefault(); move(r + 1, c) }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); move(r - 1, c) }
                          }}
                          className="w-full bg-transparent px-2 py-1.5 outline-none placeholder:text-[var(--fg-3)] focus:bg-[var(--bg-sunken)]"
                        />
                      </td>
                    )
                  })}
                  <td className="border-b border-r border-[var(--border-1)] px-2 py-1 text-right">{l.skip ? '—' : l.copies.toLocaleString()}</td>
                  <td className="border-b border-[var(--border-1)] px-2 py-1">
                    {l.skip ? <span className="text-xs text-[var(--fg-3)]">ไม่ทำฉลาก</span>
                      : p.length ? <div className="flex flex-wrap gap-1">{p.map((x) => <Pill key={x.text} tone={x.tone}>{x.text}</Pill>)}</div>
                      : <Pill tone="success">พร้อม</Pill>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── print dialog (owner 30 Oct: label printer, one label per page; choose size + layout + qty per code) ──
type PrintMode = 'single' | 'sheet'
const PRINT_PREF_KEY = 'labels.printPref'
/** Chrome's print preview renders every page first — beyond this it hangs on "Loading preview" */
const MAX_PRINT_PAGES = 300

function PrintDialog({ slug, lines, onClose }: { slug: string; lines: Line[]; onClose: () => void }) {
  const { showToast } = useToast()
  // last choice is remembered per browser (convenience only)
  const pref = (() => {
    try { return JSON.parse(localStorage.getItem(PRINT_PREF_KEY) ?? '{}') as { mode?: PrintMode; size?: string } } catch { return {} }
  })()
  const [mode, setMode] = useState<PrintMode>(pref.mode ?? 'single')
  const [size, setSize] = useState<string>(pref.size ?? '') // '' = each label's saved size
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.code, '1'])))
  const [all, setAll] = useState('')
  const [busy, setBusy] = useState(false)

  const n = (code: string) => Math.max(1, Math.floor(Number(qty[code]) || 1))
  const total = lines.reduce((s, l) => s + n(l.code), 0)
  // jobs per sticker size: one size if chosen here, else grouped by each label's saved size
  const groups = size ? [{ size, lines }] : [...new Set(lines.map((l) => l.size))].map((s) => ({ size: s, lines: lines.filter((l) => l.size === s) }))
  const pages = groups.reduce((p, g) => {
    const c = g.lines.reduce((s, l) => s + n(l.code), 0)
    const { w, h } = parseSize(g.size)
    return p + (mode === 'single' ? c : Math.ceil(c / perSheet(w, h)))
  }, 0)

  const go = async () => {
    try { localStorage.setItem(PRINT_PREF_KEY, JSON.stringify({ mode, size })) } catch { /* private mode */ }
    if (groups.length > 1) { showToast('ที่เลือกมีหลายขนาด — เลือก “ขนาดฉลาก” ขนาดเดียว หรือเลือกรหัสทีละขนาด', 'error'); return }
    const g = groups[0]
    const q = g.lines.map((l) => `${l.code}:${n(l.code)}`).join(',')
    const url = `/api/labels/pdf?r=${encodeURIComponent(slug)}&mode=${mode}&size=${g.size}${size ? `&as=${size}` : ''}&qty=${encodeURIComponent(q)}`
    if (pages > MAX_PRINT_PAGES) {
      bgDownload(`${url}&dl=1`, `${slug}-${g.size}mm-${mode}.pdf`)
      onClose()
      return
    }
    setBusy(true)
    try {
      await printWithPreOpen(() => fetchPdf(url), 'ฉลาก สคบ.')
      onClose()
    } catch (e) {
      showToast(`สร้างไฟล์ไม่สำเร็จ: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} maxWidth={560} title={`พิมพ์ฉลาก ${lines.length} รหัส`}
      description={`รวม ${total.toLocaleString()} ดวง · ${pages.toLocaleString()} หน้า`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        <Button variant="primary" icon={pages > MAX_PRINT_PAGES ? Download : Printer} loading={busy} onClick={go}>
          {pages > MAX_PRINT_PAGES ? 'บันทึกเป็นไฟล์ (เยอะเกินพิมพ์ตรง)' : 'พิมพ์'}
        </Button>
      </>}>
      <div className="space-y-4">
        <Segmented className="w-full" value={mode} onChange={(v) => setMode(v as PrintMode)} options={[
          { value: 'single', label: 'ดวงละหน้า (เครื่องพิมพ์ฉลาก)' },
          { value: 'sheet', label: 'A4 เรียงหลายดวง' },
        ]} />
        <Field label="ขนาดฉลาก" help={mode === 'single' ? 'ตั้งขนาดกระดาษในเครื่องพิมพ์ฉลากให้ตรงกับขนาดนี้ · พิมพ์ที่ 100% / Actual size' : 'พิมพ์ที่ 100% / Actual size (ห้าม Fit to page)'}
          warning={size && size !== '50x50' ? (size === '30x30' ? 'ขนาดนี้ตัวอักษรปกติเหลือราว 3 pt (คำเตือนราว 4 pt) — ใช้เครื่องพิมพ์ 300 dpi ขึ้นไป' : 'ขนาดนี้ตัวอักษรปกติเหลือราว 3.5–4 pt (คำเตือนราว 5 pt)') + ' — ดูตัวอย่างก่อนพิมพ์เยอะ' : undefined}>
          <SelectMenu value={size || null} options={sizeOptions()} onChange={(x) => setSize(x ?? '')}
            placeholder={`ตามที่ตั้งไว้ของแต่ละรหัส${groups.length === 1 && !size ? ` (${sizeName(groups[0].size)})` : ''}`}
            clearable="ตามที่ตั้งไว้ของแต่ละรหัส" />
        </Field>
        <div className="border-t border-[var(--border-1)] pt-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium">จำนวนต่อรหัส</span>
            <div className="ml-auto flex items-center gap-1">
              <Input type="number" min={1} value={all} placeholder="เท่ากัน" onChange={(e) => setAll(e.target.value)} style={{ width: 90 }} aria-label="จำนวนเท่ากันทุกรหัส" />
              <Button variant="ghost" size="sm" disabled={!all} onClick={() => setQty(Object.fromEntries(lines.map((l) => [l.code, all])))}>ใส่ทุกตัว</Button>
            </div>
          </div>
          <div className="max-h-[40vh] space-y-1 overflow-auto">
            {lines.map((l) => (
              <div key={l.code} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{l.code}</span>
                  <span className="ml-2 truncate text-xs text-[var(--fg-3)]">{l.name}</span>
                </div>
                <span className="text-xs text-[var(--fg-3)]">สั่ง {l.qty.toLocaleString()}</span>
                <Input type="number" min={1} value={qty[l.code] ?? '1'} onChange={(e) => setQty((q) => ({ ...q, [l.code]: e.target.value }))}
                  style={{ width: 90 }} aria-label={`จำนวน ${l.code}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── round settings (inline) ────────────────────────────────────────────────
function RoundSettings({ data, ro, onSave }: { data: Data; ro: boolean; onSave: (b: Record<string, unknown>) => Promise<void> }) {
  const [month, setMonth] = useState(data.settings.import_month)
  const [extra, setExtra] = useState(String(data.settings.extra_pct))
  useEffect(() => { setMonth(data.settings.import_month); setExtra(String(data.settings.extra_pct)) }, [data.settings])
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="เดือน ปี นำเข้า (บนฉลาก)" help={data.settings.import_month_set ? 'ตั้งเอง' : 'ตามวันที่ตู้ถึง — แก้ได้'}>
        <Input value={month} disabled={ro} placeholder="12/2026"
          onChange={(e) => setMonth(e.target.value)}
          onBlur={() => month !== data.settings.import_month && onSave({ import_month: month })} />
      </Field>
      <Field label="ขนาดสติ๊กเกอร์ของทั้งตู้" help="ตัวไหนกล่องเล็ก เลือกขนาดแยกได้ที่คอลัมน์ “ขนาดสติ๊กเกอร์” ในตาราง">
        <SelectMenu value={data.settings.default_size} disabled={ro} options={sizeOptions()}
          onChange={(x) => x && onSave({ default_size: x })} />
      </Field>
      <Field label="เผื่อเสีย (%)" help="จำนวนดวง = จำนวนที่สั่ง + เผื่อ (ปัดขึ้น)">
        <Input type="number" min={0} max={50} value={extra} disabled={ro}
          onChange={(e) => setExtra(e.target.value)}
          onBlur={() => Number(extra) !== data.settings.extra_pct && onSave({ extra_pct: Number(extra) })} />
      </Field>
    </div>
  )
}

// ── field inputs ───────────────────────────────────────────────────────────
function SpecInput({ f, value, placeholder, disabled, onChange }: {
  f: Field; value: Val | undefined; placeholder?: string; disabled?: boolean; onChange: (v: Val) => void
}) {
  const v = value == null ? '' : String(value)
  if (f === 'show_license') {
    return <Toggle checked={value === true} disabled={disabled} onChange={(x) => onChange(x)} aria-label={LABEL[f]} />
  }
  if (f === 'icon_03' || f === 'skip') {
    return (
      <SelectMenu value={value == null ? null : value ? '1' : '0'} disabled={disabled}
        options={[{ value: '1', label: 'ใช่' }, { value: '0', label: 'ไม่' }]}
        placeholder={placeholder ? `ตามชั้นบน (${placeholder === 'true' ? 'ใช่' : 'ไม่'})` : 'ตามชั้นบน'} clearable="ตามชั้นบน"
        onChange={(x) => onChange(x == null ? null : x === '1')} />
    )
  }
  if (f === 'size') {
    return (
      <SelectMenu value={v || null} disabled={disabled} options={sizeOptions(v)}
        placeholder={placeholder ? `ตามชั้นบน (${sizeName(placeholder)})` : 'ตามชั้นบน'} clearable="ตามชั้นบน"
        onChange={(x) => onChange(x)} />
    )
  }
  if (f === 'tis_type') {
    return (
      <SelectMenu value={v || null} disabled={disabled}
        options={Object.entries(TIS_TYPES).map(([k, t]) => ({ value: k, label: `${k}. ${t}` }))}
        placeholder={placeholder ? `ตามชั้นบน (ประเภท ${placeholder})` : '— ยังไม่เลือก —'} clearable={placeholder ? 'ตามชั้นบน' : 'ไม่ระบุ'}
        onChange={(x) => onChange(x ? Number(x) : null)} />
    )
  }
  if (LONG.includes(f)) {
    return <Textarea rows={2} value={v} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  }
  return (
    <Input value={v} disabled={disabled} placeholder={placeholder} inputMode={f === 'price' ? 'decimal' : undefined}
      onChange={(e) => onChange(e.target.value)} />
  )
}

/** form over one set of fields; `inherited` = value shown as placeholder when left blank */
function SpecForm({ fields, values, inherited, ro, onChange }: {
  fields: Field[]; values: Partial<Record<Field, Val>>; inherited?: Partial<Record<Field, { v: Val; from: string }>>
  ro?: boolean; onChange: (f: Field, v: Val) => void
}) {
  return (
    <div className="space-y-3">
      {fields.map((f) => {
        const inh = inherited?.[f]
        const ph = inh?.v != null && inh.v !== '' ? String(inh.v) : undefined
        return (
          <Field key={f} label={LABEL[f]} asDiv
            help={ph && (values[f] == null || values[f] === '') ? `เว้นว่าง = ใช้ค่าจาก${LAYER[inh!.from] ?? ''}` : undefined}>
            <SpecInput f={f} value={values[f]} placeholder={ph} disabled={ro} onChange={(v) => onChange(f, v)} />
          </Field>
        )
      })}
    </div>
  )
}

const pick = (s: Spec | undefined, fields: Field[]) => Object.fromEntries(fields.map((f) => [f, s?.[f] ?? null])) as Partial<Record<Field, Val>>

// ── one product ────────────────────────────────────────────────────────────
function LineModal({ line, own, slug, rev, ro, onClose, onSave }: {
  line: Line; own: Spec | undefined; slug: string; rev: number; ro: boolean
  onClose: () => void; onSave: (rows: Spec[]) => Promise<void>
}) {
  const { showToast } = useToast()
  const [vals, setVals] = useState(() => pick(own, PRODUCT_FIELDS))
  const [saving, setSaving] = useState(false)
  // values that come from a layer above the product → placeholders
  const inherited = Object.fromEntries(
    PRODUCT_FIELDS.filter((f) => line.from[f] && line.from[f] !== 'product').map((f) => [f, { v: line.values[f] ?? null, from: line.from[f]! }]),
  )
  const save = async () => {
    setSaving(true)
    try {
      await onSave([{ ...(own ?? {}), ...vals, brand: line.part, scope: 'product', key: line.code }])
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }
  const p = problems(line)
  return (
    <Modal open onClose={onClose} maxWidth={860} title={`${line.code} · ${line.name}`}
      description={`${line.grp} · สั่ง ${line.qty.toLocaleString()} ชิ้น → พิมพ์ ${line.copies.toLocaleString()} ดวง`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>ปิด</Button>
        {!ro && <Button variant="primary" loading={saving} onClick={save}>บันทึก</Button>}
      </>}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG preview */}
          <img src={`/api/labels/preview?r=${encodeURIComponent(slug)}&code=${encodeURIComponent(line.code)}&v=${rev}`}
            alt="ตัวอย่างฉลาก" className="w-full border border-[var(--border-1)]" />
          <div className="text-xs text-[var(--fg-3)]">
            {sizeName(line.size)} · ตัวอักษร {line.fit.bodyPt} pt · ช่อง QR {line.fit.qrModule} มม. — ภาพนี้วาดด้วยตัวเดียวกับไฟล์ PDF
          </div>
          {p.length > 0 && <div className="flex flex-wrap gap-1">{p.map((x) => <Pill key={x.text} tone={x.tone}>{x.text}</Pill>)}</div>}
        </div>
        <div>
          <p className="mb-3 text-xs text-[var(--fg-3)]">ค่าที่กรอกตรงนี้ใช้กับสินค้ารหัสนี้เท่านั้น (ทุกรอบที่สั่งอีก) · ช่องว่างใช้ค่าของหมวด/แบรนด์</p>
          <SpecForm fields={PRODUCT_FIELDS} values={vals} inherited={inherited} ro={ro} onChange={(f, v) => setVals((s) => ({ ...s, [f]: v }))} />
        </div>
      </div>
    </Modal>
  )
}

// ── brand + all-brand defaults ─────────────────────────────────────────────
function BrandModal({ data, ro, onClose, onSave }: { data: Data; ro: boolean; onClose: () => void; onSave: (rows: Spec[]) => Promise<void> }) {
  const { showToast } = useToast()
  const brandKey = data.round.brand.toLowerCase()
  const tabs = [
    { value: '*', label: 'ค่ากลาง (ทุกแบรนด์)' },
    { value: brandKey, label: data.round.brand },
    ...data.parts.filter((p) => p.key !== brandKey).map((p) => ({ value: p.key, label: p.name })),
  ]
  const [tab, setTab] = useState('*')
  const fields = tab === '*' ? ALL_FIELDS : BRAND_FIELDS
  const own = data.specs.find((s) => s.brand === tab && s.scope === 'brand')
  const [vals, setVals] = useState(() => pick(own, fields))
  const [saving, setSaving] = useState(false)
  useEffect(() => { setVals(pick(data.specs.find((s) => s.brand === tab && s.scope === 'brand'), tab === '*' ? ALL_FIELDS : BRAND_FIELDS)) }, [tab, data.specs])

  const save = async () => {
    setSaving(true)
    try {
      await onSave([{ ...(own ?? {}), ...vals, brand: tab, scope: 'brand', key: '' }])
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal open onClose={onClose} maxWidth={600} title="ข้อมูลแบรนด์ / ค่ากลาง"
      description="ค่ากลางใช้กับทุกฉลาก · ค่าของแบรนด์ทับค่ากลาง · หมวดและสินค้าทับแบรนด์อีกชั้น"
      footer={<>
        <Button variant="ghost" onClick={onClose}>ปิด</Button>
        {!ro && <Button variant="primary" loading={saving} onClick={save}>บันทึก</Button>}
      </>}>
      <div className="space-y-4">
        <Segmented className="w-full" value={tab} onChange={setTab} options={tabs} />
        <SpecForm fields={fields} values={vals} ro={ro} onChange={(f, v) => setVals((s) => ({ ...s, [f]: v }))} />
      </div>
    </Modal>
  )
}

// ── share with the factory ─────────────────────────────────────────────────
function ShareModal({ data, bad, ro, onClose, onShare }: {
  data: Data; bad: number; ro: boolean; onClose: () => void; onShare: (on: boolean) => Promise<void>
}) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const token = data.settings.share_token
  const url = token ? `${window.location.origin}/labels/${token}` : ''
  const toggle = async (on: boolean) => { setBusy(true); await onShare(on); setBusy(false) }

  return (
    <Modal open onClose={onClose} maxWidth={620} title="ส่งให้โรงงานพิมพ์"
      description="โรงงานเปิดลิงก์ได้โดยไม่ต้องล็อกอิน หน้าเป็นภาษาอังกฤษ/จีน ดาวน์โหลด PDF ได้เอง (ชุดปุ่มเดียวกับ “พิมพ์เอง”) · ข้อมูลในไฟล์อัปเดตตามที่แก้ล่าสุดเสมอ"
      footer={<Button variant="ghost" onClick={onClose}>ปิด</Button>}>
      <div className="space-y-4">
        {bad > 0 && <Alert tone="warning" compact>ยังมี {bad} รหัสที่ต้องแก้ — แก้ก่อนส่งดีกว่า (ลิงก์อัปเดตตามที่แก้ ไม่ต้องส่งใหม่)</Alert>}
        <div className="flex items-center gap-3">
          <Toggle checked={!!token} loading={busy} disabled={ro} onChange={toggle} aria-label="เปิดลิงก์แชร์" />
          <span className="text-sm">{token ? 'ลิงก์เปิดอยู่' : 'ลิงก์ปิดอยู่ — เปิดเพื่อสร้างลิงก์'}</span>
        </div>
        {token && (
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.target.select()} />
            <Button variant="secondary" icon={Copy} onClick={() => navigator.clipboard.writeText(url).then(() => showToast('คัดลอกลิงก์แล้ว'))}>คัดลอก</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

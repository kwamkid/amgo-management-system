'use client'

// SRP Calculator — ตารางสินค้า+ราคาของแบรนด์ (rebuild จาก srp-calculator เดิม
// แต่ UI เป็นชุด amgo — เจ้าของสั่ง 14 ส.ค. 69)
//
// ตาราง Excel-like: แก้ตัวเลขในเซลล์ตรง ๆ (กด Enter = บันทึก) → คอลัมน์คำนวณ
// (ต้นทุนรวม/ราคาแนะนำ/margin) ขยับตามทันที + กำไรต่อช่องทางขาย 4 คอลัมน์/ช่องทาง
// offline คิดจากราคาขายเรา · online คิดจากราคา platform (กติกาเดิมของระบบเก่า)
//
// ⚠ ตารางนี้ใหญ่จริง (Stokke = 114 สินค้า × 7 ช่องทาง ≈ 6,000 ช่อง) ถ้าไม่ระวัง
// การกดอะไรสักอย่างจะกลายเป็นวาดใหม่ทั้งใบ — เจ้าของบ่นว่าหน่วง 29 ส.ค. 69
// กติกาที่ต้องรักษาไว้เวลาแก้ต่อ:
//   1. แถว/การ์ดถูก memo ไว้ → prop ที่ส่งเข้าไปต้องนิ่ง (callback ห่อ
//      useCallback([]) แล้วอ่านค่าล่าสุดผ่าน live.current)
//   2. calculateProduct มี cache ผูกกับตัวสินค้า → แถวที่ไม่ได้แก้ได้ผลตัวเดิม
//   3. สิ่งที่เปลี่ยนถี่ ๆ (พิมพ์ตัวอักษร, ลากปรับความกว้าง) ห้ามแตะ state ของ
//      หน้า — เก็บไว้ในตัวช่องเอง (NumCell/TextCell) หรือเขียน DOM ตรง ๆ
//   4. จอกว้าง/จอแคบ วาดทีละชุด ไม่ใช่วาดคู่แล้วซ่อนด้วย CSS
//
// ช่องในตารางราคา "บันทึกตอนกด Enter เท่านั้น" (useEnterToSave) — คลิกออก = ทิ้ง
// ที่พิมพ์ เจ้าของสั่ง 29 ส.ค. 69 กันพิมพ์ผิดแล้วเผลอคลิกหนีจนราคาเพี้ยน
// ยกเว้นช่องในหน้าต่างตั้งค่าช่องทาง (saveOnBlur) เพราะหน้าต่างนั้นมีปุ่ม
// "บันทึก" — กดปุ่มแล้วช่องจะ blur ก่อน ถ้าไม่เซฟตรงนั้นค่าจะหายเงียบ ๆ
// ส่วนการแก้ทุกครั้งถูกจดลง srp_product_history ด้วย trigger ฝั่ง DB (ดู
// migration 20260829000000) — ปุ่ม "ประวัติการแก้ไข" บนหัวหน้าเปิดดู + ย้อนกลับได้

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Calculator, Download, Eye, EyeOff, FileSpreadsheet, GripVertical, History, ImageIcon, Loader2,
  Plus, Power, RotateCcw, Settings2, Trash2, Upload, Wand2, X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Modal, SelectMenu } from '@/components/aoo'
import { FilterBar, FilterSelect, PageHeader, Segmented, TechLoader } from '@/components/shared'
import { createClient } from '@/lib/supabase/client'
import { useMediaQuery } from '@/lib/use-media-query'
import {
  calculateProduct,
  calculateChannelProfit,
  roundToNicePrice,
  type CalculatedProduct,
  type SrpBrand,
  type SrpChannel,
  type ChannelType,
  type SrpProduct,
} from '@/lib/services/srp/calculator'
import {
  deleteSrpChannel,
  deleteSrpProduct,
  getSrpBrand,
  getSrpChannels,
  getSrpHistory,
  getSrpProducts,
  saveSrpBrand,
  saveSrpChannel,
  uploadSrpImage,
  type SrpHistoryEntry,
} from '@/lib/services/srp/srpService'

const fmt = (n: number, d = 0) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: d })

/** สีของ margin/กำไร — เขียว=ดี แดง=บาง ม่วง=ขาดทุน (ย่อจากสเกลของระบบเดิม) */
const profitClass = (pct: number) =>
  pct >= 30
    ? 'bg-green-100 text-green-700'
    : pct >= 15
      ? 'bg-lime-100 text-lime-700'
      : pct >= 5
        ? 'bg-amber-100 text-amber-700'
        : pct >= 0
          ? 'bg-orange-100 text-orange-700'
          : 'bg-purple-100 text-purple-700'

/** ความกว้างเริ่มต้นของแต่ละคอลัมน์ (px) — ผู้ใช้ลากปรับเองได้ ระบบจำไว้ต่อแบรนด์ */
const COL_W: Record<string, number> = {
  product: 320, sku: 120, category: 120, fobUsd: 86, fobEur: 86, fobThb: 92,
  freightDo: 104, importTaxPct: 84, shippingCost: 96, totalCost: 108,
  srpUsd: 86, srpEur: 86, srpSgd: 86, srpThb: 96,
  multiplier: 64, suggested: 96, ourPrice: 120, margin: 96,
  platformPct: 84, platformSuggested: 116, platform: 132, platformMargin: 116, actions: 84,
}
const CH_COL_W = 92 // ความกว้างต่อ 1 คอลัมน์ของช่องทางขาย (3 หรือ 5 คอลัมน์ต่อช่องทาง)

/** ประเภทช่องทางขาย — เจ้าของแยกเป็น 3 เมื่อ 28 ส.ค. 69 */
const CHANNEL_TYPES = ['retail', 'department', 'marketplace'] as const
const CHANNEL_TYPE_LABEL: Record<ChannelType, string> = {
  retail: 'ช่องทางปกติ',
  department: 'ห้าง',
  marketplace: 'Marketplace',
}

/**
 * ช่องที่ประวัติจดไว้ → ป้ายภาษาไทย + ชื่อ field ฝั่งหน้าเว็บ + ชนิดค่า
 *
 * key = ชื่อคอลัมน์จริงใน srp_products (trigger ฝั่ง DB จดมาแบบนั้น)
 * ต้องตรงกับรายการช่องใน trigger srp_log_product_changes ไม่งั้นประวัติจะโผล่มา
 * เป็นชื่อคอลัมน์ดิบ ๆ และกดย้อนกลับไม่ได้
 */
const HISTORY_FIELDS: Record<
  string,
  { label: string; local: keyof SrpProduct; kind: 'text' | 'num' | 'bool' }
> = {
  created: { label: 'เพิ่มสินค้า', local: 'name', kind: 'text' },
  name: { label: 'ชื่อสินค้า', local: 'name', kind: 'text' },
  category: { label: 'หมวด', local: 'category', kind: 'text' },
  sku: { label: 'SKU', local: 'sku', kind: 'text' },
  image_url: { label: 'รูปสินค้า', local: 'imageUrl', kind: 'text' },
  notes: { label: 'หมายเหตุ', local: 'notes', kind: 'text' },
  fob_usd: { label: 'FOB $', local: 'fobUsd', kind: 'num' },
  fob_eur: { label: 'FOB €', local: 'fobEur', kind: 'num' },
  freight_do: { label: 'ค่าเรือ/D.O.', local: 'freightDo', kind: 'num' },
  import_tax_pct: { label: 'ภาษี %', local: 'importTaxPct', kind: 'num' },
  shipping_cost: { label: 'ส่งในไทย', local: 'shippingCost', kind: 'num' },
  srp_usd: { label: 'SRP $', local: 'srpUsd', kind: 'num' },
  srp_eur: { label: 'SRP €', local: 'srpEur', kind: 'num' },
  srp_sgd: { label: 'SRP S$', local: 'srpSgd', kind: 'num' },
  multiplier: { label: 'ตัวคูณ', local: 'multiplier', kind: 'num' },
  our_price_thb: { label: 'ราคาขายจริง', local: 'ourPriceThb', kind: 'num' },
  platform_price_thb: { label: 'Platform ขายจริง', local: 'platformPriceThb', kind: 'num' },
  platform_markup_pct: { label: 'Platform %', local: 'platformMarkupPct', kind: 'num' },
  is_active: { label: 'สถานะขาย', local: 'isActive', kind: 'bool' },
}

/** ค่าที่จดไว้เป็นข้อความ → รูปแบบที่คนอ่านรู้เรื่อง */
const historyValue = (field: string, v: string | null) => {
  if (v === null || v === '') return '—'
  const f = HISTORY_FIELDS[field]
  if (!f) return v
  if (f.kind === 'bool') return v === 'true' ? 'ขายอยู่' : 'เลิกขายแล้ว'
  if (field === 'image_url') return 'รูปสินค้า'
  if (f.kind === 'num') return fmt(parseFloat(v) || 0, 2)
  return v
}

const historyTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

/** ช่องที่ต้องกรอกของแต่ละประเภท — retail หัก GP อย่างเดียว ไม่ต้องมี PC/DC ให้กรอกหลอก */
const CHANNEL_FIELDS: Record<ChannelType, [keyof SrpChannel, string][]> = {
  retail: [
    ['gpPct', 'GP %'],
    ['promoPct', 'โปร %'],
  ],
  department: [
    ['gpPct', 'GP %'],
    ['pcPct', 'PC %'],
    ['dcPct', 'DC %'],
    ['promoPct', 'โปร %'],
  ],
  marketplace: [
    ['commissionPct', 'Comm %'],
    ['transactionFeePct', 'Trans %'],
    ['serviceFeePct', 'Service %'],
    ['shippingThb', 'ค่าส่ง ฿'],
    ['promoPct', 'โปร %'],
  ],
}

/** ฐานของ sort_order แยกตามประเภท — เรียงในกลุ่มตัวเองโดยไม่ไปปนกลุ่มอื่น */
const TYPE_BASE: Record<ChannelType, number> = { retail: 0, department: 1000, marketplace: 2000 }

/**
 * ราคาที่ช่องทางนั้นใช้คิดกำไร (เจ้าของยืนยัน 28 ส.ค. 69)
 *   ปกติ + ห้าง = ราคาขายจริง · marketplace = ราคาบนแพลตฟอร์ม
 */
const priceForChannel = (ch: SrpChannel, p: CalculatedProduct) =>
  ch.type === 'marketplace' ? p.platformEffective || 0 : p.effectivePrice

/**
 * ตรรกะร่วมของ "ทุกช่องที่พิมพ์แก้ได้" ในหน้านี้ — บันทึกตอนกด Enter เท่านั้น
 *
 *   Enter    บันทึก
 *   Esc      ทิ้งที่พิมพ์ กลับไปค่าเดิม
 *   คลิกออก  ทิ้งที่พิมพ์เหมือนกด Esc
 *
 * เจ้าของสั่ง 29 ส.ค. 69: เดิมคลิกออกแล้วเซฟให้เลย พิมพ์ผิดแล้วเผลอคลิกหนี
 * = ราคาผิดเข้าฐานข้อมูลไปแล้วโดยไม่รู้ตัว · ตอนนี้ต้องยืนยันด้วย Enter เสมอ
 *
 * ระหว่างที่พิมพ์ค้างไว้ยังไม่กด Enter ช่องจะขึ้นกรอบส้ม (dirty) เตือนว่ายังไม่เซฟ
 */
function useEnterToSave(
  display: string,
  editValue: string,
  commit: (raw: string) => void,
  /**
   * true = คลิกออกแล้วบันทึกให้ด้วย — ใช้เฉพาะช่องในหน้าต่างตั้งค่า ซึ่งเป็น
   * ฟอร์มเล็ก ๆ ที่มีปุ่ม "บันทึก" อยู่ คนกดปุ่มนั้นย่อมตั้งใจจะบันทึก
   * (กดแล้วช่องจะ blur ก่อน ถ้าไม่บันทึกตรงนี้ค่าที่พิมพ์จะหายไปเฉย ๆ)
   * ตารางราคาซึ่งเป็นที่ที่พิมพ์ผิดแล้วอันตราย ยังเป็น Enter อย่างเดียวเหมือนเดิม
   */
  saveOnBlur = false
) {
  const [text, setText] = useState<string | null>(null) // null = ไม่ได้โฟกัสอยู่
  // Enter/Esc จัดการไปแล้ว — blur ที่ตามมาไม่ต้องทำอะไรซ้ำ
  const done = useRef(false)
  const dirty = text !== null && text !== editValue
  return {
    dirty,
    props: {
      value: text ?? display,
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
        done.current = false
        setText(editValue)
        requestAnimationFrame(() => e.target.select())
      },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value),
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (text !== null && text !== editValue) commit(text)
          done.current = true
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          // กัน Esc ทะลุไปปิดทั้งหน้าต่าง — กดครั้งแรกยกเลิกแค่ช่องนี้
          // ครั้งที่สอง (ไม่ได้อยู่ในช่องแล้ว) ค่อยปิดหน้าต่าง
          e.stopPropagation()
          done.current = true
          e.currentTarget.blur()
        }
      },
      onBlur: () => {
        if (saveOnBlur && !done.current && text !== null && text !== editValue) commit(text)
        done.current = false
        setText(null)
      },
    },
  }
}

const HINT = 'พิมพ์แล้วกด Enter เพื่อบันทึก · Esc หรือคลิกออก = ยกเลิก'
/** กรอบเตือนตอนพิมพ์ค้างไว้ยังไม่กด Enter */
const DIRTY_RING = 'border-orange-400 bg-orange-50 ring-1 ring-orange-300'

/** ช่องตัวเลขในตาราง — โชว์เลขมี comma ตอนไม่ได้พิมพ์ */
function NumCell({
  value,
  onSave,
  className = '',
  placeholder,
  disabled,
}: {
  value: number
  onSave: (v: number) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}) {
  const { props, dirty } = useEnterToSave(
    value ? fmt(value, 2) : '',
    value ? String(value) : '',
    (raw) => {
      const v = parseFloat(raw.replace(/,/g, '')) || 0
      if (v !== value) onSave(v)
    }
  )
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      title={disabled ? undefined : HINT}
      placeholder={placeholder}
      className={`h-9 w-full rounded border bg-transparent px-1.5 text-right text-[15px] tabular-nums focus:bg-white focus:outline-none disabled:text-gray-400 ${
        dirty ? DIRTY_RING : 'border-transparent focus:border-amber-300'
      } ${className}`}
    />
  )
}

/** ช่องข้อความในตาราง (ชื่อสินค้า / SKU) — กติกาเดียวกับ NumCell */
function TextCell({
  value,
  onSave,
  readOnly,
  className = '',
}: {
  value: string
  onSave: (v: string) => void
  readOnly?: boolean
  className?: string
}) {
  const { props, dirty } = useEnterToSave(value, value, (raw) => {
    if (raw !== value) onSave(raw)
  })
  return (
    <input
      {...props}
      readOnly={readOnly}
      title={readOnly ? undefined : HINT}
      className={`w-full rounded border bg-transparent px-1.5 py-1 text-[15px] focus:bg-white focus:outline-none ${
        dirty ? DIRTY_RING : 'border-transparent focus:border-amber-300'
      } ${className}`}
    />
  )
}

export default function SrpBrandPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const brandId = params.id
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [brand, setBrand] = useState<SrpBrand | null>(null)
  const [products, setProducts] = useState<SrpProduct[] | null>(null)
  const [channels, setChannels] = useState<SrpChannel[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  /** แถวที่เคอร์เซอร์อยู่ในช่องหมวด — กันแถวหายกลางคันตอนแก้หมวดขณะกรองหมวดอยู่ */
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  /** แถวที่ติ๊กไว้ — ใช้เปลี่ยนหมวดทีเดียวหลายแถว (เจ้าของเปลี่ยนใจ 28 ส.ค. 69
      จากเดิมที่ตั้งใจให้ติ๊กไว้ดูเฉย ๆ) · ไม่บันทึกลงฐานข้อมูล หายเมื่อออกจากหน้า */
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const toggleMark = useCallback((id: string) => {
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const [statusTab, setStatusTab] = useState<'active' | 'inactive' | 'all'>('active')
  const [channelTab, setChannelTab] = useState<ChannelType>('retail')
  /** โชว์คอลัมน์ "ร้านได้฿/ร้านได้%" ของแต่ละช่องทางไหม (ค่าเริ่มต้น = โชว์) */
  const [showPartner, setShowPartner] = useState(true)
  /** ช่องทางที่กำลังตั้งค่าจากการกดหัวคอลัมน์ — เดิมต้องเปิดเมนู "ช่องทางขาย"
   *  แล้วไล่หาเองว่าอันไหน (เจ้าของขอ 29 ส.ค. 69) */
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const editingChannel = channels.find((c) => c.id === editingChannelId) ?? null
  const [lightbox, setLightbox] = useState<SrpProduct | null>(null)
  /** เดิมตารางกับการ์ดถูกวาดทั้งคู่แล้วซ่อนอันหนึ่งด้วย CSS — งานเรนเดอร์เลย
   *  เป็นสองเท่าตลอดเวลา ทั้งที่คนดูเห็นแค่ชุดเดียว (แก้ 29 ส.ค. 69) */
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [showChannels, setShowChannels] = useState(false)
  /** null = ปิด · { productId: null } = ประวัติทั้งแบรนด์ · มี id = เฉพาะสินค้านั้น */
  const [historyOf, setHistoryOf] = useState<{ productId: string | null; name: string } | null>(null)
  const [exporting, setExporting] = useState(false)

  // ── ปรับความกว้างคอลัมน์แบบ Excel: ลากขอบหัวตาราง · ดับเบิลคลิกคืนค่าเดิม ──
  // จำไว้ใน localStorage แยกตามแบรนด์ (ตารางแต่ละแบรนด์คอลัมน์ไม่เท่ากัน)
  const [colW, setColW] = useState<Record<string, number>>({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`srp-col-${brandId}`)
      if (raw) setColW(JSON.parse(raw))
    } catch {
      /* อ่านค่าไม่ได้ — ใช้ความกว้างเริ่มต้น */
    }
  }, [brandId])

  const widthOf = (key: string) => colW[key] ?? COL_W[key] ?? CH_COL_W
  const remember = (next: Record<string, number>) => {
    try {
      localStorage.setItem(`srp-col-${brandId}`, JSON.stringify(next))
    } catch {
      /* เซฟไม่ได้ก็ไม่เป็นไร */
    }
  }

  // ระหว่างลาก เขียนความกว้างลง <col> กับ <table> ตรง ๆ ไม่ผ่าน state
  // (setState ทุก mousemove = คำนวณ+วาดตารางทั้งใบ 60 ครั้ง/วินาที — เมาส์ไปแล้ว
  //  เส้นยังตามไม่ทัน) แล้วค่อยเก็บค่าจริงลง state ตอนปล่อยเมาส์ทีเดียว
  const tableRef = useRef<HTMLTableElement | null>(null)
  const tableWidthRef = useRef(0)

  const startResize = (keys: string[], e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const base = keys.map((k) => widthOf(k))
    const table = tableRef.current
    const cols = keys.map(
      (k) => table?.querySelector<HTMLTableColElement>(`col[data-k="${k}"]`) ?? null
    )
    const baseTableW = tableWidthRef.current
    const latest: Record<string, number> = {}
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / keys.length
      let delta = 0
      keys.forEach((k, i) => {
        const w = Math.max(48, Math.round(base[i] + dx))
        latest[k] = w
        delta += w - base[i]
        const col = cols[i]
        if (col) col.style.width = `${w}px`
      })
      if (table) table.style.width = `${baseTableW + delta}px`
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      if (!Object.keys(latest).length) return
      setColW((prev) => {
        const next = { ...prev, ...latest }
        remember(next)
        return next
      })
    }
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const resetCols = (keys: string[]) => {
    setColW((prev) => {
      const next = { ...prev }
      keys.forEach((k) => delete next[k])
      remember(next)
      return next
    })
  }

  const editorName = userData?.displayName || userData?.fullName || ''
  const canSee = !!userData && (userData.role === 'admin' || userData.hasSrpAccess)
  // ต้นทุนสินค้า = ข้อมูลอ่อนไหว (เจ้าของย้ำ 14 ส.ค.) — viewer อ่านอย่างเดียวจริง ๆ
  // ทั้งหน้าจอและชั้น DB (RLS กันเขียนอยู่แล้ว หน้าจอแค่ไม่หลอกให้กดแล้วพัง)
  const [canEdit, setCanEdit] = useState(false)

  /**
   * ค่าล่าสุดที่ callback ต้องใช้ แต่ห้ามใส่เป็น dependency
   *
   * แถว/การ์ดในตารางถูก memo ไว้ ถ้า callback เปลี่ยนตัวทุกรอบเรนเดอร์
   * memo จะมองว่า prop เปลี่ยน แล้ววาดใหม่ทั้งตารางเหมือนเดิม — เสียของ
   * (showToast จาก useToast สร้างใหม่ทุกรอบอยู่แล้ว จึงต้องผ่านทางนี้)
   */
  const live = useRef({
    canEdit: false,
    editorName: '',
    showToast,
    togglingId: null as string | null,
  })
  live.current.canEdit = canEdit
  live.current.editorName = editorName
  live.current.showToast = showToast

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  useEffect(() => {
    if (!userData?.id || !brandId) return
    if (userData.role === 'admin') {
      setCanEdit(true)
      return
    }
    createClient()
      .from('srp_brand_access')
      .select('role')
      .eq('brand_id', brandId)
      .eq('user_id', userData.id)
      .maybeSingle()
      .then(({ data }) => setCanEdit(data?.role === 'editor'))
  }, [userData, brandId])

  useEffect(() => {
    if (!canSee || !brandId) return
    Promise.all([getSrpBrand(brandId), getSrpProducts(brandId), getSrpChannels(brandId)])
      .then(([b, p, c]) => {
        if (!b) {
          showToast('ไม่พบแบรนด์ หรือคุณไม่มีสิทธิ์', 'error')
          router.push('/srp')
          return
        }
        setBrand(b)
        setProducts(p)
        setChannels(c)
      })
      .catch((e) => showToast(e.message, 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee, brandId])

  /* ── เซฟช้าแบบรวมก้อน: แก้เซลล์แล้วอัพเดตจอทันที เขียน DB ตามหลัง ── */
  const pending = useRef(new Map<string, Partial<Record<string, unknown>>>())
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const patchProduct = useCallback(
    (id: string, dbFields: Record<string, unknown>, local: Partial<SrpProduct>) => {
      setProducts((prev) => prev?.map((p) => (p.id === id ? { ...p, ...local } : p)) ?? prev)
      const cur = pending.current.get(id) ?? {}
      pending.current.set(id, { ...cur, ...dbFields })
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(async () => {
        const batch = [...pending.current.entries()]
        pending.current.clear()
        const sb = createClient()
        for (const [pid, fields] of batch) {
          const { error } = await sb
            .from('srp_products')
            .update({
              ...fields,
              last_edited_by: live.current.editorName,
              last_edited_at: new Date().toISOString(),
            })
            .eq('id', pid)
          if (error) live.current.showToast(`เซฟไม่สำเร็จ: ${error.message}`, 'error')
        }
      }, 400)
    },
    []
  )

  /**
   * เลิกขาย / กลับมาขาย — เขียน DB ตรงแล้วรอผลจริง ไม่ผ่าน patchProduct
   * เพราะตัวนั้นหน่วง 400 ms ไว้รวมคีย์ที่พิมพ์รัว ๆ ซึ่งไม่เหมาะกับปุ่มที่กดครั้งเดียว
   * แล้วอยากเห็นว่าบันทึกจริงหรือยัง (เจ้าของขอสถานะตอนกด 29 ส.ค. 69)
   */
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const toggleActive = useCallback(async (id: string, current: boolean) => {
    const { canEdit, editorName, showToast } = live.current
    if (!canEdit || live.current.togglingId) return
    const next = !current
    live.current.togglingId = id
    setTogglingId(id)
    setProducts((prev) => prev?.map((p) => (p.id === id ? { ...p, isActive: next } : p)) ?? prev)
    try {
      const sb = createClient()
      const { error } = await sb
        .from('srp_products')
        .update({
          is_active: next,
          last_edited_by: editorName,
          last_edited_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
      showToast(next ? 'กลับมาขายแล้ว' : 'ทำเครื่องหมายว่าเลิกขายแล้ว', 'success')
    } catch (e) {
      // เขียนไม่สำเร็จ — คืนค่าเดิมให้ตรงกับฐานข้อมูล
      setProducts((prev) => prev?.map((p) => (p.id === id ? { ...p, isActive: current } : p)) ?? prev)
      showToast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      live.current.togglingId = null
      setTogglingId(null)
    }
  }, [])

  /** ลบสินค้า — แยกออกมาเป็น callback นิ่ง ๆ ให้แถว/การ์ดที่ memo ไว้เรียกใช้ */
  const deleteProduct = useCallback(async (p: SrpProduct) => {
    if (!confirm(`ลบ "${p.name}" ?`)) return
    await deleteSrpProduct(p.id)
    setProducts((prev) => prev?.filter((x) => x.id !== p.id) ?? prev)
  }, [])

  /* ── คำนวณ + กรอง ─────────────────────────────────────────────────── */
  /**
   * ผลคำนวณของสินค้าที่ "ไม่ได้แก้" ต้องเป็นออบเจกต์ตัวเดิม
   *
   * เดิมแก้ช่องเดียวแล้ว calculateProduct ถูกเรียกใหม่ทุกตัว ได้ออบเจกต์ใหม่
   * ทั้ง 114 ตัว → memo ของแถวมองว่าเปลี่ยนหมด → วาดใหม่ทั้งตารางอยู่ดี
   * เก็บผลไว้ใน WeakMap ผูกกับตัวสินค้า (แก้แถวไหน แถวนั้นถึงจะคิดใหม่)
   * เปลี่ยนเรตเงิน/ตัวคูณของแบรนด์ = brand เป็นคนละตัว → ล้างทิ้งคิดใหม่หมด
   */
  const calcCache = useRef<{ brand: SrpBrand | null; map: WeakMap<SrpProduct, CalculatedProduct> }>({
    brand: null,
    map: new WeakMap(),
  })

  const calculated = useMemo<CalculatedProduct[]>(() => {
    if (!brand || !products) return []
    if (calcCache.current.brand !== brand) calcCache.current = { brand, map: new WeakMap() }
    const { map } = calcCache.current
    return products.map((p) => {
      const hit = map.get(p)
      if (hit) return hit
      const c = calculateProduct(p, brand)
      map.set(p, c)
      return c
    })
  }, [brand, products])

  /** รายชื่อหมวด — ผูกกับ "ชุดหมวดที่มีอยู่" ไม่ใช่ตัวสินค้า เพื่อให้ตัวเลือก
   *  หมวด (ซึ่งส่งเข้าไปในทุกแถว) ไม่เปลี่ยนตัวตอนแค่แก้ราคา */
  const categoryKey = useMemo(
    () => [...new Set((products ?? []).map((p) => p.category).filter(Boolean))].sort().join('\u0000'),
    [products]
  )
  const categories = useMemo(
    () => (categoryKey ? categoryKey.split('\u0000') : []),
    [categoryKey]
  )

  /** ตัวเลือกหมวดของ dropdown ในตาราง — หมวดใหม่ที่เพิ่งพิมพ์จะโผล่มาเองรอบถัดไป */
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c, label: c })),
    [categories]
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return calculated.filter((p) => {
      if (statusTab === 'active' && !p.isActive) return false
      if (statusTab === 'inactive' && p.isActive) return false
      // แถวที่กำลังพิมพ์หมวดอยู่ ต้องไม่หายไปกลางคันแม้จะกรองไม่ตรงแล้ว
      if (category && p.category !== category && p.id !== editingCategoryId) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false
      return true
    })
  }, [calculated, search, category, statusTab, editingCategoryId])

  /** ติ๊กทั้งหน้า / ล้างทั้งหมด — อิงเฉพาะแถวที่มองเห็นอยู่ตอนนั้น */
  const allVisibleMarked = visible.length > 0 && visible.every((p) => marked.has(p.id))
  const toggleMarkAll = () =>
    setMarked((prev) => {
      const next = new Set(prev)
      if (allVisibleMarked) visible.forEach((p) => next.delete(p.id))
      else visible.forEach((p) => next.add(p.id))
      return next
    })

  /**
   * เปลี่ยนหมวดของแถวที่ติ๊กไว้ทั้งหมดในครั้งเดียว
   * patchProduct รวมทุกแถวไว้ในคิวเดียวแล้วยิงทีเดียวตอน debounce หมด
   * ล้างการติ๊กหลังเปลี่ยน — ไม่งั้นเผลอเปลี่ยนซ้ำทับของที่เพิ่งทำ
   */
  const applyCategoryToMarked = (name: string) => {
    const ids = [...marked]
    ids.forEach((id) => patchProduct(id, { category: name }, { category: name }))
    setMarked(new Set())
    showToast(`เปลี่ยนหมวดเป็น "${name}" แล้ว ${ids.length} รายการ`, 'success')
  }

  const shownChannels = useMemo(
    () => channels.filter((c) => c.type === channelTab),
    [channels, channelTab]
  )

  /** คอลัมน์ Platform (% / แนะนำ / ขายจริง) โชว์เฉพาะแท็บ Marketplace
   *  — ช่องทางปกติกับห้างคิดกำไรจากราคาขายจริง ไม่ได้ใช้ราคา platform เลย */
  const isMarketplace = channelTab === 'marketplace'

  /** คอลัมน์ "ร้านได้฿ / ร้านได้%" — เฉพาะช่องทางที่หัก GP ให้คนอื่น (ปกติ/ห้าง)
   *  marketplace ไม่มี เพราะที่หักไปเป็นค่าธรรมเนียม ไม่ใช่กำไรของใคร
   *  กดซ่อนได้เมื่อตารางแน่นเกินไป (เจ้าของขอ 28 ส.ค. 69) */
  const showPartnerCols = !isMarketplace && showPartner

  const activeCount = calculated.filter((p) => p.isActive).length

  /* ── งานหัวตาราง ──────────────────────────────────────────────────── */

  // ตัวคูณทั้งแบรนด์ — เขียนทับ multiplier ทุกสินค้า + default ของแบรนด์
  /** สร้างช่องทางปกติชุด GP 25–50% รวดเดียว — ข้ามระดับที่มีอยู่แล้ว กดซ้ำไม่เกิดของซ้ำ */
  const addRetailGpSet = async () => {
    if (!brand) return
    const levels = [25, 30, 35, 40, 45, 50]
    const existing = new Set(
      channels.filter((c) => c.type === 'retail').map((c) => c.gpPct)
    )
    const missing = levels.filter((g) => !existing.has(g))
    if (missing.length === 0) {
      showToast('มีครบทั้ง 6 ระดับแล้ว', 'success')
      return
    }
    try {
      for (const [i, gp] of missing.entries()) {
        await saveSrpChannel({
          brandId: brand.id,
          type: 'retail',
          name: `GP ${gp}%`,
          gpPct: gp,
          sortOrder: 100 + levels.indexOf(gp),
          pcPct: 0,
          dcPct: 0,
          commissionPct: 0,
          transactionFeePct: 0,
          serviceFeePct: 0,
          shippingThb: 0,
          promoPct: 0,
        })
        void i
      }
      setChannels(await getSrpChannels(brand.id))
      showToast(`เพิ่มแล้ว ${missing.length} ระดับ (${missing.join('/')}%)`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'เพิ่มช่องทางไม่สำเร็จ', 'error')
    }
  }

  /**
   * ย้อนค่าช่องหนึ่งกลับไปเป็นค่าก่อนหน้า
   * เขียนผ่านตัวเซฟปกติ → trigger จดเป็นการแก้ครั้งใหม่ ประวัติจึงไม่ถูกลบทิ้ง
   */
  const revertHistory = useCallback((e: SrpHistoryEntry) => {
    const f = HISTORY_FIELDS[e.field]
    if (!f || e.field === 'created') return
    const raw = e.oldValue
    const value =
      f.kind === 'num' ? parseFloat(raw ?? '0') || 0 : f.kind === 'bool' ? raw === 'true' : raw ?? ''
    patchProduct(e.productId, { [e.field]: value }, { [f.local]: value } as Partial<SrpProduct>)
    live.current.showToast(
      `ย้อน "${f.label}" กลับเป็น ${historyValue(e.field, raw)} แล้ว`,
      'success'
    )
  }, [patchProduct])

  const openHistory = useCallback(
    (p: SrpProduct) => setHistoryOf({ productId: p.id, name: p.name }),
    []
  )

  /* ── จัดการช่องทางขาย (ใช้ในหน้าต่างตั้งค่า) ─────────────────────── */

  /** แก้ค่าช่องทางเดียว — เขียนจอทันที เขียน DB ตามหลัง */
  const patchChannel = (ch: SrpChannel, patch: Partial<SrpChannel>) => {
    const next = { ...ch, ...patch }
    setChannels((prev) => prev.map((c) => (c.id === ch.id ? next : c)))
    saveSrpChannel(next).catch((e) => showToast(e.message, 'error'))
  }

  const removeChannel = async (ch: SrpChannel) => {
    if (!confirm(`ลบช่องทาง "${ch.name}" ออกจากตาราง?`)) return
    try {
      await deleteSrpChannel(ch.id)
      setChannels((prev) => prev.filter((c) => c.id !== ch.id))
      showToast('ลบช่องทางแล้ว', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ลบไม่สำเร็จ', 'error')
    }
  }

  /**
   * เรียงลำดับใหม่ในกลุ่มเดียว — ids คือลำดับที่ต้องการหลังลากเสร็จ
   * เขียน sort_order ใหม่ทั้งกลุ่มทีเดียว แล้วเรียง state ให้ตรงกับที่โชว์
   * (ไม่เรียง state ด้วย คอลัมน์ในตารางจะยังอยู่ที่เดิมจนกว่าจะโหลดหน้าใหม่)
   */
  const reorderChannels = async (type: ChannelType, ids: string[]) => {
    const byId = new Map(channels.map((c) => [c.id, c]))
    const moved = ids
      .map((id, i) => {
        const c = byId.get(id)
        return c ? { ...c, sortOrder: TYPE_BASE[type] + i } : null
      })
      .filter((c): c is SrpChannel => c !== null)
    setChannels((prev) =>
      prev
        .map((c) => moved.find((m) => m.id === c.id) ?? c)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    )
    try {
      await Promise.all(moved.map((c) => saveSrpChannel(c)))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'เรียงลำดับไม่สำเร็จ', 'error')
    }
  }

  /** เพิ่มช่องทางเปล่า 1 อัน — เดิมมีแต่ปุ่มชุด GP มาตรฐาน ห้าง/marketplace
   *  เลยเพิ่มเองไม่ได้เลย (เจอตอนรื้อหน้าต่างนี้ 29 ส.ค. 69) */
  const addChannel = async (type: ChannelType) => {
    if (!brand) return
    const taken = new Set(channels.map((c) => c.name))
    let name = 'ช่องทางใหม่'
    for (let i = 2; taken.has(name); i++) name = `ช่องทางใหม่ ${i}`
    try {
      await saveSrpChannel({
        brandId: brand.id,
        type,
        name,
        sortOrder: TYPE_BASE[type] + channels.filter((c) => c.type === type).length,
        gpPct: 0,
        pcPct: 0,
        dcPct: 0,
        commissionPct: 0,
        transactionFeePct: 0,
        serviceFeePct: 0,
        shippingThb: 0,
        promoPct: 0,
      })
      setChannels(await getSrpChannels(brand.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'เพิ่มช่องทางไม่สำเร็จ', 'error')
    }
  }

  const applyGlobalMultiplier = async (m: number) => {
    if (!brand || !products) return
    if (!confirm(`ตั้งตัวคูณ ×${m} ให้สินค้าทั้งแบรนด์ (${products.length} ตัว)?`)) return
    const sb = createClient()
    await sb
      .from('srp_products')
      .update({ multiplier: m, last_edited_by: editorName, last_edited_at: new Date().toISOString() })
      .eq('brand_id', brand.id)
    await saveSrpBrand({ ...brand, defaultMultiplier: m })
    setBrand({ ...brand, defaultMultiplier: m })
    setProducts(products.map((p) => ({ ...p, multiplier: m })))
    showToast(`ตั้งตัวคูณ ×${m} ทั้งแบรนด์แล้ว`, 'success')
  }

  // เอาราคาแนะนำทับราคาขายเรา + ราคา platform ทุกตัว
  const applyAllSuggested = async () => {
    if (!brand || !products) return
    if (!confirm(`ใช้ราคาแนะนำเป็นราคาขายจริงทั้งแบรนด์ (${products.length} ตัว)?`)) return
    const sb = createClient()
    for (const p of calculated) {
      await sb
        .from('srp_products')
        .update({
          our_price_thb: p.suggestedPrice,
          platform_price_thb: p.suggestedPrice,
          last_edited_by: editorName,
          last_edited_at: new Date().toISOString(),
        })
        .eq('id', p.id)
    }
    setProducts(products.map((p) => {
      const c = calculated.find((x) => x.id === p.id)
      return { ...p, ourPriceThb: c?.suggestedPrice ?? p.ourPriceThb, platformPriceThb: c?.suggestedPrice ?? p.platformPriceThb }
    }))
    showToast('ใช้ราคาแนะนำทั้งแบรนด์แล้ว', 'success')
  }

  // markup ราคา platform จากราคาขายเรา (กติกาเดิม: ปัดเลขสวยด้วย)
  const applyPlatformMarkup = async (pct: number) => {
    if (!brand || !products) return
    await saveSrpBrand({ ...brand, platformMarkupPct: pct })
    setBrand({ ...brand, platformMarkupPct: pct })
    if (!confirm(`ตั้ง Platform +${pct}% ให้ทุกตัวในแบรนด์ แล้วคำนวณราคาขายจริงบน platform ใหม่?`))
      return
    const sb = createClient()
    // เขียนทั้ง % รายสินค้าและราคาที่ได้ — ถ้าเขียนแต่ราคา ช่อง % รายตัวจะยังว่าง
    // อยู่ ดูเหมือนไม่ได้ตั้งอะไรไว้ทั้งที่ราคาเปลี่ยนไปแล้ว
    const updated = products.map((p) => {
      const c = calculated.find((x) => x.id === p.id)
      const base = c?.effectivePrice ?? 0
      return {
        ...p,
        platformMarkupPct: pct,
        platformPriceThb: base > 0 ? roundToNicePrice(base * (1 + pct / 100)) : 0,
      }
    })
    for (const p of updated) {
      await sb
        .from('srp_products')
        .update({
          platform_markup_pct: pct,
          platform_price_thb: p.platformPriceThb,
          last_edited_by: editorName,
          last_edited_at: new Date().toISOString(),
        })
        .eq('id', p.id)
    }
    setProducts(updated)
    showToast('คำนวณราคา platform ใหม่แล้ว', 'success')
  }

  const uploadProductImage = async (p: SrpProduct, file: File) => {
    try {
      const url = await uploadSrpImage(file, brandId)
      patchProduct(p.id, { image_url: url }, { imageUrl: url })
      setLightbox(null)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'อัพโหลดรูปไม่สำเร็จ', 'error')
    }
  }

  /* ── Export ───────────────────────────────────────────────────────── */

  // Export ข้อมูลเต็ม (ทุกสินค้า ไม่สนตัวกรอง — เจตนาเดิมของระบบเก่า)
  const exportFull = async () => {
    const XLSX = await import('xlsx')
    const rows = calculated.map((p, i) => {
      const base: Record<string, unknown> = {
        '#': i + 1,
        Product: p.name,
        Category: p.category,
        SKU: p.sku,
        'FOB USD': p.fobUsd || '',
        'FOB EUR': p.fobEur || '',
        'FOB THB': p.fobThb || '',
        'Freight + D/O': p.freightDo || '',
        'Import Tax %': p.importTaxPct || '',
        'Shipping Cost': p.shippingCost || '',
        'Total Import Cost': p.totalImportCost,
        'SRP USD': p.srpUsd || '',
        'SRP EUR': p.srpEur || '',
        'SRP SGD': p.srpSgd || '',
        'SRP THB (Intl)': p.srpThb || '',
        Multiplier: p.multiplier || brand?.defaultMultiplier || '',
        'Suggested Price': p.suggestedPrice,
        'Our Price (THB)': p.effectivePrice,
        'Margin (THB)': p.marginThb,
        'Margin (%)': p.marginPct,
        'Platform Markup %': p.platformMarkupPct || '',
        'Platform Suggested (THB)': p.platformSuggested || '',
        'Platform Price (THB)': p.platformPriceThb || '',
      }
      for (const ch of channels) {
        const price = priceForChannel(ch, p)
        const cp = calculateChannelProfit(price, p.totalImportCost, ch)
        base[`${ch.name} Selling`] = cp.sellingPrice
        base[`${ch.name} Profit`] = cp.ourProfitThb
        base[`${ch.name} Profit%`] = cp.ourProfitPct
      }
      base.Notes = p.notes
      return base
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'SRP')
    XLSX.writeFile(wb, `${brand?.name ?? 'srp'}-export.xlsx`)
  }

  // ใบราคา (มีรูป) — exceljs แบบระบบเดิม
  const exportPriceList = async () => {
    if (!brand) return
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const { saveAs } = await import('file-saver')
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('ใบราคา')
      ws.columns = [
        { header: '#', width: 6 },
        { header: 'รูป', width: 12 },
        { header: 'ชื่อสินค้า', width: 50 },
        { header: 'SKU', width: 18 },
        { header: 'Our Price (฿)', width: 16 },
        { header: 'Platform Price (฿)', width: 18 },
      ]
      ws.getRow(1).font = { name: 'Tahoma', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      const list = calculated.filter((p) => p.isActive)
      await Promise.all(
        list.map(async (p, i) => {
          const row = ws.addRow([i + 1, '', p.name, p.sku, p.effectivePrice, p.platformPriceThb || ''])
          row.height = 70
          row.font = { name: 'Tahoma', size: 14 }
          if (i % 2 === 1)
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
          if (p.imageUrl) {
            try {
              const buf = await (await fetch(p.imageUrl)).arrayBuffer()
              const img = wb.addImage({ buffer: buf, extension: 'jpeg' })
              ws.addImage(img, {
                tl: { col: 1.05, row: row.number - 1 + 0.05 },
                ext: { width: 70, height: 70 },
              })
            } catch {
              /* รูปโหลดไม่ได้ — ข้าม */
            }
          }
        })
      )
      const out = await wb.xlsx.writeBuffer()
      saveAs(new Blob([out]), `${brand.name}-ใบราคา.xlsx`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'export ไม่สำเร็จ', 'error')
    } finally {
      setExporting(false)
    }
  }

  if (!userData || !brand || products === null) return <TechLoader />
  if (!canSee) return null

  const th = 'relative overflow-hidden whitespace-nowrap border-r border-b border-gray-200 bg-gray-50 px-2 py-2 text-left text-xs font-semibold text-gray-500'
  const td = 'overflow-hidden border-r border-b border-gray-100 px-2 py-1.5 align-middle'
  // ช่องที่แก้ได้ = พื้นเหลืองอ่อนสีเดียวกันหมด (เจ้าของขอ 14 ส.ค.) — viewer ไม่ต้องย้อม
  const edit = canEdit ? 'bg-amber-50' : ''
  // ช่อง "ราคาที่ใช้จริง" — ราคาขายจริง (ปกติ/ห้าง) และ Platform ขายจริง (marketplace)
  // สองช่องนี้คือตัวเลขที่ใช้ตัดสินใจและเป็นฐานคิดกำไรของช่องทางนั้น ๆ
  // เจ้าของขอ 28 ส.ค. 69 ให้เด่นแยกจากช่องแก้ได้อื่น → พื้นเขียว + เส้นซ้ายเน้น
  const editPrice = 'bg-emerald-50'
  // เส้นคั่น "ชุดราคา" — ชุดปกติ (× → แนะนำ → ขายจริง → margin) กับชุด platform
  // อ่านเป็นก้อนเดียวได้ว่าราคานี้ตั้งมายังไง (เจ้าของขอ 29 ส.ค. 69)
  const groupL = 'border-l-2 border-l-slate-300'
  const groupR = 'border-r-2 border-r-slate-300'

  /** ขอบลากปรับความกว้าง — วางท้ายหัวคอลัมน์ (ลาก = ปรับ · ดับเบิลคลิก = คืนค่าเดิม) */
  const rz = (...keys: string[]) => (
    <span
      onMouseDown={(e) => startResize(keys, e)}
      onDoubleClick={() => resetCols(keys)}
      title="ลากเพื่อปรับความกว้าง · ดับเบิลคลิกเพื่อคืนค่าเดิม"
      className="absolute top-0 right-0 z-20 h-full w-1.5 cursor-col-resize select-none hover:bg-amber-400/70 active:bg-amber-500"
    />
  )

  // ลำดับคอลัมน์ต้องตรงกับ <colgroup> และ <td> ในแถวสินค้าเป๊ะ ๆ
  const colKeys = [
    'product', 'sku', 'category', 'fobUsd', 'fobEur', 'fobThb', 'freightDo', 'importTaxPct',
    'shippingCost', 'totalCost', 'srpUsd', 'srpEur', 'srpSgd', 'srpThb',
    'multiplier', 'suggested', 'ourPrice', 'margin',
    // 3 คอลัมน์ Platform โผล่เฉพาะแท็บ Marketplace — ต้องตัดออกจากที่นี่ด้วย
    // ไม่งั้น <colgroup> จะเกิน ทำให้ความกว้างทุกคอลัมน์เลื่อนผิดตำแหน่ง
    ...(isMarketplace ? ['platformPct', 'platformSuggested', 'platform', 'platformMargin'] : []),
    ...shownChannels.flatMap((ch) => [
      `ch-${ch.id}-a`,
      ...(showPartnerCols ? [`ch-${ch.id}-p1`, `ch-${ch.id}-p2`] : []),
      `ch-${ch.id}-b`,
      `ch-${ch.id}-c`,
    ]),
    'actions',
  ]
  const tableWidth = colKeys.reduce((sum, k) => sum + widthOf(k), 0)
  tableWidthRef.current = tableWidth

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Calculator}
        title={brand.name}
        description={`${calculated.length} สินค้า · USD ${brand.usdToThb} · EUR ${brand.eurToThb} · ตัวคูณ ×${brand.defaultMultiplier}`}
        backHref="/srp"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowChannels(true)}>
              <Settings2 size={15} className="mr-1" /> ช่องทางขาย
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOf({ productId: null, name: '' })}
            >
              <History size={15} className="mr-1" /> ประวัติการแก้ไข
            </Button>
            {canEdit && (
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/srp/${brandId}/upload`)}>
                <Upload size={15} className="mr-1" /> อัพโหลด Excel
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={exportPriceList} disabled={exporting}>
              <FileSpreadsheet size={15} className="mr-1" /> {exporting ? 'กำลังทำ…' : 'ใบราคา'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={exportFull}>
              <Download size={15} className="mr-1" /> Export
            </Button>
          </div>
        }
      />

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="ค้นหาชื่อสินค้า / SKU"
        actions={
          canEdit ? (
            // เครื่องมือที่ยิงทั้งแบรนด์ — วางขวาสุด แยกจากตัวกรองซ้ายมือ
            <div className="w-52">
              <SelectMenu
                size="md"
                value={null}
                placeholder="เครื่องมือทั้งแบรนด์…"
                options={[
                  ...[2, 2.5, 3, 3.5, 4, 4.5, 5].map((m) => ({
                    value: String(m),
                    label: `ตั้งตัวคูณ ×${m} ทุกตัว`,
                  })),
                  { value: 'suggest', label: 'ใช้ราคาแนะนำทุกตัว' },
                  // % platform ย้ายไปเป็นช่องรายสินค้าแล้ว (28 ส.ค. 69) แต่ตอน
                  // import ของใหม่ทีละร้อยตัวคงไม่มีใครกรอกทีละแถว — เก็บทาง
                  // ตั้งทีเดียวทั้งแบรนด์ไว้ตรงนี้
                  ...[5, 10, 15, 20, 25, 30].map((pct) => ({
                    value: `plat:${pct}`,
                    label: `ตั้ง Platform +${pct}% ทุกตัว`,
                  })),
                ]}
                onChange={(v) => {
                  if (v === 'suggest') applyAllSuggested()
                  else if (v?.startsWith('plat:')) applyPlatformMarkup(parseFloat(v.slice(5)))
                  else if (v) applyGlobalMultiplier(parseFloat(v))
                }}
              />
            </div>
          ) : undefined
        }
      >
        {/* ลำดับตามที่เจ้าของสั่ง 29 ส.ค. 69 — ค้นหา / หมวด / ช่องทาง / ขายอยู่ /
            ร้านได้ / เครื่องมือ (ตัวกรองที่แคบของลงเรื่อย ๆ แล้วจบด้วยเครื่องมือ) */}
        <FilterSelect
          label="หมวด"
          value={category}
          options={categories.map((c) => ({ value: c, label: c }))}
          onChange={setCategory}
        />
        <Segmented
          value={channelTab}
          onChange={(v) => setChannelTab(v as typeof channelTab)}
          options={CHANNEL_TYPES.map((t) => ({ value: t, label: CHANNEL_TYPE_LABEL[t] }))}
        />
        <Segmented
          value={statusTab}
          onChange={(v) => setStatusTab(v as typeof statusTab)}
          options={[
            { value: 'active', label: `ขายอยู่ (${activeCount})` },
            { value: 'inactive', label: `เลิกขายแล้ว (${calculated.length - activeCount})` },
            { value: 'all', label: 'ทั้งหมด' },
          ]}
        />
        {/* ซ่อนคอลัมน์ "ร้านได้" เมื่อตารางแน่นเกินไป — marketplace ไม่มีให้ซ่อนอยู่แล้ว */}
        {!isMarketplace && (
          <button
            type="button"
            onClick={() => setShowPartner((v) => !v)}
            title={showPartner ? 'ซ่อนคอลัมน์ร้านได้฿/ร้านได้%' : 'แสดงคอลัมน์ร้านได้฿/ร้านได้%'}
            className={`hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium lg:inline-flex ${
              showPartner
                ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                : 'border-gray-200 bg-gray-100 text-gray-400 hover:bg-gray-50'
            }`}
          >
            {showPartner ? <Eye size={14} /> : <EyeOff size={14} />}
            คอลัมน์ร้านได้
          </button>
        )}
      </FilterBar>

      {/* คำอธิบายพวกนี้พูดถึงตาราง ซึ่งจอแคบไม่เห็น — ซ่อนไปด้วยกัน */}
      {canEdit ? (
        <p className="-mt-1 hidden items-center gap-1.5 text-xs text-gray-500 lg:flex">
          <span className="inline-block h-3 w-5 rounded-sm border border-amber-200 bg-amber-50" />
          ช่องพื้นเหลือง = พิมพ์แก้ได้ <b className="font-semibold text-gray-700">แล้วกด Enter เพื่อบันทึก</b> (Esc หรือคลิกออก = ยกเลิก) · ช่องพื้นขาว = ระบบคำนวณให้ · ลากขอบหัวตารางเพื่อปรับความกว้าง
        </p>
      ) : (
        <p className="-mt-1 hidden text-xs text-gray-500 lg:block">คุณมีสิทธิ์ดูอย่างเดียว — แก้ไขไม่ได้ · ลากขอบหัวตารางปรับความกว้างคอลัมน์ได้</p>
      )}

      {/* ติ๊กแล้วเปลี่ยนหมวดทีเดียวหมด — เร็วกว่าไล่ทีละแถวตอนจัดของเข้าหมวด
          (เจ้าของสั่ง 28 ส.ค. 69 หลังเจอว่า YOYO ถูกแยกเป็น Stroller กับ YOYO®) */}
      {canEdit && marked.size > 0 && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
          <span className="font-medium text-sky-900">เลือกไว้ {marked.size} รายการ</span>
          <div className="w-52">
            <SelectMenu
              size="sm"
              value={null}
              options={categoryOptions}
              placeholder="เปลี่ยนหมวดเป็น…"
              onChange={(v) => v && applyCategoryToMarked(v)}
              onCreate={(name) => applyCategoryToMarked(name)}
            />
          </div>
          <button
            type="button"
            className="ml-auto text-gray-500 hover:text-gray-700 hover:underline"
            onClick={() => setMarked(new Set())}
          >
            ล้างการเลือก
          </button>
        </div>
      )}

      {/* ตารางหลัก — เลื่อนแนวนอน คอลัมน์สินค้าตรึงซ้าย
          จอแคบไม่เอาตาราง: 20 คอลัมน์บนมือถือ เลื่อนไปทางขวาแล้วไม่เหลือบริบทว่า
          กำลังดูสินค้าตัวไหน (เจ้าของทัก 22 ส.ค.) — จอแคบใช้การ์ดแทนข้างล่าง
          สลับด้วย isDesktop ไม่ใช่ CSS: ซ่อนด้วย CSS เท่ากับวาดทั้งสองชุดทิ้ง */}
      {isDesktop && (
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table
          ref={tableRef}
          className="border-collapse text-[15px]"
          style={{ tableLayout: 'fixed', width: tableWidth }}
        >
          <colgroup>
            {colKeys.map((k) => (
              <col key={k} data-k={k} style={{ width: widthOf(k) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={`${th} sticky left-0 z-10 ${edit}`}>
                <span className="flex items-center gap-2">
                  {canEdit && (
                    <input
                      type="checkbox"
                      checked={allVisibleMarked}
                      onChange={toggleMarkAll}
                      className="h-4 w-4 shrink-0 cursor-pointer accent-sky-600"
                      title={allVisibleMarked ? 'ล้างการเลือกทั้งหน้า' : 'เลือกทั้งหน้า'}
                    />
                  )}
                  สินค้า ({visible.length})
                </span>
                {rz('product')}
              </th>
              <th className={`${th} ${edit}`}>SKU{rz('sku')}</th>
              <th className={`${th} ${edit}`}>หมวด{rz('category')}</th>
              <th className={`${th} text-right ${edit}`}>FOB ${rz('fobUsd')}</th>
              <th className={`${th} text-right ${edit}`}>FOB €{rz('fobEur')}</th>
              <th className={`${th} text-right`}>FOB ฿{rz('fobThb')}</th>
              <th className={`${th} text-right ${edit}`}>ค่าเรือ/D.O.{rz('freightDo')}</th>
              <th className={`${th} text-right ${edit}`}>ภาษี %{rz('importTaxPct')}</th>
              <th className={`${th} text-right ${edit}`}>ส่งในไทย{rz('shippingCost')}</th>
              <th className={`${th} text-right`}>ต้นทุนรวม{rz('totalCost')}</th>
              {/* "SRP ฿" เฉย ๆ ทำให้เข้าใจว่าเป็นผลของตัวคูณ เพราะวางอยู่ติดกับ ×
                  พอดี — จริง ๆ คือราคาป้ายของแบรนด์ที่นำเข้ามาจาก price list
                  ไม่ได้คิดจากต้นทุนเลย (เจ้าของเข้าใจผิด 28 ส.ค. 69) */}
              {/* ราคาแนะนำจากแบรนด์ — แบรนด์ให้มาสกุลไหนก็กรอกช่องนั้น บางเจ้าไม่ให้เลย
                  (เจ้าของอธิบาย 28 ส.ค. 69) · โครงเดียวกับ FOB: กรอกสกุล → ได้บาท */}
              <th className={`${th} text-right ${edit}`} title="ราคาแนะนำจากแบรนด์ (USD) — อ้างอิงเฉย ๆ ไม่เข้าสูตรต้นทุน">
                SRP ${rz('srpUsd')}
              </th>
              <th className={`${th} text-right ${edit}`} title="ราคาแนะนำจากแบรนด์ (EUR) — อ้างอิงเฉย ๆ ไม่เข้าสูตรต้นทุน">
                SRP €{rz('srpEur')}
              </th>
              <th className={`${th} text-right ${edit}`} title="ราคาแนะนำจากแบรนด์ (SGD) — อ้างอิงเฉย ๆ ไม่เข้าสูตรต้นทุน">
                SRP S${rz('srpSgd')}
              </th>
              <th
                className={`${th} text-right`}
                title="ราคาแนะนำจากแบรนด์ แปลงเป็นบาทตามเรตของแบรนด์ — ไม่ได้คิดจากต้นทุน ตัวคูณไม่มีผลกับช่องนี้"
              >
                SRP ฿{rz('srpThb')}
              </th>
              {/* ── ชุดราคาปกติ: × → แนะนำ → ขายจริง → margin ── */}
              <th
                className={`${th} text-right ${edit} ${groupL}`}
                title="ตัวคูณจากต้นทุนรวม → ได้ราคาแนะนำ · ไม่ใส่ = ใช้ค่าเริ่มต้นของแบรนด์"
              >
                ×{rz('multiplier')}
              </th>
              <th
                className={`${th} text-right`}
                title="ต้นทุนรวม × ตัวคูณ แล้วปัดเป็นเลขสวย (ลงท้าย 9 / 90 / 900)"
              >
                ราคาแนะนำ{rz('suggested')}
              </th>
              <th
                className={`${th} text-right ${editPrice} !text-emerald-800`}
                title="ราคาที่ฟันธงขายจริง (street price) — ไม่กรอก = ใช้ราคาแนะนำ · Margin คิดจากช่องนี้"
              >
                ราคาขายจริง{rz('ourPrice')}
              </th>
              <th className={`${th} text-right ${groupR}`}>Margin{rz('margin')}</th>
              {/* บล็อก Platform ทำโครงเดียวกับราคาปกติ (× → แนะนำ → ขายจริง)
                  เจ้าของสั่ง 28 ส.ค. 69 — เดิม % เป็นค่าเดียวทั้งแบรนด์ กดทีเดียว
                  ทับราคาทุกตัว รายสินค้าปรับเองไม่ได้ · ตอนนี้ % อยู่รายสินค้า
                  ว่าง = ใช้ค่าเริ่มต้นของแบรนด์ (ยังกดปุ่มทับทั้งแบรนด์ได้เหมือนเดิม)
                  ⚠ โชว์เฉพาะแท็บ Marketplace (เจ้าของสั่ง 28 ส.ค. 69) — ช่องทางปกติ
                  กับห้างคิดกำไรจากราคาขายจริง ไม่ได้ใช้ราคา platform เลย */}
              {isMarketplace && (
                <>
                  <th
                    className={`${th} text-right ${edit} ${groupL}`}
                    title={`% บวกจากราคาขายจริง → ราคาแนะนำบน marketplace · ว่าง = ใช้ของแบรนด์ (+${brand.platformMarkupPct}%)`}
                  >
                    Platform %{rz('platformPct')}
                  </th>
                  <th className={`${th} text-right`} title="ราคาขายจริง + % → ปัดเลขสวย">
                    Platform แนะนำ{rz('platformSuggested')}
                  </th>
                  <th
                    className={`${th} text-right ${editPrice} !text-emerald-800`}
                    title="ราคาที่ขายจริงบน marketplace — ไม่กรอก = ใช้ราคาแนะนำ · กำไรช่อง Marketplace คิดจากช่องนี้"
                  >
                    Platform ขายจริง{rz('platform')}
                  </th>
                  <th
                    className={`${th} text-right ${groupR}`}
                    title="margin ของราคาบน marketplace (ยังไม่หักค่าธรรมเนียมแพลตฟอร์ม) — เทียบกับ Margin ปกติได้ว่าบวก % แล้วกำไรขั้นต้นต่างกันแค่ไหน"
                  >
                    Platform Margin{rz('platformMargin')}
                  </th>
                </>
              )}
              {shownChannels.map((ch) => (
                <th
                  key={ch.id}
                  colSpan={showPartnerCols ? 5 : 3}
                  className={`${th} border-l-2 border-l-gray-200 text-center`}
                >
                  {/* กดชื่อช่องทาง = ตั้งค่า GP/โปรของช่องทางนั้นได้ทันที
                      (ตัวลากปรับความกว้างอยู่ที่ขอบขวาของ th ไม่ทับกับปุ่มนี้) */}
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setEditingChannelId(ch.id)}
                    title={canEdit ? 'ตั้งค่า GP / โปรโมชั่นของช่องทางนี้' : undefined}
                    className="mx-auto block max-w-full rounded px-1 py-0.5 enabled:hover:bg-white enabled:hover:text-sky-700 disabled:cursor-default"
                  >
                    {ch.name}{' '}
                    <span className="font-normal text-gray-400">
                      (หัก{' '}
                      {ch.type === 'marketplace'
                        ? `${ch.commissionPct + ch.transactionFeePct + ch.serviceFeePct}% +ส่ง ${ch.shippingThb}฿`
                        : ch.type === 'retail'
                          ? `GP ${ch.gpPct}%`
                          : `${ch.gpPct + ch.pcPct + ch.dcPct}%`}
                      {ch.promoPct ? ` · โปร -${ch.promoPct}%` : ''})
                    </span>
                  </button>
                  <div className="mt-0.5 flex justify-around text-[10px] font-normal text-gray-400">
                    <span>ราคาขาย</span>
                    {showPartnerCols && (
                      <>
                        <span>ร้านได้฿</span>
                        <span>ร้านได้%</span>
                      </>
                    )}
                    <span>เราได้฿</span>
                    <span>เราได้%</span>
                  </div>
                  {rz(
                    `ch-${ch.id}-a`,
                    ...(showPartnerCols ? [`ch-${ch.id}-p1`, `ch-${ch.id}-p2`] : []),
                    `ch-${ch.id}-b`,
                    `ch-${ch.id}-c`
                  )}
                </th>
              ))}
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <SrpRow
                key={p.id}
                p={p}
                td={td}
                edit={edit}
                editPrice={editPrice}
                groupL={groupL}
                groupR={groupR}
                canEdit={canEdit}
                isMarked={marked.has(p.id)}
                isToggling={togglingId === p.id}
                isMarketplace={isMarketplace}
                showPartnerCols={showPartnerCols}
                channels={shownChannels}
                categoryOptions={categoryOptions}
                defaultMultiplier={brand.defaultMultiplier}
                defaultPlatformPct={brand.platformMarkupPct}
                patch={patchProduct}
                onMark={toggleMark}
                onToggleActive={toggleActive}
                onLightbox={setLightbox}
                onCategoryFocus={setEditingCategoryId}
                onDelete={deleteProduct}
                onHistory={openHistory}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={20} className="p-6 text-center text-sm text-gray-400">
                  ไม่มีสินค้าตรงตามตัวกรอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* ── จอแคบ: การ์ดต่อสินค้า เอาเฉพาะตัวเลขที่ใช้ตัดสินใจ ──────────
          (วาดเฉพาะตอนจอแคบจริง ๆ — จอกว้างไม่ต้องเสียแรงวาดทิ้ง)
          ตัดคอลัมน์ต้นทาง (FOB/ค่าเรือ/ภาษี/ส่งในไทย) ออก เพราะบนมือถือ
          คนดูเพื่อ "เช็คราคากับกำไร" ไม่ได้มานั่งกรอกต้นทุน — ถ้าต้องแก้
          ต้นทุนจริง ๆ เปิดบนคอมซึ่งมีตารางเต็ม */}
      {!isDesktop && (
      <div className="space-y-3">
        {visible.map((p) => (
          <SrpCard
            key={p.id}
            p={p}
            canEdit={canEdit}
            isToggling={togglingId === p.id}
            channels={shownChannels}
            patch={patchProduct}
            onToggleActive={toggleActive}
            onLightbox={setLightbox}
            onDelete={deleteProduct}
            onHistory={openHistory}
          />
        ))}

        {visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            ไม่มีสินค้าตรงตามตัวกรอง
          </p>
        )}
      </div>
      )}

      {/* Lightbox รูปสินค้า */}
      {lightbox && (
        <Modal open onClose={() => setLightbox(null)} title={lightbox.name} maxWidth={520}>
          <div className="space-y-3 text-center">
            {lightbox.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.imageUrl} alt="" className="mx-auto max-h-[55vh] rounded-lg object-contain" />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
                ยังไม่มีรูป
              </div>
            )}
            {canEdit && (
            <div className="flex justify-center gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-sm hover:bg-gray-50">
                  {lightbox.imageUrl ? 'เปลี่ยนรูป' : 'อัพโหลดรูป'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadProductImage(lightbox, f)
                  }}
                />
              </label>
              {lightbox.imageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!confirm('ลบรูปนี้?')) return
                    patchProduct(lightbox.id, { image_url: '' }, { imageUrl: '' })
                    setLightbox(null)
                  }}
                >
                  <X size={14} className="mr-1" /> ลบรูป
                </Button>
              )}
            </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal ตั้งค่าช่องทางขาย */}
      {showChannels && (
        <ChannelSettingsModal
          channels={channels}
          canEdit={canEdit}
          onClose={() => setShowChannels(false)}
          onPatch={patchChannel}
          onDelete={removeChannel}
          onReorder={reorderChannels}
          onAdd={addChannel}
          onAddGpSet={addRetailGpSet}
        />
      )}

      {historyOf && (
        <SrpHistoryModal
          brandId={brandId}
          productId={historyOf.productId}
          productName={historyOf.name}
          canEdit={canEdit}
          onClose={() => setHistoryOf(null)}
          onRevert={revertHistory}
        />
      )}

      {/* ตั้งค่าช่องทางเดียวจากการกดหัวคอลัมน์ — ใช้ช่องกรอกชุดเดียวกับหน้าต่างรวม
          กด Enter ในช่องไหนถึงจะบันทึกช่องนั้น ตารางคำนวณใหม่ให้ทันที */}
      {editingChannel && (
        <Modal
          open
          onClose={() => setEditingChannelId(null)}
          title={`ตั้งค่า: ${editingChannel.name}`}
          description={
            editingChannel.type === 'marketplace'
              ? 'หัก commission / ค่าธรรมเนียม / ค่าส่ง — คิดจากราคาบนแพลตฟอร์ม'
              : editingChannel.type === 'retail'
                ? 'หัก GP — คิดจากราคาขายจริง'
                : 'หัก GP / PC / DC — คิดจากราคาขายจริง'
          }
          maxWidth={560}
        >
          <div className="space-y-3">
            <ChannelEditor
              channel={editingChannel}
              onChange={(patch) => {
                const next = { ...editingChannel, ...patch }
                setChannels((prev) => prev.map((c) => (c.id === next.id ? next : c)))
                saveSrpChannel(next).catch((e) => showToast(e.message, 'error'))
              }}
            />
            <p className="text-[11px] text-gray-400">
              พิมพ์แล้วกด Enter หรือกดปุ่ม &ldquo;บันทึก&rdquo; · Esc = ยกเลิกช่องที่กำลังพิมพ์
            </p>
            <div className="flex justify-between gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                onClick={async () => {
                  if (!confirm(`ลบช่องทาง "${editingChannel.name}" ออกจากตาราง?`)) return
                  try {
                    await deleteSrpChannel(editingChannel.id)
                    setChannels((prev) => prev.filter((c) => c.id !== editingChannel.id))
                    setEditingChannelId(null)
                    showToast('ลบช่องทางแล้ว', 'success')
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : 'ลบไม่สำเร็จ', 'error')
                  }
                }}
              >
                ลบช่องทางนี้
              </button>
              <Button type="button" size="sm" onClick={() => setEditingChannelId(null)}>
                บันทึก
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/**
 * ตัวเลขกำไรต่อ 1 ช่องทาง
 *   marketplace 3 ช่อง: ราคาขาย · เราได้฿ · เราได้%
 *   ร้านค้า/ห้าง 5 ช่อง: + "ร้านได้฿" กับ "ร้านได้%" (เจ้าของขอ 28 ส.ค. 69
 *   เพื่อดูว่าหักให้เขา xx% แล้วสองฝ่ายได้เท่าไหร่ ใช้คุยกับร้านได้เลย)
 */
function SrpChannelCells({
  cp,
  hasPrice,
  td,
  showPartner,
}: {
  cp: ReturnType<typeof calculateChannelProfit>
  hasPrice: boolean
  td: string
  showPartner: boolean
}) {
  if (!hasPrice)
    return (
      <>
        <td className={`${td} border-l-2 border-l-gray-100 text-right text-gray-300`}>—</td>
        {showPartner && (
          <>
            <td className={`${td} text-right text-gray-300`}>—</td>
            <td className={`${td} text-right text-gray-300`}>—</td>
          </>
        )}
        <td className={`${td} text-right text-gray-300`}>—</td>
        <td className={`${td} text-right text-gray-300`}>—</td>
      </>
    )
  return (
    <>
      <td className={`${td} border-l-2 border-l-gray-100 text-right tabular-nums text-gray-600`}>
        {fmt(cp.sellingPrice)}
      </td>
      {showPartner && (
        <>
          <td className={`${td} text-right tabular-nums text-gray-500`}>{fmt(cp.partnerProfitThb)}</td>
          <td className={`${td} text-right`}>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-gray-600">
              {cp.partnerMarkupPct}%
            </span>
          </td>
        </>
      )}
      <td className={`${td} text-right tabular-nums`}>{fmt(cp.ourProfitThb)}</td>
      <td className={`${td} text-right`}>
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${profitClass(cp.ourProfitPct)}`}>
          {cp.ourProfitPct}%
        </span>
      </td>
    </>
  )
}

/* ── หน้าต่างตั้งค่าช่องทางขาย ─────────────────────────────────────────
 *
 * เจ้าของทัก 29 ส.ค. 69: การ์ดใบใหญ่ใบละช่องทาง ป้ายกำกับซ้ำทุกใบ 7 ช่องทาง
 * ก็เต็มจอแล้ว · รื้อเป็นตารางแถวเตี้ย ป้ายบอกหัวคอลัมน์ครั้งเดียวต่อกลุ่ม
 * แล้วลากสลับลำดับได้ (ลำดับนี้คือลำดับคอลัมน์ในตารางใหญ่)
 * ────────────────────────────────────────────────────────────────── */

/** ช่องตัวเลขทรงกล่องขนาดเล็ก — กติกาเดียวกับในตาราง: Enter ถึงจะบันทึก */
function BoxNum({
  value,
  onSave,
  disabled,
}: {
  value: number
  onSave: (v: number) => void
  disabled?: boolean
}) {
  const { props, dirty } = useEnterToSave(
    String(value ?? 0),
    String(value ?? 0),
    (raw) => {
      const v = parseFloat(raw.replace(/,/g, '')) || 0
      if (v !== value) onSave(v)
    },
    true
  )
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      title={disabled ? undefined : HINT}
      className={`h-8 w-full rounded-md border px-1.5 text-right text-sm tabular-nums focus:outline-none disabled:bg-gray-50 disabled:text-gray-400 ${
        dirty ? DIRTY_RING : 'border-gray-200 bg-white focus:border-amber-300'
      }`}
    />
  )
}

/** ช่องข้อความทรงกล่องขนาดเล็ก */
function BoxText({
  value,
  onSave,
  disabled,
}: {
  value: string
  onSave: (v: string) => void
  disabled?: boolean
}) {
  const { props, dirty } = useEnterToSave(
    value,
    value,
    (raw) => {
      const v = raw.trim()
      if (v && v !== value) onSave(v)
    },
    true
  )
  return (
    <input
      {...props}
      disabled={disabled}
      title={disabled ? undefined : HINT}
      className={`h-8 w-full rounded-md border px-2 text-sm focus:outline-none disabled:bg-gray-50 disabled:text-gray-500 ${
        dirty ? DIRTY_RING : 'border-gray-200 bg-white focus:border-amber-300'
      }`}
    />
  )
}

function ChannelSettingsModal({
  channels,
  canEdit,
  onClose,
  onPatch,
  onDelete,
  onReorder,
  onAdd,
  onAddGpSet,
}: {
  channels: SrpChannel[]
  canEdit: boolean
  onClose: () => void
  onPatch: (ch: SrpChannel, patch: Partial<SrpChannel>) => void
  onDelete: (ch: SrpChannel) => void
  onReorder: (type: ChannelType, ids: string[]) => void
  onAdd: (type: ChannelType) => void
  onAddGpSet: () => void
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title="ช่องทางขาย"
      description="ช่องทางปกติ หัก GP · ห้าง หัก GP/PC/DC — ทั้งคู่คิดจากราคาขายจริง · Marketplace หัก commission/ค่าธรรมเนียม/ค่าส่ง คิดจากราคาบนแพลตฟอร์ม · ลำดับที่เรียงไว้ = ลำดับคอลัมน์ในตาราง"
      maxWidth={720}
    >
      <div className="space-y-5">
        {CHANNEL_TYPES.map((type) => (
          <ChannelGroup
            key={type}
            type={type}
            list={channels.filter((c) => c.type === type)}
            canEdit={canEdit}
            onPatch={onPatch}
            onDelete={onDelete}
            onReorder={onReorder}
            onAdd={onAdd}
            onAddGpSet={onAddGpSet}
          />
        ))}

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <p className="text-[11px] text-gray-400">
            พิมพ์แล้วกด Enter หรือกดปุ่ม &ldquo;บันทึก&rdquo; · ลากจุดซ้ายมือเพื่อสลับลำดับคอลัมน์
          </p>
          <Button type="button" size="sm" onClick={onClose}>
            บันทึก
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * ช่องทางขาย 1 กลุ่ม + การลากสลับลำดับ (sortable list)
 *
 * ตอนลาก แถวอื่นเลื่อนหลบเปิดช่องว่างไว้รอ (drop placeholder) แบบ dnd-kit
 * ทำด้วย CSS transform ล้วน ๆ ไม่ต้องลงไลบรารี และไม่สลับ DOM ระหว่างลาก:
 *   · แถวที่ถูกคั่นกลาง เลื่อนขึ้น/ลง 1 ช่องด้วย translateY + transition
 *   · แถวที่กำลังลาก เลื่อนไปนั่งตำแหน่งปลายทาง (จาง+เส้นประ) = เห็นว่าจะลงตรงไหน
 *   · สลับลำดับจริงตอนปล่อยเท่านั้น — ปล่อยแล้ว transform กลับเป็น 0 พร้อมกับที่
 *     ลำดับจริงเปลี่ยน จึงไม่มีอาการกระตุกซ้ำ
 *
 * ⚠ ตำแหน่งเป้าหมายคิดจาก "ตำแหน่งเมาส์เทียบกับกล่อง" ไม่ใช่ onDragOver ของแต่ละแถว
 * เพราะแถวขยับหนีตลอดเวลา ถ้าไปฟังที่แถวจะสลับไปมาไม่หยุด (สั่น)
 */
function ChannelGroup({
  type,
  list,
  canEdit,
  onPatch,
  onDelete,
  onReorder,
  onAdd,
  onAddGpSet,
}: {
  type: ChannelType
  list: SrpChannel[]
  canEdit: boolean
  onPatch: (ch: SrpChannel, patch: Partial<SrpChannel>) => void
  onDelete: (ch: SrpChannel) => void
  onReorder: (type: ChannelType, ids: string[]) => void
  onAdd: (type: ChannelType) => void
  onAddGpSet: () => void
}) {
  const fields = CHANNEL_FIELDS[type]
  const grid = `16px minmax(0,1fr) repeat(${fields.length}, 66px) 24px`

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  /** ระยะห่างจากหัวแถวหนึ่งไปหัวแถวถัดไป (สูงแถว + ช่องไฟ) — วัดของจริงตอนเริ่มลาก */
  const slot = useRef(0)
  /**
   * เงาของ dragIdx/overIdx ที่อัปเดตทันที ไม่ต้องรอ React วาดรอบใหม่
   * เบราว์เซอร์ยิง drop แล้วยิง dragend ตามมาเป็นคนละจังหวะ ถ้าอ่านจาก state
   * ทั้งสองตัวอาจเห็นค่าเดิมแล้วสลับลำดับซ้ำสองรอบ
   */
  const live = useRef<{ from: number; to: number } | null>(null)

  const pickUp = (i: number) => {
    const el = boxRef.current
    if (el && el.children.length > 1) {
      const a = el.children[0] as HTMLElement
      const b = el.children[1] as HTMLElement
      slot.current = b.offsetTop - a.offsetTop
    }
    live.current = { from: i, to: i }
    setDragIdx(i)
    setOverIdx(i)
  }

  /** แถว i ต้องเลื่อนกี่ px ระหว่างที่กำลังลากอยู่ */
  const shiftOf = (i: number) => {
    if (dragIdx === null || overIdx === null || !slot.current) return 0
    if (i === dragIdx) return (overIdx - dragIdx) * slot.current
    if (dragIdx < overIdx && i > dragIdx && i <= overIdx) return -slot.current
    if (dragIdx > overIdx && i >= overIdx && i < dragIdx) return slot.current
    return 0
  }

  const finish = () => {
    const at = live.current
    live.current = null // เคลียร์ก่อนทำอย่างอื่น — dragend ที่ตามมาจะได้ไม่ทำซ้ำ
    if (at && at.from !== at.to) {
      const ids = list.map((c) => c.id)
      ids.splice(at.to, 0, ids.splice(at.from, 1)[0])
      onReorder(type, ids)
    }
    setDragIdx(null)
    setOverIdx(null)
  }

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-600">
          {CHANNEL_TYPE_LABEL[type]} <span className="font-normal text-gray-400">({list.length})</span>
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => onAdd(type)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50"
          >
            <Plus size={13} /> เพิ่มช่องทาง
          </button>
        )}
      </div>

      {list.length > 0 ? (
        <>
          {/* ป้ายหัวคอลัมน์ครั้งเดียวต่อกลุ่ม — เดิมซ้ำอยู่ทุกการ์ด */}
          <div
            className="grid items-end gap-x-2 px-1 pb-1 text-[10px] text-gray-400"
            style={{ gridTemplateColumns: grid }}
          >
            <span />
            <span>ชื่อ</span>
            {fields.map(([k, label]) => (
              <span key={String(k)} className="text-right">
                {label}
              </span>
            ))}
            <span />
          </div>

          <div
            ref={boxRef}
            className="space-y-1"
            onDragOver={(e) => {
              if (dragIdx === null) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              const el = boxRef.current
              if (!el || !slot.current) return
              const y = e.clientY - el.getBoundingClientRect().top
              const i = Math.max(0, Math.min(list.length - 1, Math.floor(y / slot.current)))
              if (i !== overIdx) {
                if (live.current) live.current.to = i
                setOverIdx(i)
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              finish()
            }}
          >
            {list.map((ch, i) => (
              <ChannelRow
                key={ch.id}
                ch={ch}
                fields={fields}
                grid={grid}
                canEdit={canEdit}
                shift={shiftOf(i)}
                dragging={dragIdx === i}
                animate={dragIdx !== null}
                onPickUp={() => pickUp(i)}
                onDragEnd={finish}
                onPatch={onPatch}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400">
          ยังไม่มีช่องทางในกลุ่มนี้
        </p>
      )}

      {/* ชุด GP มาตรฐานที่เจ้าของใช้คุยกับร้านค้าเป็นประจำ (28 ส.ค. 69)
          กดทีเดียวได้ครบ 6 ระดับ ไม่ต้องกรอกทีละอัน */}
      {type === 'retail' && canEdit && (
        <button
          type="button"
          onClick={onAddGpSet}
          className="mt-1.5 w-full rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-400 hover:bg-gray-50"
        >
          + เพิ่มชุด GP มาตรฐาน (25 / 30 / 35 / 40 / 45 / 50%)
        </button>
      )}
    </section>
  )
}

/** 1 ช่องทาง = 1 แถวเตี้ย ๆ · จับที่จุดซ้ายสุดแล้วลากสลับลำดับได้ */
function ChannelRow({
  ch,
  fields,
  grid,
  canEdit,
  shift,
  dragging,
  animate,
  onPickUp,
  onDragEnd,
  onPatch,
  onDelete,
}: {
  ch: SrpChannel
  fields: [keyof SrpChannel, string][]
  grid: string
  canEdit: boolean
  shift: number
  dragging: boolean
  animate: boolean
  onPickUp: () => void
  onDragEnd: () => void
  onPatch: (ch: SrpChannel, patch: Partial<SrpChannel>) => void
  onDelete: (ch: SrpChannel) => void
}) {
  // draggable ต้องเป็น true อยู่ก่อนที่ dragstart จะยิง — ติดไว้ตอนกดที่จุดจับ
  // เท่านั้น ไม่งั้นลากเลือกข้อความในช่องชื่อไม่ได้
  const [armed, setArmed] = useState(false)
  return (
    <div
      draggable={canEdit && armed}
      onDragStart={(e) => {
        // Firefox ไม่ยอมเริ่มลากถ้าไม่ได้ใส่ข้อมูลลง dataTransfer
        e.dataTransfer.setData('text/plain', ch.id)
        e.dataTransfer.effectAllowed = 'move'
        onPickUp()
      }}
      onDragEnd={() => {
        setArmed(false)
        onDragEnd()
      }}
      className={`relative grid items-center gap-x-2 rounded-lg border px-1 py-1 ${
        dragging
          ? 'border-dashed border-sky-400 bg-sky-50 opacity-60 shadow-sm'
          : 'border-gray-100 bg-white'
      }`}
      style={{
        gridTemplateColumns: grid,
        transform: shift ? `translateY(${shift}px)` : undefined,
        transition: animate ? 'transform 180ms cubic-bezier(.2,.8,.3,1)' : undefined,
        zIndex: dragging ? 10 : undefined,
      }}
    >
      <span
        onMouseDown={() => setArmed(true)}
        onMouseUp={() => setArmed(false)}
        title={canEdit ? 'ลากเพื่อสลับลำดับคอลัมน์ในตาราง' : undefined}
        className={`flex justify-center text-gray-300 ${
          canEdit ? 'cursor-grab hover:text-gray-500 active:cursor-grabbing' : 'opacity-30'
        }`}
      >
        <GripVertical size={14} />
      </span>

      <BoxText value={ch.name} disabled={!canEdit} onSave={(v) => onPatch(ch, { name: v })} />

      {fields.map(([key]) => (
        <BoxNum
          key={String(key)}
          value={Number(ch[key] ?? 0)}
          disabled={!canEdit}
          onSave={(v) => onPatch(ch, { [key]: v } as Partial<SrpChannel>)}
        />
      ))}

      <button
        type="button"
        disabled={!canEdit}
        title="ลบช่องทางนี้"
        onClick={() => onDelete(ch)}
        className="flex justify-center text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-300"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

/** แถวแก้ไขช่องทางเดียว — ใช้ในหน้าต่างที่เปิดจากการกดหัวคอลัมน์ในตาราง */
function ChannelEditor({
  channel,
  onChange,
}: {
  channel: SrpChannel
  onChange: (patch: Partial<SrpChannel>) => void
}) {
  const fields = CHANNEL_FIELDS[channel.type]
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 p-2">
      <div className="min-w-28 flex-1">
        <span className="mb-0.5 block text-[10px] text-gray-400">ชื่อ</span>
        <BoxText value={channel.name} onSave={(v) => onChange({ name: v })} />
      </div>
      {fields.map(([key, label]) => (
        <label key={String(key)} className="block w-20">
          <span className="mb-0.5 block text-[10px] text-gray-400">{label}</span>
          <BoxNum
            value={Number(channel[key] ?? 0)}
            onSave={(v) => onChange({ [key]: v } as Partial<SrpChannel>)}
          />
        </label>
      ))}
    </div>
  )
}

/** prop ที่แถว/การ์ดใช้เขียนค่ากลับ — ตรงกับ patchProduct ในหน้าหลัก */
type PatchFn = (id: string, dbFields: Record<string, unknown>, local: Partial<SrpProduct>) => void

/**
 * สินค้า 1 แถวในตาราง — memo ไว้ทั้งแถว
 *
 * ตารางนี้กว้าง 50+ คอลัมน์ ยาว 100+ แถว (Stokke = 114 ตัว × 7 ช่องทาง ≈ 6,000 ช่อง)
 * ถ้าไม่ memo การแก้เลขช่องเดียว — หรือแค่ติ๊กถูกหน้าแถว — จะวาดใหม่ทั้งตาราง
 *
 * ⚠ จะได้ผลก็ต่อเมื่อ prop นิ่งจริง: callback ทุกตัวห่อ useCallback([]) ไว้
 * และแถวที่ไม่ได้แก้ต้องได้ CalculatedProduct "ตัวเดิม" กลับมา (ดู calcCache
 * ในหน้าหลัก) — ไม่งั้น memo ไม่ช่วยอะไรเลย
 */
const SrpRow = memo(function SrpRow({
  p,
  td,
  edit,
  editPrice,
  groupL,
  groupR,
  canEdit,
  isMarked,
  isToggling,
  isMarketplace,
  showPartnerCols,
  channels,
  categoryOptions,
  defaultMultiplier,
  defaultPlatformPct,
  patch,
  onMark,
  onToggleActive,
  onLightbox,
  onCategoryFocus,
  onDelete,
  onHistory,
}: {
  p: CalculatedProduct
  td: string
  edit: string
  editPrice: string
  groupL: string
  groupR: string
  canEdit: boolean
  isMarked: boolean
  isToggling: boolean
  isMarketplace: boolean
  showPartnerCols: boolean
  channels: SrpChannel[]
  categoryOptions: { value: string; label: string }[]
  defaultMultiplier: number
  defaultPlatformPct: number
  patch: PatchFn
  onMark: (id: string) => void
  onToggleActive: (id: string, current: boolean) => void
  onLightbox: (p: SrpProduct) => void
  onCategoryFocus: (id: string) => void
  onDelete: (p: SrpProduct) => void
  onHistory: (p: SrpProduct) => void
}) {
  return (
    <tr className={`${p.isActive ? '' : 'opacity-50'} ${isMarked ? '[&>td]:!bg-sky-100' : ''}`}>
      <td className={`${td} sticky left-0 z-10 ${canEdit ? 'bg-amber-50' : 'bg-white'}`}>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isMarked}
            onChange={() => onMark(p.id)}
            className="h-4 w-4 shrink-0 cursor-pointer accent-sky-600"
            title="ทำเครื่องหมายไว้ดูเฉย ๆ ว่าทำถึงไหนแล้ว"
          />
          <button
            type="button"
            onClick={() => onLightbox(p)}
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-100 bg-gray-50"
            title={p.imageUrl ? 'ดู/เปลี่ยนรูป' : 'เพิ่มรูป'}
          >
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={14} className="text-gray-300" />
            )}
          </button>
          <TextCell
            readOnly={!canEdit}
            value={p.name}
            onSave={(v) => patch(p.id, { name: v }, { name: v })}
          />
        </div>
      </td>
      <td className={td}>
        <TextCell readOnly={!canEdit} value={p.sku} onSave={(v) => patch(p.id, { sku: v }, { sku: v })} />
      </td>
      <td className={`${td} ${edit}`}>
        {/* หมวดเป็น dropdown ตัวกลาง — เดิมเป็นข้อความเฉย ๆ พิมพ์ทับไม่ได้เลย
            (เจ้าของแจ้ง 22 ส.ค. 69) แล้วเคยแก้เป็น input+datalist ซึ่งเป็น
            dropdown ของเบราว์เซอร์ หน้าตาไม่เข้ากับที่อื่นและกรองตามที่พิมพ์
            จนเห็นตัวเลือกเดียว (เจ้าของทัก 28 ส.ค. 69)
            variant flat เพราะตารางนี้มีหลายสิบช่อง กรอบทุกช่องจะลายตา */}
        <SelectMenu
          size="sm"
          variant="flat"
          disabled={!canEdit}
          value={p.category || null}
          options={categoryOptions}
          placeholder="เลือกหมวด"
          clearable="ไม่ระบุหมวด"
          onFocus={() => onCategoryFocus(p.id)}
          onChange={(v) => patch(p.id, { category: v ?? '' }, { category: v ?? '' })}
          onCreate={(name) => patch(p.id, { category: name }, { category: name })}
        />
      </td>
      <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.fobUsd} onSave={(v) => patch(p.id, { fob_usd: v }, { fobUsd: v })} /></td>
      <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.fobEur} onSave={(v) => patch(p.id, { fob_eur: v }, { fobEur: v })} /></td>
      <td className={`${td} text-right tabular-nums text-gray-500`}>{p.fobThb ? fmt(p.fobThb) : ''}</td>
      <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.freightDo} onSave={(v) => patch(p.id, { freight_do: v }, { freightDo: v })} /></td>
      <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.importTaxPct} onSave={(v) => patch(p.id, { import_tax_pct: v }, { importTaxPct: v })} placeholder="5" /></td>
      <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.shippingCost} onSave={(v) => patch(p.id, { shipping_cost: v }, { shippingCost: v })} /></td>
      <td className={`${td} text-right font-semibold tabular-nums`}>{fmt(p.totalImportCost)}</td>
      <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.srpUsd} onSave={(v) => patch(p.id, { srp_usd: v }, { srpUsd: v })} /></td>
      <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.srpEur} onSave={(v) => patch(p.id, { srp_eur: v }, { srpEur: v })} /></td>
      <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.srpSgd} onSave={(v) => patch(p.id, { srp_sgd: v }, { srpSgd: v })} /></td>
      <td className={`${td} text-right tabular-nums text-gray-500`}>{p.srpThb ? fmt(p.srpThb) : ''}</td>
      <td className={`${td} ${edit} ${groupL}`}><NumCell disabled={!canEdit} value={p.multiplier} onSave={(v) => patch(p.id, { multiplier: v }, { multiplier: v })} placeholder={String(defaultMultiplier)} /></td>
      <td className={`${td} text-right`}>
        <button
          type="button"
          className="tabular-nums text-sky-600 hover:underline"
          title="กดเพื่อใช้เป็นราคาขายจริง + platform"
          onClick={() => {
            if (!canEdit) return
            patch(
              p.id,
              { our_price_thb: p.suggestedPrice, platform_price_thb: p.suggestedPrice },
              { ourPriceThb: p.suggestedPrice, platformPriceThb: p.suggestedPrice }
            )
          }}
        >
          {fmt(p.suggestedPrice)}
        </button>
      </td>
      <td className={`${td} ${editPrice}`}>
        <NumCell
          disabled={!canEdit}
          value={p.ourPriceThb}
          onSave={(v) => patch(p.id, { our_price_thb: v }, { ourPriceThb: v })}
          placeholder={fmt(p.suggestedPrice)}
          className="font-semibold text-emerald-900"
        />
      </td>
      <td className={`${td} text-right ${groupR}`}>
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${profitClass(p.marginPct)}`}>
          {p.marginPct}%
        </span>
      </td>
      {isMarketplace && (
        <>
          <td className={`${td} ${edit} ${groupL}`}>
            <NumCell
              disabled={!canEdit}
              value={p.platformMarkupPct}
              onSave={(v) => patch(p.id, { platform_markup_pct: v }, { platformMarkupPct: v })}
              placeholder={String(defaultPlatformPct)}
            />
          </td>
          <td className={`${td} text-right`}>
            <button
              type="button"
              className="tabular-nums text-sky-600 hover:underline disabled:text-gray-400 disabled:no-underline"
              disabled={!canEdit || !p.platformSuggested}
              title="กดเพื่อใช้เป็นราคาขายจริงบน platform"
              onClick={() =>
                patch(
                  p.id,
                  { platform_price_thb: p.platformSuggested },
                  { platformPriceThb: p.platformSuggested }
                )
              }
            >
              {p.platformSuggested ? fmt(p.platformSuggested) : '—'}
            </button>
          </td>
          <td className={`${td} ${editPrice}`}>
            <NumCell
              disabled={!canEdit}
              value={p.platformPriceThb}
              onSave={(v) => patch(p.id, { platform_price_thb: v }, { platformPriceThb: v })}
              className="font-semibold text-emerald-900"
            />
          </td>
          <td className={`${td} text-right ${groupR}`}>
            {p.platformMarginPct ? (
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${profitClass(p.platformMarginPct)}`}>
                {p.platformMarginPct}%
              </span>
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </td>
        </>
      )}
      {channels.map((ch) => {
        const price = priceForChannel(ch, p)
        const cp = calculateChannelProfit(price, p.totalImportCost, ch)
        return (
          <SrpChannelCells
            key={ch.id}
            cp={cp}
            hasPrice={price > 0}
            td={td}
            showPartner={showPartnerCols}
          />
        )
      })}
      <td className={`${td} whitespace-nowrap`}>
        <button
          type="button"
          title="ดูประวัติการแก้ไขของสินค้าตัวนี้"
          className="mr-1 text-gray-300 hover:text-sky-600"
          onClick={() => onHistory(p)}
        >
          <History size={14} />
        </button>
        {canEdit && (
          <>
            <button
              type="button"
              disabled={isToggling}
              title={p.isActive ? 'ทำเครื่องหมายว่าเลิกขายแล้ว' : 'กลับมาขายอีกครั้ง'}
              className={`mr-1 ${p.isActive ? 'text-green-500' : 'text-gray-300'} hover:opacity-70 disabled:opacity-50`}
              onClick={() => onToggleActive(p.id, p.isActive)}
            >
              {isToggling ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
            </button>
            <button
              type="button"
              title="ลบสินค้า"
              className="text-gray-300 hover:text-red-500"
              onClick={() => onDelete(p)}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </td>
    </tr>
  )
})

/** สินค้า 1 ใบบนจอแคบ — memo ด้วยเหตุผลเดียวกับ SrpRow */
const SrpCard = memo(function SrpCard({
  p,
  canEdit,
  isToggling,
  channels,
  patch,
  onToggleActive,
  onLightbox,
  onDelete,
  onHistory,
}: {
  p: CalculatedProduct
  canEdit: boolean
  isToggling: boolean
  channels: SrpChannel[]
  patch: PatchFn
  onToggleActive: (id: string, current: boolean) => void
  onLightbox: (p: SrpProduct) => void
  onDelete: (p: SrpProduct) => void
  onHistory: (p: SrpProduct) => void
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${p.isActive ? '' : 'opacity-50'}`}>
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onLightbox(p)}
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50"
        >
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={16} className="text-gray-300" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <TextCell
            readOnly={!canEdit}
            value={p.name}
            onSave={(v) => patch(p.id, { name: v }, { name: v })}
            className="!px-1 !py-0.5 font-medium"
          />
          <p className="truncate px-1 text-xs text-gray-400">
            {[p.sku, p.category].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>

        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${profitClass(p.marginPct)}`}>
          {p.marginPct}%
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-2.5 text-center">
        <div>
          <p className="text-[11px] text-gray-400">ต้นทุนรวม</p>
          <p className="text-[15px] font-semibold tabular-nums">{fmt(p.totalImportCost)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">แนะนำ</p>
          <button
            type="button"
            className="text-[15px] tabular-nums text-sky-600"
            onClick={() => {
              if (!canEdit) return
              patch(
                p.id,
                { our_price_thb: p.suggestedPrice, platform_price_thb: p.suggestedPrice },
                { ourPriceThb: p.suggestedPrice, platformPriceThb: p.suggestedPrice }
              )
            }}
          >
            {fmt(p.suggestedPrice)}
          </button>
        </div>
        <div className="-m-1 rounded-md border border-emerald-200 bg-emerald-50 p-1">
          <p className="text-[11px] font-medium text-emerald-700">ราคาขายจริง</p>
          <NumCell
            disabled={!canEdit}
            value={p.ourPriceThb}
            onSave={(v) => patch(p.id, { our_price_thb: v }, { ourPriceThb: v })}
            placeholder={fmt(p.suggestedPrice)}
            className="!text-center font-semibold text-emerald-900"
          />
        </div>
      </div>

      {channels.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
          {channels.map((ch) => {
            const price = priceForChannel(ch, p)
            const cp = calculateChannelProfit(price, p.totalImportCost, ch)
            return (
              <div key={ch.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-gray-500">{ch.name}</span>
                {price > 0 ? (
                  <span className="flex items-center gap-2 tabular-nums">
                    <span className="text-gray-500">{fmt(cp.ourProfitThb)}</span>
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${profitClass(cp.ourProfitPct)}`}>
                      {cp.ourProfitPct}%
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-300">ยังไม่ตั้งราคา</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-2 flex justify-end gap-1 border-t border-gray-100 pt-2">
        <button
          type="button"
          title="ดูประวัติการแก้ไข"
          className="rounded p-1.5 text-gray-300 hover:text-sky-600"
          onClick={() => onHistory(p)}
        >
          <History size={15} />
        </button>
        {canEdit && (
          <>
          <button
            type="button"
            disabled={isToggling}
            className={`rounded p-1.5 ${p.isActive ? 'text-green-500' : 'text-gray-300'} disabled:opacity-50`}
            title={p.isActive ? 'ทำเครื่องหมายว่าเลิกขายแล้ว' : 'กลับมาขายอีกครั้ง'}
            onClick={() => onToggleActive(p.id, p.isActive)}
          >
            {isToggling ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-gray-300 hover:text-red-500"
            title="ลบสินค้า"
            onClick={() => onDelete(p)}
          >
            <Trash2 size={15} />
          </button>
          </>
        )}
      </div>
    </div>
  )
})

/* ── หน้าต่างประวัติการแก้ไข ─────────────────────────────────────────
 *
 * เจ้าของขอ 29 ส.ค. 69 — เดิมระบบเก็บแค่ "ใครแก้ล่าสุด" ทับกันไปเรื่อย ๆ
 * ตอนนี้ trigger ฝั่ง DB จดทุกครั้งที่ค่าเปลี่ยน (srp_product_history)
 * หน้านี้เอามาเรียงจากใหม่ไปเก่า + กดย้อนค่ากลับได้ทีละรายการ
 *
 * productId = null → ทั้งแบรนด์ (โชว์ชื่อสินค้าด้วย) · มีค่า → เฉพาะตัวนั้น
 * ────────────────────────────────────────────────────────────────── */
function SrpHistoryModal({
  brandId,
  productId,
  productName,
  canEdit,
  onClose,
  onRevert,
}: {
  brandId: string
  productId: string | null
  productName: string
  canEdit: boolean
  onClose: () => void
  onRevert: (e: SrpHistoryEntry) => void
}) {
  const { showToast } = useToast()
  const [rows, setRows] = useState<SrpHistoryEntry[] | null>(null)
  // นับขึ้นทีหลังกดย้อนกลับ เพื่อโหลดรายการใหม่ให้เห็นว่าย้อนไปแล้ว
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setRows(null)
    getSrpHistory(brandId, productId ?? undefined)
      .then((r) => alive && setRows(r))
      .catch((e) => {
        if (alive) setRows([])
        showToast(e instanceof Error ? e.message : 'โหลดประวัติไม่สำเร็จ', 'error')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, productId, tick])

  return (
    <Modal
      open
      onClose={onClose}
      title={productId ? `ประวัติ: ${productName}` : 'ประวัติการแก้ไข'}
      description={
        productId
          ? 'ทุกครั้งที่ค่าของสินค้าตัวนี้เปลี่ยน — ใหม่สุดอยู่บนสุด'
          : 'การแก้ไขล่าสุดของทั้งแบรนด์ (สูงสุด 300 รายการ) — ใหม่สุดอยู่บนสุด'
      }
      maxWidth={760}
    >
      {rows === null ? (
        <p className="py-8 text-center text-sm text-gray-400">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          ยังไม่มีประวัติ — ระบบเริ่มจดตั้งแต่ 29 ส.ค. 69 เป็นต้นไป
          <br />
          <span className="text-xs">การแก้ก่อนหน้านั้นไม่ได้ถูกเก็บไว้</span>
        </p>
      ) : (
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200 text-left text-[11px] text-gray-400">
                <th className="whitespace-nowrap py-1.5 pr-2 font-medium">เมื่อ</th>
                {!productId && <th className="py-1.5 pr-2 font-medium">สินค้า</th>}
                <th className="py-1.5 pr-2 font-medium">ช่อง</th>
                <th className="py-1.5 pr-2 text-right font-medium">เดิม</th>
                <th className="py-1.5 pr-2 text-right font-medium">เป็น</th>
                <th className="py-1.5 pr-2 font-medium">โดย</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const f = HISTORY_FIELDS[e.field]
                const isNew = e.field === 'created'
                return (
                  <tr key={e.id} className="border-b border-gray-50 align-middle">
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs tabular-nums text-gray-400">
                      {historyTime(e.createdAt)}
                    </td>
                    {!productId && (
                      <td className="max-w-40 truncate py-1.5 pr-2 text-xs text-gray-600" title={e.productName}>
                        {e.productName}
                      </td>
                    )}
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-gray-600">
                      {f?.label ?? e.field}
                    </td>
                    {isNew ? (
                      <td colSpan={2} className="py-1.5 pr-2 text-xs text-gray-400">
                        เพิ่มเข้าระบบ
                      </td>
                    ) : (
                      <>
                        <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums text-gray-400 line-through">
                          {historyValue(e.field, e.oldValue)}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-2 text-right font-medium tabular-nums text-gray-800">
                          {historyValue(e.field, e.newValue)}
                        </td>
                      </>
                    )}
                    <td className="max-w-24 truncate py-1.5 pr-2 text-xs text-gray-500">
                      {e.editedBy || '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      {canEdit && !isNew && (
                        <button
                          type="button"
                          title={`ย้อนกลับเป็น ${historyValue(e.field, e.oldValue)}`}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:bg-sky-50 hover:text-sky-700"
                          onClick={() => {
                            onRevert(e)
                            // ตัวเซฟหน่วง 400ms — รอให้เขียนเสร็จก่อนค่อยโหลดรายการใหม่
                            setTimeout(() => setTick((t) => t + 1), 900)
                          }}
                        >
                          <RotateCcw size={12} /> ย้อนกลับ
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

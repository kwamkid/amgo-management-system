'use client'

// SRP Calculator — ตารางสินค้า+ราคาของแบรนด์ (rebuild จาก srp-calculator เดิม
// แต่ UI เป็นชุด amgo — เจ้าของสั่ง 14 ส.ค. 69)
//
// ตาราง Excel-like: แก้ตัวเลขในเซลล์ตรง ๆ (หน่วง 400ms แล้วเซฟ) → คอลัมน์คำนวณ
// (ต้นทุนรวม/ราคาแนะนำ/margin) ขยับตามทันที + กำไรต่อช่องทางขาย 4 คอลัมน์/ช่องทาง
// offline คิดจากราคาขายเรา · online คิดจากราคา platform (กติกาเดิมของระบบเก่า)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Calculator, Download, Eye, EyeOff, FileSpreadsheet, ImageIcon, Power, Settings2, Trash2, Upload,
  Wand2, X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Input, Modal, SelectMenu } from '@/components/aoo'
import { FilterBar, FilterSelect, PageHeader, Segmented, TechLoader } from '@/components/shared'
import { createClient } from '@/lib/supabase/client'
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
  deleteSrpProduct,
  getSrpBrand,
  getSrpChannels,
  getSrpProducts,
  saveSrpBrand,
  saveSrpChannel,
  uploadSrpImage,
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
 * ราคาที่ช่องทางนั้นใช้คิดกำไร (เจ้าของยืนยัน 28 ส.ค. 69)
 *   ปกติ + ห้าง = ราคาขายจริง · marketplace = ราคาบนแพลตฟอร์ม
 */
const priceForChannel = (ch: SrpChannel, p: CalculatedProduct) =>
  ch.type === 'marketplace' ? p.platformEffective || 0 : p.effectivePrice

/**
 * ช่องตัวเลขในตาราง — โชว์เลขมี comma ตอนไม่ได้พิมพ์ เซฟตอนออกจากช่อง
 *
 * Enter = ยืนยันค่าทันที (ไม่ต้องคลิกที่อื่น) ราคา/กำไรทั้งแถวคำนวณใหม่ให้เลย
 * Esc   = ทิ้งค่าที่เพิ่งพิมพ์ กลับไปใช้ค่าเดิม
 * เจ้าของขอ 28 ส.ค. 69 — เดิมพิมพ์แล้วต้องคลิกออกก่อนถึงจะเห็นผล
 */
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
  const [text, setText] = useState<string | null>(null) // null = ไม่ได้โฟกัส
  // ธงบอก onBlur ว่ารอบนี้กด Esc มา — ใช้ ref เพราะ blur ทำงานก่อน state รอบใหม่
  const cancelled = useRef(false)
  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      className={`h-9 w-full rounded border border-transparent bg-transparent px-1.5 text-right text-[15px] tabular-nums focus:border-amber-300 focus:bg-white focus:outline-none disabled:text-gray-400 ${className}`}
      value={text ?? (value ? fmt(value, 2) : '')}
      placeholder={placeholder}
      onFocus={(e) => {
        setText(value ? String(value) : '')
        requestAnimationFrame(() => e.target.select())
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur() // onBlur เซฟให้ → ตารางคำนวณใหม่ทันที
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
      onBlur={() => {
        if (!cancelled.current && text !== null) {
          const v = parseFloat(text.replace(/,/g, '')) || 0
          if (v !== value) onSave(v)
        }
        cancelled.current = false
        setText(null)
      }}
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
  const toggleMark = (id: string) =>
    setMarked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const [statusTab, setStatusTab] = useState<'active' | 'inactive' | 'all'>('active')
  const [channelTab, setChannelTab] = useState<ChannelType>('retail')
  /** โชว์คอลัมน์ "ร้านได้฿/ร้านได้%" ของแต่ละช่องทางไหม (ค่าเริ่มต้น = โชว์) */
  const [showPartner, setShowPartner] = useState(true)
  const [lightbox, setLightbox] = useState<SrpProduct | null>(null)
  const [showChannels, setShowChannels] = useState(false)
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

  const startResize = (keys: string[], e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const base = keys.map((k) => widthOf(k))
    let latest: Record<string, number> = {}
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / keys.length
      setColW((prev) => {
        const next = { ...prev }
        keys.forEach((k, i) => {
          next[k] = Math.max(48, Math.round(base[i] + dx))
        })
        latest = next
        return next
      })
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      if (Object.keys(latest).length) remember(latest)
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
            .update({ ...fields, last_edited_by: editorName, last_edited_at: new Date().toISOString() })
            .eq('id', pid)
          if (error) showToast(`เซฟไม่สำเร็จ: ${error.message}`, 'error')
        }
      }, 400)
    },
    [editorName, showToast]
  )

  /* ── คำนวณ + กรอง ─────────────────────────────────────────────────── */
  const calculated = useMemo<CalculatedProduct[]>(
    () => (brand && products ? products.map((p) => calculateProduct(p, brand)) : []),
    [brand, products]
  )

  const categories = useMemo(
    () => [...new Set(calculated.map((p) => p.category).filter(Boolean))].sort(),
    [calculated]
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

  const applyGlobalMultiplier = async (m: number) => {
    if (!brand || !products) return
    if (!confirm(`ตั้งตัวคูณ ×${m} ให้สินค้าทั้งแบรนด์ (${products.length} ตัว)?`)) return
    const sb = createClient()
    await sb.from('srp_products').update({ multiplier: m }).eq('brand_id', brand.id)
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
        .update({ our_price_thb: p.suggestedPrice, platform_price_thb: p.suggestedPrice })
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
        .update({ platform_markup_pct: pct, platform_price_thb: p.platformPriceThb })
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
        <Segmented
          value={statusTab}
          onChange={(v) => setStatusTab(v as typeof statusTab)}
          options={[
            { value: 'active', label: `ขายอยู่ (${activeCount})` },
            { value: 'inactive', label: `ปิด (${calculated.length - activeCount})` },
            { value: 'all', label: 'ทั้งหมด' },
          ]}
        />
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
          ช่องพื้นเหลือง = พิมพ์แก้ได้เลย (ระบบบันทึกให้เอง) · ช่องพื้นขาว = ระบบคำนวณให้ · ลากขอบหัวตารางเพื่อปรับความกว้าง (ดับเบิลคลิก = คืนค่าเดิม)
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
          ซ่อนบนจอแคบ: 20 คอลัมน์บนมือถือ เลื่อนไปทางขวาแล้วไม่เหลือบริบทว่า
          กำลังดูสินค้าตัวไหน (เจ้าของทัก 22 ส.ค.) — จอแคบใช้การ์ดแทนข้างล่าง */}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm lg:block">
        <table
          className="border-collapse text-[15px]"
          style={{ tableLayout: 'fixed', width: tableWidth }}
        >
          <colgroup>
            {colKeys.map((k) => (
              <col key={k} style={{ width: widthOf(k) }} />
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
              <tr
                key={p.id}
                className={`${p.isActive ? '' : 'opacity-50'} ${
                  marked.has(p.id) ? '[&>td]:!bg-sky-100' : ''
                }`}
              >
                <td className={`${td} sticky left-0 z-10 ${canEdit ? 'bg-amber-50' : 'bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={marked.has(p.id)}
                      onChange={() => toggleMark(p.id)}
                      className="h-4 w-4 shrink-0 cursor-pointer accent-sky-600"
                      title="ทำเครื่องหมายไว้ดูเฉย ๆ ว่าทำถึงไหนแล้ว"
                    />
                    <button
                      type="button"
                      onClick={() => setLightbox(p)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-100 bg-gray-50"
                      title={p.imageUrl ? 'ดู/เปลี่ยนรูป' : 'เพิ่มรูป'}
                    >
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon size={14} className="text-gray-300" />
                      )}
                    </button>
                    <input
                      readOnly={!canEdit}
                      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[15px] focus:border-amber-300 focus:bg-white focus:outline-none"
                      value={p.name}
                      onChange={(e) => patchProduct(p.id, { name: e.target.value }, { name: e.target.value })}
                    />
                  </div>
                </td>
                <td className={td}>
                  <input
                    readOnly={!canEdit}
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[15px] focus:border-amber-300 focus:bg-white focus:outline-none"
                    value={p.sku}
                    onChange={(e) => patchProduct(p.id, { sku: e.target.value }, { sku: e.target.value })}
                  />
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
                    onFocus={() => setEditingCategoryId(p.id)}
                    onChange={(v) =>
                      patchProduct(p.id, { category: v ?? '' }, { category: v ?? '' })
                    }
                    onCreate={(name) =>
                      patchProduct(p.id, { category: name }, { category: name })
                    }
                  />
                </td>
                <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.fobUsd} onSave={(v) => patchProduct(p.id, { fob_usd: v }, { fobUsd: v })} /></td>
                <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.fobEur} onSave={(v) => patchProduct(p.id, { fob_eur: v }, { fobEur: v })} /></td>
                <td className={`${td} text-right tabular-nums text-gray-500`}>{p.fobThb ? fmt(p.fobThb) : ''}</td>
                <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.freightDo} onSave={(v) => patchProduct(p.id, { freight_do: v }, { freightDo: v })} /></td>
                <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.importTaxPct} onSave={(v) => patchProduct(p.id, { import_tax_pct: v }, { importTaxPct: v })} placeholder="5" /></td>
                <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.shippingCost} onSave={(v) => patchProduct(p.id, { shipping_cost: v }, { shippingCost: v })} /></td>
                <td className={`${td} text-right font-semibold tabular-nums`}>{fmt(p.totalImportCost)}</td>
                <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.srpUsd} onSave={(v) => patchProduct(p.id, { srp_usd: v }, { srpUsd: v })} /></td>
                <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.srpEur} onSave={(v) => patchProduct(p.id, { srp_eur: v }, { srpEur: v })} /></td>
                <td className={`${td} ${edit}`}><NumCell disabled={!canEdit} value={p.srpSgd} onSave={(v) => patchProduct(p.id, { srp_sgd: v }, { srpSgd: v })} /></td>
                <td className={`${td} text-right tabular-nums text-gray-500`}>{p.srpThb ? fmt(p.srpThb) : ''}</td>
                <td className={`${td} ${edit} ${groupL}`}><NumCell disabled={!canEdit} value={p.multiplier} onSave={(v) => patchProduct(p.id, { multiplier: v }, { multiplier: v })} placeholder={String(brand.defaultMultiplier)} /></td>
                <td className={`${td} text-right`}>
                  <button
                    type="button"
                    className="tabular-nums text-sky-600 hover:underline"
                    title="กดเพื่อใช้เป็นราคาขายจริง + platform"
                    onClick={() => {
                      if (!canEdit) return
                      patchProduct(
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
                    onSave={(v) => patchProduct(p.id, { our_price_thb: v }, { ourPriceThb: v })}
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
                        onSave={(v) => patchProduct(p.id, { platform_markup_pct: v }, { platformMarkupPct: v })}
                        placeholder={String(brand.platformMarkupPct)}
                      />
                    </td>
                    <td className={`${td} text-right`}>
                      <button
                        type="button"
                        className="tabular-nums text-sky-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                        disabled={!canEdit || !p.platformSuggested}
                        title="กดเพื่อใช้เป็นราคาขายจริงบน platform"
                        onClick={() =>
                          patchProduct(
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
                        onSave={(v) => patchProduct(p.id, { platform_price_thb: v }, { platformPriceThb: v })}
                        className="font-semibold text-emerald-900"
                      />
                    </td>
                    <td className={`${td} text-right ${groupR}`}>
                      {p.platformMarginPct ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${profitClass(p.platformMarginPct)}`}
                        >
                          {p.platformMarginPct}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </>
                )}
                {shownChannels.map((ch) => {
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
                  {canEdit && (<>
                  <button
                    type="button"
                    title={p.isActive ? 'ปิดการขาย' : 'เปิดการขาย'}
                    className={`mr-1 ${p.isActive ? 'text-green-500' : 'text-gray-300'} hover:opacity-70`}
                    onClick={() => patchProduct(p.id, { is_active: !p.isActive }, { isActive: !p.isActive })}
                  >
                    <Power size={14} />
                  </button>
                  <button
                    type="button"
                    title="ลบสินค้า"
                    className="text-gray-300 hover:text-red-500"
                    onClick={async () => {
                      if (!confirm(`ลบ "${p.name}" ?`)) return
                      await deleteSrpProduct(p.id)
                      setProducts((prev) => prev?.filter((x) => x.id !== p.id) ?? prev)
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                  </>)}
                </td>
              </tr>
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

      {/* ── จอแคบ: การ์ดต่อสินค้า เอาเฉพาะตัวเลขที่ใช้ตัดสินใจ ──────────
          ตัดคอลัมน์ต้นทาง (FOB/ค่าเรือ/ภาษี/ส่งในไทย) ออก เพราะบนมือถือ
          คนดูเพื่อ "เช็คราคากับกำไร" ไม่ได้มานั่งกรอกต้นทุน — ถ้าต้องแก้
          ต้นทุนจริง ๆ เปิดบนคอมซึ่งมีตารางเต็ม */}
      <div className="space-y-3 lg:hidden">
        {visible.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${p.isActive ? '' : 'opacity-50'}`}
          >
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => setLightbox(p)}
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon size={16} className="text-gray-300" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <input
                  readOnly={!canEdit}
                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-medium focus:border-amber-300 focus:bg-white focus:outline-none"
                  value={p.name}
                  onChange={(e) => patchProduct(p.id, { name: e.target.value }, { name: e.target.value })}
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
                    patchProduct(
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
                  onSave={(v) => patchProduct(p.id, { our_price_thb: v }, { ourPriceThb: v })}
                  placeholder={fmt(p.suggestedPrice)}
                  className="!text-center font-semibold text-emerald-900"
                />
              </div>
            </div>

            {shownChannels.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                {shownChannels.map((ch) => {
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

            {canEdit && (
              <div className="mt-2 flex justify-end gap-1 border-t border-gray-100 pt-2">
                <button
                  type="button"
                  className={`rounded p-1.5 ${p.isActive ? 'text-green-500' : 'text-gray-300'}`}
                  title={p.isActive ? 'ปิดการขาย' : 'เปิดการขาย'}
                  onClick={() => patchProduct(p.id, { is_active: !p.isActive }, { isActive: !p.isActive })}
                >
                  <Power size={15} />
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-gray-300 hover:text-red-500"
                  title="ลบสินค้า"
                  onClick={async () => {
                    if (!confirm(`ลบ "${p.name}" ?`)) return
                    await deleteSrpProduct(p.id)
                    setProducts((prev) => prev?.filter((x) => x.id !== p.id) ?? prev)
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>
        ))}

        {visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            ไม่มีสินค้าตรงตามตัวกรอง
          </p>
        )}
      </div>

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
        <Modal
          open
          onClose={() => setShowChannels(false)}
          title="ช่องทางขาย"
          description="ช่องทางปกติ หัก GP · ห้าง หัก GP/PC/DC — ทั้งคู่คิดจากราคาขายจริง · Marketplace หัก commission/ค่าธรรมเนียม/ค่าส่ง คิดจากราคาบนแพลตฟอร์ม"
          maxWidth={620}
        >
          <div className="space-y-4">
            {CHANNEL_TYPES.map((type) => (
              <div key={type}>
                <div className="mb-1 text-xs font-semibold text-gray-500">
                  {CHANNEL_TYPE_LABEL[type]}
                </div>
                <div className="space-y-2">
                  {channels
                    .filter((c) => c.type === type)
                    .map((ch) => (
                      <ChannelEditor
                        key={ch.id}
                        channel={ch}
                        onChange={(patch) => {
                          const next = { ...ch, ...patch }
                          setChannels((prev) => prev.map((c) => (c.id === ch.id ? next : c)))
                          saveSrpChannel(next).catch((e) => showToast(e.message, 'error'))
                        }}
                      />
                    ))}
                  {/* ชุด GP มาตรฐานที่เจ้าของใช้คุยกับร้านค้าเป็นประจำ (28 ส.ค. 69)
                      กดทีเดียวได้ครบ 6 ระดับ ไม่ต้องกรอกทีละอัน */}
                  {type === 'retail' && (
                    <button
                      type="button"
                      onClick={() => addRetailGpSet()}
                      className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-gray-400 hover:bg-gray-50"
                    >
                      + เพิ่มชุด GP มาตรฐาน (25 / 30 / 35 / 40 / 45 / 50%)
                    </button>
                  )}
                </div>
              </div>
            ))}
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

/** แถวแก้ไขช่องทางเดียว — เซฟทันทีตอน blur */
function ChannelEditor({
  channel,
  onChange,
}: {
  channel: SrpChannel
  onChange: (patch: Partial<SrpChannel>) => void
}) {
  // retail หัก GP อย่างเดียว — ไม่ต้องมีช่อง PC/DC ให้กรอกหลอก
  const fields: [keyof SrpChannel, string][] =
    channel.type === 'retail'
      ? [
          ['gpPct', 'GP %'],
          ['promoPct', 'โปร %'],
        ]
      : channel.type === 'department'
      ? [
          ['gpPct', 'GP %'],
          ['pcPct', 'PC %'],
          ['dcPct', 'DC %'],
          ['promoPct', 'โปร %'],
        ]
      : [
          ['commissionPct', 'Comm %'],
          ['transactionFeePct', 'Trans %'],
          ['serviceFeePct', 'Service %'],
          ['shippingThb', 'ค่าส่ง ฿'],
          ['promoPct', 'โปร %'],
        ]
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 p-2">
      <div className="min-w-28 flex-1">
        <span className="mb-0.5 block text-[10px] text-gray-400">ชื่อ</span>
        <Input value={channel.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      {fields.map(([key, label]) => (
        <label key={key} className="block w-20">
          <span className="mb-0.5 block text-[10px] text-gray-400">{label}</span>
          <Input
            type="number"
            inputMode="decimal"
            value={String(channel[key] ?? 0)}
            onChange={(e) => onChange({ [key]: parseFloat(e.target.value) || 0 })}
          />
        </label>
      ))}
    </div>
  )
}

'use client'

// อัพโหลดสินค้าเข้าแบรนด์ SRP — จากไฟล์ Excel หรือวางข้อความจาก Excel/Sheets
//
// ต่างจากระบบเก่าจุดเดียว (ตั้งใจ): เดิม insert ดื้อ ๆ อัพซ้ำ = สินค้าซ้ำ
// ตอนนี้จับคู่ด้วย SKU — มีอยู่แล้วอัพเดต ไม่มีค่อยสร้างใหม่

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FileUp, Upload } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Textarea } from '@/components/aoo'
import { PageHeader, SectionCard, TechLoader } from '@/components/shared'
import { parseExcel, parseTSV, type ParsedProduct } from '@/lib/services/srp/parseExcel'
import { getSrpBrand, upsertSrpProductsBySku } from '@/lib/services/srp/srpService'
import { useEffect } from 'react'
import type { SrpBrand } from '@/lib/services/srp/calculator'

export default function SrpUploadPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const brandId = params.id
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [brand, setBrand] = useState<SrpBrand | null>(null)
  const [rows, setRows] = useState<ParsedProduct[]>([])
  const [pasted, setPasted] = useState('')
  const [saving, setSaving] = useState(false)

  const canSee = !!userData && (userData.role === 'admin' || userData.hasSrpAccess)

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  useEffect(() => {
    if (canSee && brandId) getSrpBrand(brandId).then(setBrand).catch(() => {})
  }, [canSee, brandId])

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet([
      {
        Product: 'ตัวอย่างสินค้า A', Category: 'Stroller', SKU: 'SKU-001',
        'FOB (USD)': 120, 'FOB (EUR)': '', 'Freight + D/O': 500, 'Import Tax (%)': 5,
        'Shipping Cost': 100, 'SRP (USD)': 399, 'SRP (EUR)': '', Multiplier: 3, Notes: '',
      },
      {
        Product: 'ตัวอย่างสินค้า B', Category: 'Toy', SKU: 'SKU-002',
        'FOB (USD)': '', 'FOB (EUR)': 45, 'Freight + D/O': 200, 'Import Tax (%)': 5,
        'Shipping Cost': 50, 'SRP (USD)': '', 'SRP (EUR)': 129, Multiplier: 3.5, Notes: 'สีแดง',
      },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    XLSX.writeFile(wb, 'srp-template.xlsx')
  }

  const save = async () => {
    if (!rows.length || !userData) return
    setSaving(true)
    try {
      const mapped = rows.map((r, i) => ({
        name: r.name,
        category: r.category,
        sku: r.sku,
        fobUsd: r.fob_usd,
        fobEur: r.fob_eur,
        freightDo: r.freight_do,
        importTaxPct: r.import_tax_pct,
        shippingCost: r.shipping_cost,
        srpUsd: r.srp_usd,
        srpEur: r.srp_eur,
        multiplier: r.multiplier,
        notes: r.notes,
        sortOrder: i,
      }))
      const result = await upsertSrpProductsBySku(
        brandId,
        mapped,
        userData.displayName || userData.fullName
      )
      showToast(`นำเข้าแล้ว: ใหม่ ${result.inserted} · อัพเดต ${result.updated}`, 'success')
      router.push(`/srp/${brandId}`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'นำเข้าไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!userData) return <TechLoader />
  if (!canSee) return null

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        icon={FileUp}
        title={`อัพโหลดสินค้า${brand ? ` · ${brand.name}` : ''}`}
        description="เลือกไฟล์ Excel หรือก๊อปตารางจาก Excel/Google Sheets มาวาง — จับคู่ด้วย SKU: มีอยู่แล้วอัพเดต ไม่มีสร้างใหม่"
        backHref={`/srp/${brandId}`}
        actions={
          <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
            ดาวน์โหลดไฟล์ตัวอย่าง
          </Button>
        }
      />

      <SectionCard title="1 · เลือกไฟล์ หรือวางข้อความ">
        <div className="space-y-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">
            <Upload size={15} /> เลือกไฟล์ (.xlsx / .xls / .csv)
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = () => {
                  try {
                    const parsed = parseExcel(reader.result as ArrayBuffer, brand?.defaultMultiplier ?? 3)
                    setRows(parsed)
                    if (!parsed.length) showToast('อ่านไฟล์ได้แต่ไม่เจอสินค้า — เช็คว่าแถวแรกเป็นหัวตาราง', 'error')
                  } catch {
                    showToast('อ่านไฟล์ไม่สำเร็จ', 'error')
                  }
                }
                reader.readAsArrayBuffer(f)
              }}
            />
          </label>

          <Textarea
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value)
              setRows(parseTSV(e.target.value, brand?.defaultMultiplier ?? 3))
            }}
            placeholder="หรือก๊อปตารางจาก Excel/Google Sheets มาวางตรงนี้ (บรรทัดแรกต้องเป็นหัวตาราง)"
            rows={5}
          />

          <p className="text-xs text-gray-400">
            คอลัมน์ที่รองรับ: Product* · Category · SKU · FOB (USD) · FOB (EUR) · Freight + D/O ·
            Import Tax (%) · Shipping Cost · SRP (USD) · SRP (EUR) · Multiplier · Notes — ลำดับสลับได้
            ระบบจับจากชื่อหัวคอลัมน์ · แถวที่ไม่มีชื่อสินค้าจะถูกข้าม
          </p>
        </div>
      </SectionCard>

      {rows.length > 0 && (
        <SectionCard title={`2 · ตรวจก่อนนำเข้า (${rows.length.toLocaleString()} รายการ)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-gray-400">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">สินค้า</th>
                  <th className="py-1 pr-2">SKU</th>
                  <th className="py-1 pr-2 text-right">FOB</th>
                  <th className="py-1 text-right">SRP</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="py-1 pr-2 text-gray-400">{i + 1}</td>
                    <td className="max-w-sm truncate py-1 pr-2">{r.name}</td>
                    <td className="py-1 pr-2 text-gray-500">{r.sku}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {r.fob_usd ? `$${r.fob_usd}` : r.fob_eur ? `€${r.fob_eur}` : '—'}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {r.srp_usd ? `$${r.srp_usd}` : r.srp_eur ? `€${r.srp_eur}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && (
              <p className="mt-1 text-xs text-gray-400">…และอีก {rows.length - 20} รายการ</p>
            )}
          </div>
          <Button type="button" className="mt-3 h-11 w-full" onClick={save} disabled={saving}>
            {saving ? 'กำลังนำเข้า…' : `นำเข้า ${rows.length.toLocaleString()} รายการ`}
          </Button>
        </SectionCard>
      )}
    </div>
  )
}

'use client'

// ตั้งค่าแผนการตลาด (admin only) — ผูกแต่ละแบรนด์กับ aoocommerce (ยอดขาย) และ aoosocial (ปฏิทิน/ผู้ติดตาม)
// = table marketing_brand_links · RLS: only is_admin() writes. Sales sync: lib/marketing/aooSales.ts

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Save, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Field, MultiSelectMenu, type SelectOption } from '@/components/aoo'
import { BrandLogo, PageHeader, SectionCard, TechLoader } from '@/components/shared'
import { useAooSync } from '@/components/marketing/useAooSync'
import { BRANDS, brandLabel } from '@/lib/constants/brands'
import { getAooOptions, getBrandLinks, saveBrandLink, type AooOptions, type BrandLink } from '@/lib/services/marketingService'
import { periodBackTh } from '@/components/marketing/format'

type Draft = Omit<BrandLink, 'updatedAt'>

const PLATFORM: Record<string, string> = { shopee: 'Shopee', lazada: 'Lazada', tiktok: 'TikTok Shop' }
const SOCIAL: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' }
const BACKFILL_DAYS = 90

const blank = (brand: string): Draft => ({ brand, aoosocialCompanyId: null, aoosocialAccountIds: [], aooBrandNames: [], aooShops: [] })

export default function MarketingSettingsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  const toastRef = useRef(showToast)
  useEffect(() => {
    toastRef.current = showToast
  })
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [aoo, setAoo] = useState<AooOptions | null>(null)
  const [aooError, setAooError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const sync = useAooSync()

  const isAdmin = userData?.role === 'admin'
  useEffect(() => {
    if (userData && !isAdmin) router.push('/unauthorized')
  }, [userData, isAdmin, router])

  useEffect(() => {
    if (!isAdmin) return
    getBrandLinks()
      .then((links) => {
        const byBrand = new Map(links.map((l) => [l.brand, l]))
        const brands = [...new Set([...BRANDS.map((b) => b.slug), ...byBrand.keys()])]
        setDrafts(brands.map((b) => byBrand.get(b) ?? blank(b)))
      })
      .catch((e: Error) => toastRef.current(e.message, 'error'))
    getAooOptions()
      .then(setAoo)
      .catch((e: Error) => setAooError(e.message))
  }, [isAdmin])

  if (!drafts) return <TechLoader />

  const aooBrandOptions: SelectOption[] = (aoo?.brands ?? []).map((b) => ({ value: b, label: b }))
  const shopOptions: SelectOption[] = (aoo?.shops ?? []).map((s) => ({ value: s.name, label: s.name, hint: PLATFORM[s.platform] ?? s.platform }))
  const socialOptions: SelectOption[] = (aoo?.socialAccounts ?? []).map((a) => ({
    value: a.id,
    label: a.name,
    hint: `${SOCIAL[a.platform] ?? a.platform} · ${a.company}${a.needsReconnect ? ' · ต้องเชื่อมต่อใหม่' : ''}`,
  }))
  const aooHas = (label: string) => aoo?.brands.some((b) => b.toLowerCase() === label.toLowerCase()) ?? false

  const patch = (brand: string, p: Partial<Draft>) => setDrafts((ds) => ds?.map((d) => (d.brand === brand ? { ...d, ...p } : d)) ?? ds)

  const save = async (d: Draft, quiet = false): Promise<boolean> => {
    setSaving(d.brand)
    try {
      await saveBrandLink(d)
      if (!quiet) showToast(`บันทึก ${brandLabel(d.brand)} แล้ว`, 'success')
      return true
    } catch (e) {
      showToast((e as Error).message, 'error')
      return false
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="ตั้งค่าแผนการตลาด"
        description="ผูกแบรนด์กับระบบ aoo (ยอดขาย) และ aoosocial (ปฏิทินโพสต์ · จำนวนโพสต์) — ระบบดึงตัวเลขเข้า KPI ทุกวันตอน 05:00"
        icon={Settings}
        backHref="/marketing"
      />

      {aoo?.socialError && (
        <SectionCard>
          <p className="text-sm text-[var(--danger)]">โหลดบัญชีจาก aoosocial ไม่ได้: {aoo.socialError}</p>
        </SectionCard>
      )}

      {aooError && (
        <SectionCard>
          <p className="text-sm text-[var(--danger)]">โหลดรายชื่อจาก aoo ไม่ได้: {aooError}</p>
        </SectionCard>
      )}

      {drafts.map((d) => {
        const label = brandLabel(d.brand)
        const auto = aooHas(label)
        return (
          <SectionCard
            key={d.brand}
            title={
              <span className="flex items-center gap-2">
                <BrandLogo brand={d.brand} />
                {label}
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                asDiv
                label="ชื่อแบรนด์ในระบบ aoo"
                help={auto ? `ว่างไว้ = ใช้ "${label}" อัตโนมัติ` : 'ว่างไว้ = ยังไม่ดึงยอดขาย (aoo ไม่มีแบรนด์ชื่อนี้)'}
              >
                <MultiSelectMenu
                  values={d.aooBrandNames}
                  onChange={(v) => patch(d.brand, { aooBrandNames: v })}
                  options={aooBrandOptions}
                  placeholder={auto ? label : 'เลือกแบรนด์'}
                  ariaLabel={`ชื่อแบรนด์ใน aoo ของ ${label}`}
                  disabled={!aoo}
                />
              </Field>
              <Field asDiv label="นับเฉพาะร้านบน marketplace" help="ว่างไว้ = ทุกร้าน (รวมร้าน ABC the Baby) · หน้าร้าน/เว็บ/แชทนับทั้งหมดเสมอ">
                <MultiSelectMenu
                  values={d.aooShops}
                  onChange={(v) => patch(d.brand, { aooShops: v })}
                  options={shopOptions}
                  placeholder="ทุกร้าน"
                  ariaLabel={`ร้าน marketplace ของ ${label}`}
                  disabled={!aoo}
                />
              </Field>
              <Field asDiv label="บัญชีโซเชียลใน aoosocial" help="ใช้ทำปฏิทินโพสต์และนับจำนวนโพสต์" className="md:col-span-2">
                <MultiSelectMenu
                  values={d.aoosocialAccountIds}
                  onChange={(v) =>
                    patch(d.brand, {
                      aoosocialAccountIds: v,
                      aoosocialCompanyId: aoo?.socialAccounts.find((a) => a.id === v[0])?.companyId ?? null,
                    })
                  }
                  options={socialOptions}
                  placeholder="ยังไม่ได้ผูก"
                  summary={(n) => `${n} บัญชี`}
                  ariaLabel={`บัญชี aoosocial ของ ${label}`}
                  disabled={!aoo}
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                icon={RefreshCw}
                loading={sync.busy === d.brand}
                disabled={!!sync.busy || (!auto && !d.aooBrandNames.length && !d.aoosocialAccountIds.length)}
                onClick={async () => {
                  // the sync reads the saved link — save what is on screen first
                  if (!(await save(d, true))) return
                  const { from, to } = periodBackTh(BACKFILL_DAYS)
                  sync.run(d.brand, from, to)
                }}
              >
                ดึงตัวเลขย้อนหลัง {BACKFILL_DAYS} วัน
              </Button>
              <Button variant="secondary" icon={Save} loading={saving === d.brand} onClick={() => save(d)}>
                บันทึก
              </Button>
            </div>
          </SectionCard>
        )
      })}
    </div>
  )
}

'use client'

// ตั้งค่า > บริษัท — เพิ่ม/แก้ไขบริษัท + อัพโหลดโลโก้
//
// ข้อมูลตรงนี้ขึ้นหัวเอกสารทางการทั้งหมด (สัญญาจ้าง/ใบรับรองเงินเดือน):
// ชื่อ ที่อยู่ เลขทะเบียนนิติบุคคล(=เลขผู้เสียภาษี) และโลโก้
//
// โลโก้เก็บใน bucket สาธารณะ company-logos ตั้งชื่อไฟล์ตาม id บริษัท (ทับของเดิม)
// URL ที่เก็บแนบ ?v=เวลา ไว้ล้าง cache — อัพรูปใหม่แล้วเห็นทันทีทุกหน้า
// RLS: จัดการได้เฉพาะ HR/แอดมิน (policy companies_manage + storage company_logos_*)

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ImagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Field, ImageCropper, Input, Modal, Pill } from '@/components/aoo'
import { PageHeader, SectionCard, TechLoader } from '@/components/shared'

type CompanyRow = {
  id: string | null // null = แถวใหม่ ยังไม่บันทึก
  code: string
  name_th: string
  name_en: string
  address: string
  phone: string
  branch_label: string
  registration_no: string
  logo_url: string | null
  is_active: boolean
}

export default function CompanySettingsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [rows, setRows] = useState<CompanyRow[] | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  // เลือกไฟล์แล้ว crop ก่อนอัพโหลด — cropper เดียวกับ aoosocial
  const [cropTarget, setCropTarget] = useState<{ idx: number; url: string; isPng: boolean } | null>(
    null
  )

  useEffect(() => {
    if (userData && userData.role !== 'hr' && userData.role !== 'admin') {
      router.push('/unauthorized')
    }
  }, [userData, router])

  const load = async () => {
    const { data, error } = await createClient()
      .from('companies')
      .select(
        'id, code, name_th, name_en, address, phone, branch_label, registration_no, logo_url, is_active'
      )
      .order('code')
    if (error) {
      showToast(`โหลดข้อมูลบริษัทไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    setRows(
      (data ?? []).map((c) => ({
        id: c.id,
        code: c.code,
        name_th: c.name_th,
        name_en: c.name_en ?? '',
        address: c.address ?? '',
        phone: c.phone ?? '',
        branch_label: c.branch_label ?? '',
        registration_no: c.registration_no ?? '',
        logo_url: c.logo_url,
        is_active: c.is_active,
      }))
    )
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = (idx: number, p: Partial<CompanyRow>) =>
    setRows((prev) => prev!.map((r, i) => (i === idx ? { ...r, ...p } : r)))

  const save = async (idx: number) => {
    const r = rows![idx]
    if (!r.code.trim() || !r.name_th.trim()) {
      showToast('กรอกรหัสย่อกับชื่อบริษัทก่อน', 'error')
      return
    }
    setSavingId(r.id ?? 'new')
    const sb = createClient()
    const payload = {
      code: r.code.trim().toUpperCase(),
      name_th: r.name_th.trim(),
      name_en: r.name_en.trim() || null,
      address: r.address.trim() || null,
      phone: r.phone.trim() || null,
      // ว่าง = ไม่ขึ้นวงเล็บต่อท้ายชื่อบนหัวจดหมาย (คอลัมน์ NOT NULL จึงเก็บ '')
      branch_label: r.branch_label.trim(),
      registration_no: r.registration_no.trim() || null,
      is_active: r.is_active,
    }
    const { error } = r.id
      ? await sb.from('companies').update(payload).eq('id', r.id)
      : await sb.from('companies').insert(payload)
    setSavingId(null)
    if (error) {
      showToast(`บันทึกไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    showToast('บันทึกข้อมูลบริษัทแล้ว', 'success')
    await load()
  }

  // รับไฟล์จากปุ่ม → เปิด cropper ก่อน (ยังไม่อัพโหลด)
  const pickLogo = (idx: number, file: File) => {
    const r = rows![idx]
    if (!r.id) {
      showToast('บันทึกบริษัทก่อน แล้วค่อยอัพโหลดโลโก้', 'error')
      return
    }
    if (!file.type.startsWith('image/')) {
      showToast('เลือกไฟล์รูปภาพ (PNG/JPG)', 'error')
      return
    }
    setCropTarget({ idx, url: URL.createObjectURL(file), isPng: file.type === 'image/png' })
  }

  const uploadLogo = async (idx: number, blob: Blob, isPng: boolean) => {
    const r = rows![idx]
    if (!r.id) return

    const sb = createClient()
    const ext = isPng ? 'png' : 'jpg'
    const path = `${r.id}.${ext}`
    const { error: upErr } = await sb.storage
      .from('company-logos')
      .upload(path, blob, { upsert: true, contentType: isPng ? 'image/png' : 'image/jpeg' })
    if (upErr) {
      showToast(`อัพโหลดไม่สำเร็จ: ${upErr.message}`, 'error')
      return
    }

    const { data } = sb.storage.from('company-logos').getPublicUrl(path)
    const url = `${data.publicUrl}?v=${Date.now()}`
    const { error } = await sb.from('companies').update({ logo_url: url }).eq('id', r.id)
    if (error) {
      showToast(`บันทึกโลโก้ไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    patch(idx, { logo_url: url })
    showToast('อัพโหลดโลโก้แล้ว — ขึ้นหัวเอกสารให้อัตโนมัติ', 'success')
  }

  if (!rows) return <TechLoader />

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        title="บริษัท"
        description="ชื่อ ที่อยู่ เลขทะเบียน และโลโก้ — ใช้บนหัวจดหมาย สัญญาจ้าง และใบรับรองเงินเดือน"
        icon={Building2}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="Plus"
            onClick={() =>
              setRows((prev) => [
                ...prev!,
                {
                  id: null,
                  code: '',
                  name_th: '',
                  name_en: '',
                  address: '',
                  phone: '',
                  branch_label: 'สำนักงานใหญ่',
                  registration_no: '',
                  logo_url: null,
                  is_active: true,
                },
              ])
            }
          >
            เพิ่มบริษัท
          </Button>
        }
      />

      {rows.map((r, idx) => (
        <CompanyCard
          key={r.id ?? `new-${idx}`}
          row={r}
          saving={savingId === (r.id ?? 'new')}
          onChange={(p) => patch(idx, p)}
          onSave={() => save(idx)}
          onUpload={(f) => pickLogo(idx, f)}
        />
      ))}

      {/* crop โลโก้ก่อนอัพโหลด — ตัวเดียวกับ aoosocial */}
      {cropTarget && (
        <Modal
          open
          onClose={() => {
            URL.revokeObjectURL(cropTarget.url)
            setCropTarget(null)
          }}
          title="จัดกรอบโลโก้"
          description="ลากและซูมรูปในกรอบ — เต็มรูป = ใช้ทั้งรูปไม่ตัด"
          maxWidth={460}
        >
          <ImageCropper
            src={cropTarget.url}
            outputSize={512}
            outputType={cropTarget.isPng ? 'image/png' : 'image/jpeg'}
            aspectOptions={[
              { label: 'เต็มรูป', aspect: null },
              { label: 'จัตุรัส 1:1', aspect: 1 },
              { label: 'แนวนอน 3:1', aspect: 3 },
            ]}
            onCancel={() => {
              URL.revokeObjectURL(cropTarget.url)
              setCropTarget(null)
            }}
            onConfirm={async (blob) => {
              const t = cropTarget
              URL.revokeObjectURL(t.url)
              setCropTarget(null)
              await uploadLogo(t.idx, blob, t.isPng)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

function CompanyCard({
  row,
  saving,
  onChange,
  onSave,
  onUpload,
}: {
  row: CompanyRow
  saving: boolean
  onChange: (p: Partial<CompanyRow>) => void
  onSave: () => void
  onUpload: (f: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <SectionCard>
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* โลโก้ — กดที่รูปเพื่อเปลี่ยน */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title={row.id ? 'กดเพื่ออัพโหลด/เปลี่ยนโลโก้' : 'บันทึกบริษัทก่อน แล้วค่อยอัพโหลดโลโก้'}
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:border-red-300"
          >
            {row.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.logo_url} alt={row.name_th} className="h-full w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs text-gray-400">
                <ImagePlus size={20} /> โลโก้
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ''
            }}
          />
        </div>

        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <Field label="รหัสย่อ" required>
            <Input
              value={row.code}
              onChange={(e) => onChange({ code: e.target.value })}
              placeholder="เช่น AGD" className="uppercase"
            />
          </Field>
          <Field label="ชื่อบริษัท (ตามหนังสือรับรอง)" required className="sm:col-span-2">
            <Input
              value={row.name_th}
              onChange={(e) => onChange({ name_th: e.target.value })}
              placeholder="เช่น เอจี ดราก้อน จำกัด"
            />
          </Field>
          <Field label="ชื่อบริษัท (อังกฤษ)" className="sm:col-span-2">
            <Input
              value={row.name_en}
              onChange={(e) => onChange({ name_en: e.target.value })}
              placeholder="เช่น AG DRAGON CO., LTD."
            />
          </Field>
          <Field label="คำต่อท้ายชื่อ">
            <Input
              value={row.branch_label}
              onChange={(e) => onChange({ branch_label: e.target.value })}
              placeholder="สำนักงานใหญ่"
            />
          </Field>
          <Field label="ที่อยู่สำนักงาน" className="sm:col-span-2">
            <Input
              value={row.address}
              onChange={(e) => onChange({ address: e.target.value })}
              placeholder="เลขที่ ถนน แขวง เขต จังหวัด รหัสไปรษณีย์"
            />
          </Field>
          <Field label="เบอร์โทร">
            <Input
              value={row.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="02-000-0000" className="tabular-nums"
            />
          </Field>
          <Field label="เลขทะเบียน/ผู้เสียภาษี">
            <Input
              value={row.registration_no}
              onChange={(e) => onChange({ registration_no: e.target.value })}
              placeholder="13 หลัก" className="tabular-nums" mono
            />
          </Field>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
        {!row.id && <Pill tone="warning">ยังไม่ได้บันทึก</Pill>}
        <Button size="sm" icon="Save" onClick={onSave} loading={saving}>
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </SectionCard>
  )
}

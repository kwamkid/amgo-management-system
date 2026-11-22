'use client'

// New plan (or copy of a template) — brand, name, period. Everything else is edited on the แผน tab.

import { useState } from 'react'
import { addDays, format } from 'date-fns'
import { Button, DatePicker, Field, Input, Modal, SelectMenu, type SelectOption } from '@/components/aoo'
import { useToast } from '@/hooks/useToast'
import { createPlan } from '@/lib/services/marketingService'
import { PLAN_TEMPLATES, applyTemplate } from '@/lib/marketing/templates'

export default function PlanFormModal({
  open,
  onClose,
  brandOptions,
  brand: fixedBrand,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  brandOptions: SelectOption[]
  /** fixed brand (brand page) — hides the brand picker */
  brand?: string
  onCreated: (planId: string, brand: string) => void
}) {
  const { showToast } = useToast()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [brand, setBrand] = useState<string | null>(fixedBrand ?? null)
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(format(addDays(new Date(), 89), 'yyyy-MM-dd'))
  const [template, setTemplate] = useState<string | null>('blank')
  const [saving, setSaving] = useState(false)

  const b = fixedBrand ?? brand
  const ok = !!b && title.trim().length > 0 && !!start && !!end && end >= start

  const save = async () => {
    if (!ok || !b) return
    setSaving(true)
    try {
      const tpl = PLAN_TEMPLATES.find((t) => t.key === template)
      const id = await createPlan({
        brand: b,
        title,
        startDate: start,
        endDate: end,
        status: 'draft',
        goal: tpl?.goal ?? '',
        budget: null,
        channels: tpl?.channels ?? [],
        keyDates: [],
        phases: tpl?.phases ?? [
          { key: 'P0', label: 'เตรียมก่อนเปิด' },
          { key: 'P1', label: 'เปิดตัว' },
          { key: 'P2', label: 'ต่อเนื่อง' },
        ],
      })
      if (tpl && tpl.key !== 'blank') await applyTemplate(tpl, id, b, start)
      onCreated(id, b)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="สร้างแผนการตลาด"
      maxWidth={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={!ok} loading={saving}>
            สร้างแผน
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedBrand && (
          <Field label="แบรนด์" required asDiv>
            <SelectMenu value={brand} options={brandOptions} onChange={setBrand} placeholder="เลือกแบรนด์" />
          </Field>
        )}
        <Field label="ชื่อแผน" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น เปิดตัว J'adore · แคมเปญ 12.12" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="เริ่ม" required asDiv>
            <DatePicker value={start} onChange={setStart} />
          </Field>
          <Field label="จบ" required asDiv error={end < start ? 'วันจบต้องไม่ก่อนวันเริ่ม' : undefined}>
            <DatePicker value={end} onChange={setEnd} min={start} />
          </Field>
        </div>
        <Field label="เริ่มจากเทมเพลต" asDiv help="เทมเพลตจะสร้างช่วงของแผน เป้า KPI และรายการงานตั้งต้นให้ แก้ได้ทีหลัง">
          <SelectMenu
            value={template}
            options={PLAN_TEMPLATES.map((t) => ({ value: t.key, label: t.label, hint: t.hint }))}
            onChange={setTemplate}
          />
        </Field>
      </div>
    </Modal>
  )
}

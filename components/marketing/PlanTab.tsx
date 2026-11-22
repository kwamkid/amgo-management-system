'use client'

// แผน tab — goal, period, budget, channels, key dates, phases. One screen, one save.

import { useEffect, useState } from 'react'
import { CircleDashed, CircleDot, CheckCircle2, Plus, Trash2, X } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  DatePicker,
  Field,
  IconButton,
  Input,
  MoneyInput,
  MultiSelectMenu,
  StepSelect,
  Textarea,
} from '@/components/aoo'
import { SectionCard } from '@/components/shared'
import { useToast } from '@/hooks/useToast'
import { CHANNELS, deletePlan, updatePlan, type KeyDate, type Phase, type Plan, type PlanStatus } from '@/lib/services/marketingService'
import { thDateShort } from './format'

const STATUS_STEPS = [
  { value: 'draft', label: 'ร่าง', icon: CircleDashed, tone: 'warning' as const },
  { value: 'active', label: 'กำลังใช้', icon: CircleDot, tone: 'success' as const },
  { value: 'done', label: 'จบแล้ว', icon: CheckCircle2, tone: 'grape' as const },
]

export default function PlanTab({ plan, onSaved, onDeleted }: { plan: Plan; onSaved: () => void; onDeleted: () => void }) {
  const { showToast } = useToast()
  const [f, setF] = useState(plan)
  const [newDate, setNewDate] = useState<KeyDate>({ date: '', label: '' })
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => setF(plan), [plan])
  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => setF((p) => ({ ...p, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(plan)

  const save = async () => {
    if (!f.title.trim()) return showToast('ใส่ชื่อแผนก่อน', 'error')
    if (f.endDate < f.startDate) return showToast('วันจบต้องไม่ก่อนวันเริ่ม', 'error')
    setSaving(true)
    try {
      await updatePlan(plan.id, {
        title: f.title,
        startDate: f.startDate,
        endDate: f.endDate,
        status: f.status,
        goal: f.goal,
        budget: f.budget,
        channels: f.channels,
        keyDates: f.keyDates,
        phases: f.phases.filter((p) => p.label.trim()),
      })
      showToast('บันทึกแผนแล้ว', 'success')
      onSaved()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const addDate = () => {
    if (!newDate.date || !newDate.label.trim()) return
    set('keyDates', [...f.keyDates, { date: newDate.date, label: newDate.label.trim() }].sort((a, b) => a.date.localeCompare(b.date)))
    setNewDate({ date: '', label: '' })
  }

  const addPhase = () => {
    const n = f.phases.length
    set('phases', [...f.phases, { key: `P${n}`, label: '' }])
  }
  const setPhase = (i: number, label: string) => set('phases', f.phases.map((p, j) => (j === i ? { ...p, label } : p)))

  return (
    <div className="space-y-4">
      <SectionCard title="ภาพรวมแผน">
        <div className="space-y-4">
          <Field label="สถานะ" asDiv>
            <StepSelect value={f.status} options={STATUS_STEPS} onChange={(v) => set('status', v as PlanStatus)} />
          </Field>
          <Field label="ชื่อแผน" required>
            <Input value={f.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="เริ่ม" asDiv>
              <DatePicker value={f.startDate} onChange={(v) => set('startDate', v)} />
            </Field>
            <Field label="จบ" asDiv>
              <DatePicker value={f.endDate} onChange={(v) => set('endDate', v)} min={f.startDate} />
            </Field>
            <Field label="งบทั้งแผน" asDiv>
              <MoneyInput value={f.budget ?? ''} onValueChange={(v, t) => set('budget', t.trim() ? v : null)} suffix="฿" />
            </Field>
          </div>
          <Field label="เป้าหมาย" help="อยากได้อะไรจากแผนนี้ เขียนสั้น ๆ ให้ทีมอ่านแล้วเข้าใจตรงกัน">
            <Textarea rows={3} value={f.goal} onChange={(e) => set('goal', e.target.value)} />
          </Field>
          <Field label="ช่องทางที่ใช้" asDiv>
            <MultiSelectMenu
              values={f.channels}
              onChange={(v) => set('channels', v)}
              options={CHANNELS.filter((c) => c.value !== 'all')}
              placeholder="เลือกช่องทาง"
              summary={(n) => `${n} ช่องทาง`}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="วันสำคัญ / แคมเปญ" description="เช่น 12.12 · วันเด็ก · วันเปิดตัว · Live ใหญ่">
          <div className="divide-y divide-gray-100">
            {f.keyDates.length === 0 && <p className="py-2 text-xs text-gray-400">ยังไม่มีวันสำคัญ</p>}
            {f.keyDates.map((d, i) => (
              <div key={`${d.date}-${i}`} className="flex items-center gap-3 py-2">
                <span className="w-24 shrink-0 text-xs text-gray-500">{thDateShort(d.date)}</span>
                <span className="min-w-0 flex-1 truncate text-gray-700">{d.label}</span>
                <IconButton
                  icon={X}
                  aria-label="ลบวันนี้"
                  tone="danger"
                  onClick={() => set('keyDates', f.keyDates.filter((_, j) => j !== i))}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr_auto]">
            <DatePicker value={newDate.date} onChange={(v) => setNewDate((d) => ({ ...d, date: v }))} placeholder="วันที่" />
            <Input
              value={newDate.label}
              onChange={(e) => setNewDate((d) => ({ ...d, label: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && addDate()}
              placeholder="ชื่อวัน / แคมเปญ"
            />
            <Button variant="secondary" icon={Plus} onClick={addDate} disabled={!newDate.date || !newDate.label.trim()}>
              เพิ่ม
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="ช่วงของแผน" description="งานใน Action plan จัดกลุ่มตามช่วงเหล่านี้">
          <div className="space-y-2">
            {f.phases.map((p: Phase, i) => (
              <div key={p.key} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-xs font-semibold text-gray-500">{p.key}</span>
                <Input value={p.label} onChange={(e) => setPhase(i, e.target.value)} placeholder="ชื่อช่วง" />
              </div>
            ))}
          </div>
          <Button variant="ghost" icon={Plus} className="mt-2" onClick={addPhase}>
            เพิ่มช่วง
          </Button>
        </SectionCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="danger" icon={Trash2} onClick={() => setConfirmDel(true)}>
          ลบแผน
        </Button>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => setF(plan)}>
              ยกเลิกที่แก้
            </Button>
          )}
          <Button onClick={save} disabled={!dirty} loading={saving}>
            บันทึกแผน
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        title={`ลบแผน "${plan.title}"?`}
        description="เป้า KPI ของแผนจะถูกลบด้วย ส่วนงานใน Action plan ยังอยู่ในหน้างานของทีม (แค่ไม่ผูกกับแผนแล้ว)"
        confirmLabel="ลบแผน"
        tone="danger"
        onClose={() => setConfirmDel(false)}
        onConfirm={async () => {
          try {
            await deletePlan(plan.id)
            setConfirmDel(false)
            onDeleted()
          } catch (e) {
            showToast((e as Error).message, 'error')
          }
        }}
      />
    </div>
  )
}

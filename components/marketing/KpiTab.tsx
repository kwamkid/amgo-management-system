'use client'

// KPI tab — target vs actual per metric × channel over the plan period, weekly trend of the picked row.
// auto = filled by the daily sync (aoocommerce sales · aoosocial social) · manual = typed in here
// (Shopee/Lazada ad spend, ROAS — no source yet).

import { useMemo, useState } from 'react'
import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { PenLine, Plus, Trash2 } from 'lucide-react'
import { Button, DatePicker, EmptyState, Field, IconButton, MoneyInput, Modal, Pill, Progress, SelectMenu } from '@/components/aoo'
import { SectionCard, TrendChart } from '@/components/shared'
import { useToast } from '@/hooks/useToast'
import {
  AUTO_METRICS,
  CHANNELS,
  METRICS,
  actualFor,
  deleteTarget,
  elapsedShare,
  paceTone,
  saveManualMetric,
  todayTh,
  upsertTarget,
  type Metric,
  type MetricRow,
  type Plan,
  type Target,
} from '@/lib/services/marketingService'
import { fmtMetric } from './format'

export default function KpiTab({
  plan,
  targets,
  metrics,
  onChanged,
}: {
  plan: Plan
  targets: Target[]
  metrics: MetricRow[]
  onChanged: () => void
}) {
  const { showToast } = useToast()
  const elapsed = elapsedShare(plan)
  const [picked, setPicked] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [entry, setEntry] = useState<Target | null>(null)
  const sel = targets.find((t) => t.id === picked) ?? targets[0] ?? null

  const saveTarget = async (t: Target, target: number) => {
    if (target === t.target) return
    try {
      await upsertTarget({ ...t, target })
      onChanged()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  // weekly buckets of the selected row (sum, or last/avg like the total)
  const weekly = useMemo(() => {
    if (!sel) return []
    const out: { date: string; value: number | null }[] = []
    let w = startOfWeek(parseISO(plan.startDate), { weekStartsOn: 1 })
    const end = parseISO(plan.endDate)
    const today = todayTh()
    while (w <= end) {
      const since = format(w, 'yyyy-MM-dd')
      const until = format(addDays(w, 6), 'yyyy-MM-dd')
      const rows = metrics.filter((r) => r.date >= since && r.date <= until)
      out.push({ date: since, value: since > today ? null : actualFor(rows, sel.metric, sel.channel) })
      w = addDays(w, 7)
    }
    return out
  }, [sel, metrics, plan.startDate, plan.endDate])

  return (
    <div className="space-y-4">
      <SectionCard
        title={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>เป้ากับตัวเลขจริง</span>
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
              เพิ่มเป้า
            </Button>
          </div>
        }
        description={`นับตั้งแต่วันเริ่มแผนถึงวันนี้ · เวลาผ่านไป ${Math.round(elapsed * 100)}% ของแผน`}
      >
        {targets.length === 0 ? (
          <EmptyState size="sm" title="ยังไม่มีเป้า" body="กด เพิ่มเป้า เพื่อตั้ง KPI ของแผนนี้" />
        ) : (
          <div className="divide-y divide-gray-100">
            {targets.map((t) => {
              const a = actualFor(metrics, t.metric, t.channel)
              const prog = a == null || t.target <= 0 ? null : a / t.target
              const tone = paceTone(prog, elapsed)
              return (
                <div
                  key={t.id}
                  className="grid cursor-pointer grid-cols-1 items-center gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_150px_140px_72px]"
                  data-selected={sel?.id === t.id || undefined}
                  onClick={() => setPicked(t.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`truncate ${sel?.id === t.id ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
                        {fmtMetric.label(t.metric, t.channel)}
                      </span>
                      <Pill tone={t.source === 'manual' ? 'warning' : 'grape'}>{t.source === 'manual' ? 'กรอกเอง' : 'ดึงอัตโนมัติ'}</Pill>
                    </div>
                    <Progress
                      value={Math.min(100, Math.round((prog ?? 0) * 100))}
                      tone={tone === 'neutral' ? 'accent' : tone}
                      className="mt-2"
                    />
                  </div>
                  <div className="text-right text-xs sm:text-sm">
                    <div className="font-semibold text-gray-800">{a == null ? '—' : fmtMetric.value(t.metric, a)}</div>
                    <div className="text-gray-400">{prog == null ? (a == null ? 'ยังไม่มีตัวเลข' : '') : `${Math.round(prog * 100)}% ของเป้า`}</div>
                  </div>
                  <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                    <span className="mb-0.5 block text-xs text-gray-400 sm:text-right">เป้าทั้งแผน</span>
                    <MoneyInput
                      className="w-full"
                      variant="cell"
                      value={t.target}
                      decimals={t.metric === 'roas' ? 2 : 0}
                      onValueChange={() => {}}
                      onBlur={(e) => saveTarget(t, Number(e.currentTarget.value.replace(/,/g, '')) || 0)}
                      aria-label="เป้า"
                    />
                  </div>
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {t.source === 'manual' && <IconButton icon={PenLine} title="กรอกตัวเลข" onClick={() => setEntry(t)} />}
                    <IconButton
                      icon={Trash2}
                      tone="danger"
                      title="ลบเป้านี้"
                      onClick={async () => {
                        try {
                          await deleteTarget(t.id)
                          onChanged()
                        } catch (e) {
                          showToast((e as Error).message, 'error')
                        }
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {sel && (
        <SectionCard title={`รายสัปดาห์ · ${fmtMetric.label(sel.metric, sel.channel)}`} description="กดแถวด้านบนเพื่อเปลี่ยนกราฟ">
          <TrendChart points={weekly} bucket="week" tone="grape" format={(v) => fmtMetric.value(sel.metric, v)} label={fmtMetric.label(sel.metric, sel.channel)} />
        </SectionCard>
      )}

      <p className="text-xs text-gray-400">
        ตัวเลขที่ดึงอัตโนมัติ: ยอดขายจาก aoocommerce · ผู้ติดตาม/reach/ยอดวิว/โพสต์จาก aoosocial — อัปเดตวันละครั้ง (Instagram มีแค่ผู้ติดตาม)
      </p>

      {adding && <AddTargetModal plan={plan} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChanged() }} />}
      {entry && <ManualEntryModal plan={plan} target={entry} onClose={() => setEntry(null)} onSaved={() => { setEntry(null); onChanged() }} />}
    </div>
  )
}

function AddTargetModal({ plan, onClose, onSaved }: { plan: Plan; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast()
  const [metric, setMetric] = useState<string | null>('sales_thb')
  const [channel, setChannel] = useState<string | null>('all')
  const [target, setTarget] = useState(0)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!metric || !channel) return
    setSaving(true)
    try {
      await upsertTarget({
        planId: plan.id,
        metric: metric as Metric,
        channel,
        target,
        source: AUTO_METRICS.includes(metric as Metric) ? 'auto' : 'manual',
      })
      onSaved()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มเป้า KPI"
      maxWidth={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} loading={saving} disabled={!metric || !channel}>
            บันทึก
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="วัดอะไร" asDiv>
          <SelectMenu
            value={metric}
            onChange={setMetric}
            options={METRICS.map((m) => ({ value: m.value, label: m.label, hint: AUTO_METRICS.includes(m.value) ? 'ดึงอัตโนมัติ' : 'กรอกเอง' }))}
          />
        </Field>
        <Field label="ช่องทาง" asDiv>
          <SelectMenu value={channel} onChange={setChannel} options={CHANNELS} />
        </Field>
        <Field label="เป้าทั้งแผน" asDiv help="ผู้ติดตาม = จำนวน ณ วันจบแผน · ROAS = ค่าเฉลี่ย · อื่น ๆ = รวมทั้งแผน">
          <MoneyInput value={target} onValueChange={(v) => setTarget(v)} decimals={metric === 'roas' ? 2 : 0} />
        </Field>
      </div>
    </Modal>
  )
}

function ManualEntryModal({ plan, target, onClose, onSaved }: { plan: Plan; target: Target; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast()
  const today = todayTh()
  const [date, setDate] = useState(today < plan.endDate ? today : plan.endDate)
  const [value, setValue] = useState(0)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await saveManualMetric(plan.brand, target.metric, target.channel, date, value)
      onSaved()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`กรอก ${fmtMetric.label(target.metric, target.channel)}`}
      description="กรอกเป็นยอดของวันนั้น (หรือยอดรวมทั้งสัปดาห์ใส่วันสุดท้ายของสัปดาห์ก็ได้) · กรอกวันเดิมซ้ำ = แทนค่าเดิม"
      maxWidth={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} loading={saving}>
            บันทึก
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="วันที่" asDiv>
          <DatePicker value={date} onChange={setDate} min={plan.startDate} max={plan.endDate} />
        </Field>
        <Field label="ตัวเลข" asDiv>
          <MoneyInput value={value} onValueChange={(v) => setValue(v)} decimals={target.metric === 'roas' ? 2 : 0} />
        </Field>
      </div>
    </Modal>
  )
}

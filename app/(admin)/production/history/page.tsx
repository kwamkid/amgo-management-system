'use client'

// ประวัติการผลิต — batch ย้อนหลัง + yield %
//
// yield % = ลิตรที่กรอกขวดได้จริง ÷ กก.วัตถุดิบหลักที่ใช้จริง × 100
// (ส้ม 100 กก. ได้น้ำ 60 ลิตร = 60%) — กดแถวดูรายละเอียดตามสูตร/ใช้จริง

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { History } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Button, Modal } from '@/components/aoo'
import {
  DataTable,
  FilterCard,
  FilterField,
  PageHeader,
  Skeleton,
  StatCard,
  StatGrid,
  TechLoader,
  type Column,
} from '@/components/shared'
import {
  deleteBatch,
  getBatches,
  UNIT_TH,
  type ProductionBatch,
  type RecipeUnit,
} from '@/lib/services/productionService'

export default function ProductionHistoryPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const now = new Date()
  const [range, setRange] = useState({
    start: format(startOfMonth(now), 'yyyy-MM-dd'),
    end: format(endOfMonth(now), 'yyyy-MM-dd'),
  })
  const [batches, setBatches] = useState<ProductionBatch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ProductionBatch | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = userData?.role === 'admin'
  const canSee = !!userData && (isAdmin || userData.jobFunctionCode === 'production')

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = () => {
    setLoading(true)
    getBatches(range.start, range.end)
      .then(setBatches)
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (canSee) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee, range])

  const totals = useMemo(() => {
    const list = batches ?? []
    const liters = list.reduce((s, b) => s + b.outputMl, 0) / 1000
    const bottles = list.reduce((s, b) => s + b.bottles.reduce((x, y) => x + y.count, 0), 0)
    const baseKg = list.reduce((s, b) => s + (b.yieldBaseKg ?? 0), 0)
    const yieldMl = list.filter((b) => b.yieldBaseKg).reduce((s, b) => s + b.outputMl, 0)
    return {
      count: list.length,
      liters: Math.round(liters * 10) / 10,
      bottles,
      // yield เฉลี่ยถ่วงน้ำหนัก — รวมลิตร ÷ รวม กก. (เฉพาะ batch ที่มีวัตถุดิบหลัก)
      avgYield: baseKg > 0 ? Math.round((yieldMl / 1000 / baseKg) * 1000) / 10 : null,
    }
  }, [batches])

  const remove = async (id: string) => {
    if (!confirm('ลบบันทึกนี้ทิ้งเลยไหม?')) return
    setDeleting(true)
    try {
      await deleteBatch(id)
      showToast('ลบแล้ว', 'success')
      setSelected(null)
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ลบไม่สำเร็จ', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<ProductionBatch>[] = [
    {
      key: 'date',
      header: 'วันที่',
      cell: (b) => format(parseISO(b.batchDate), 'd MMM yy', { locale: th }),
      sortValue: (b) => b.batchDate,
      mobilePrimary: true,
    },
    {
      key: 'recipe',
      header: 'สูตร',
      cell: (b) => <span className="font-medium">{b.recipeName}</span>,
      sortValue: (b) => b.recipeName,
      mobilePrimary: true,
    },
    {
      key: 'planned',
      header: 'แผน (ลิตร)',
      align: 'right',
      cell: (b) => b.litersPlanned.toLocaleString(),
      sortValue: (b) => b.litersPlanned,
      mobileLabel: 'แผน',
    },
    {
      key: 'output',
      header: 'ได้จริง (ลิตร)',
      align: 'right',
      cell: (b) => <span className="tabular-nums font-semibold">{(b.outputMl / 1000).toLocaleString()}</span>,
      sortValue: (b) => b.outputMl,
      mobileLabel: 'ได้จริง',
    },
    {
      key: 'baseKg',
      header: 'วัตถุดิบหลัก (กก.)',
      align: 'right',
      cell: (b) => (b.yieldBaseKg === null ? '—' : b.yieldBaseKg.toLocaleString()),
      sortValue: (b) => b.yieldBaseKg ?? -1,
      mobileLabel: 'กก.',
    },
    {
      key: 'yield',
      header: '% น้ำที่ได้ (yield)',
      align: 'right',
      cell: (b) =>
        b.yieldPercent === null ? (
          '—'
        ) : (
          <span className="tabular-nums font-semibold text-red-600">{b.yieldPercent}%</span>
        ),
      sortValue: (b) => b.yieldPercent ?? -1,
      mobileLabel: '% น้ำที่ได้',
    },
    {
      key: 'by',
      header: 'ผู้ผสม',
      cell: (b) => b.madeByName,
      sortValue: (b) => b.madeByName,
    },
  ]

  if (!userData || batches === null) return <TechLoader />
  if (!canSee) return null

  return (
    <div className="space-y-6">
      <PageHeader
        icon={History}
        title="ประวัติการผลิต"
        description="ผลิตอะไรไปเท่าไหร่ ใช้วัตถุดิบจริงแค่ไหน ได้ yield กี่ % — กดแถวดูรายละเอียด"
      />

      <FilterCard>
        <FilterField label="ช่วงเวลา">
          <DateRangePicker
            startDate={range.start}
            endDate={range.end}
            onChange={(start, end) => setRange({ start, end })}
          />
        </FilterField>
      </FilterCard>

      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="จำนวน batch" value={totals.count.toLocaleString()} />
            <StatCard label="ได้น้ำรวม (ลิตร)" value={totals.liters.toLocaleString()} />
            <StatCard label="ขวดรวม" value={totals.bottles.toLocaleString()} />
            <StatCard
              label="% น้ำที่ได้เฉลี่ย (yield)"
              value={totals.avgYield === null ? '—' : `${totals.avgYield}%`}
              tone={totals.avgYield === null ? undefined : 'danger'}
            />
          </StatGrid>

          <DataTable
            columns={columns}
            rows={batches}
            rowKey={(b) => b.id}
            onRowClick={(b) => setSelected(b)}
            emptyTitle="ไม่มีบันทึกการผลิตในช่วงนี้"
          />
        </>
      )}

      {/* รายละเอียด batch — ตามสูตร vs ใช้จริง + ขวด */}
      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={selected.recipeName}
          description={`${format(parseISO(selected.batchDate), 'EEEE d MMMM yyyy', { locale: th })} · ${selected.madeByName}`}
          maxWidth={480}
          footer={
            isAdmin ? (
              <Button type="button" variant="danger" onClick={() => remove(selected.id)} disabled={deleting}>
                {deleting ? 'กำลังลบ…' : 'ลบบันทึกนี้'}
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-4 text-sm">
            {selected.juiceBrix !== null && (
              <div className="rounded-lg bg-sky-50 p-3 text-sky-800">
                วัดได้: น้ำคั้น{' '}
                <strong className="tabular-nums">{selected.juiceLiters?.toLocaleString()} ลิตร</strong>
                {' '}· Brix <strong className="tabular-nums">{selected.juiceBrix}</strong>
              </div>
            )}
            <div>
              <div className="mb-1 font-semibold text-gray-700">
                ส่วนผสม (แผน {selected.litersPlanned.toLocaleString()} ลิตร)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="py-1 font-normal">ชื่อ</th>
                    <th className="py-1 text-right font-normal">ตามสูตร</th>
                    <th className="py-1 text-right font-normal">ใช้จริง</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((i, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="py-1.5">
                        {i.name}
                        {i.isYieldBase && (
                          <span className="ml-1.5 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-semibold text-orange-700">
                            yield
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-500">
                        {i.plannedQty.toLocaleString()} {UNIT_TH[i.unit as RecipeUnit] ?? i.unit}
                      </td>
                      <td
                        className={`py-1.5 text-right tabular-nums font-medium ${
                          i.actualQty !== i.plannedQty ? 'text-orange-600' : ''
                        }`}
                      >
                        {i.actualQty.toLocaleString()} {UNIT_TH[i.unit as RecipeUnit] ?? i.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="mb-1 font-semibold text-gray-700">ขวดที่ได้</div>
              {selected.bottles.length === 0 ? (
                <p className="text-gray-400">ไม่ได้กรอกจำนวนขวด</p>
              ) : (
                <div className="space-y-0.5">
                  {selected.bottles.map((b, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{b.label}</span>
                      <span className="tabular-nums font-medium">{b.count.toLocaleString()} ขวด</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-gray-100 pt-1 font-semibold">
                    <span>รวม</span>
                    <span className="tabular-nums">{(selected.outputMl / 1000).toLocaleString()} ลิตร</span>
                  </div>
                </div>
              )}
            </div>

            {selected.yieldPercent !== null && (
              <div className="rounded-lg bg-gray-50 p-3">
                ผลไม้ {selected.yieldBaseKg?.toLocaleString()} กก. → ได้น้ำ{' '}
                {(selected.outputMl / 1000).toLocaleString()} ลิตร ={' '}
                <strong className="text-red-600">ได้น้ำ {selected.yieldPercent}% ของผลไม้</strong> (yield)
              </div>
            )}

            {selected.note && <p className="text-gray-500">หมายเหตุ: {selected.note}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}

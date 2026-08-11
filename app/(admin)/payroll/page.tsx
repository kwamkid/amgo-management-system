'use client'

// สรุปเงินเดือนรายเดือน — หน้าคล้าย excel: ระบบเติมข้อมูลจริงให้ก่อน
// (เงินเดือน วันมา/ขาด ชั่วโมง OT) แล้ว HR กรอกค่าคอม/เงินพิเศษ/หัก
// รวมเป็นยอดโอนต่อคน → export CSV ขึ้นระบบธนาคาร

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, addMonths } from 'date-fns'
import { th } from 'date-fns/locale'
import { Wallet, ChevronLeft, ChevronRight, Download, Save, CopyPlus, Calculator, Search, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { createClient } from '@/lib/supabase/client'
import { Button, Modal, MoneyInput, SelectMenu } from '@/components/aoo'
import { PageHeader, TechLoader } from '@/components/shared'
import {
  loadPayroll,
  loadAttendanceDays,
  loadOtHours,
  savePayroll,
  loadPreviousExtras,
  payrollCsv,
  payrollTotal,
  standardOtRate,
  calcVariablePay,
  type PayrollRow,
} from '@/lib/services/payrollService'
import UserScheduleDialog from '@/components/users/UserScheduleDialog'

const baht = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// เพดานขั้นบันได — เลขกลม ไม่ต้องมีทศนิยม
const wholeBaht = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })

export default function PayrollPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  // กดชื่อพนักงาน → แก้ตารางวันทำงาน (วันทำงาน/สัปดาห์ · วันหยุดประจำ) ได้ตรงนี้เลย
  const [scheduleFor, setScheduleFor] = useState<{ userId: string; name: string } | null>(null)

  // dialog กรอกยอดขาย/จำนวนชิ้นของคนที่มีค่าคอมขั้นบันได/ค่าชิ้นงาน
  // ยอดที่พิมพ์ค้างใน draft จนกด "ใส่ในช่องค่าคอม" ค่อยลงแถวจริง
  const [calcUserId, setCalcUserId] = useState<string | null>(null)
  const [calcDraft, setCalcDraft] = useState<Record<string, number>>({})

  // ตัวกรอง ตำแหน่ง/บริษัท/ชื่อ — กรองเฉพาะการแสดงผลกับไฟล์ export
  // ปุ่มบันทึกยังบันทึกทุกแถวเหมือนเดิม แถวที่ถูกซ่อนไม่หาย
  const [fnFilter, setFnFilter] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [fnOptions, setFnOptions] = useState<{ value: string; label: string }[]>([])
  const [companyOptions, setCompanyOptions] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    const sbc = createClient()
    sbc.from('job_functions').select('id, name_th').eq('is_active', true).order('sort_order')
      .then(({ data }) => setFnOptions((data ?? []).map((j) => ({ value: j.id, label: j.name_th }))))
    sbc.from('companies').select('id, code, name_th').order('code')
      .then(({ data }) =>
        setCompanyOptions((data ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name_th}` })))
      )
  }, [])

  useEffect(() => {
    if (userData && userData.role !== 'hr' && userData.role !== 'admin') {
      router.push('/unauthorized')
    }
  }, [userData, router])

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      setRows(await loadPayroll(month))
      setDirty(false)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  useEffect(() => {
    reload()
  }, [reload])

  // หลังแก้ตารางเวรจาก dialog — รีเฟรชเฉพาะเลขมา/ขาด ไม่โหลดทั้งหน้า
  // (ค่าคอม/เงินพิเศษที่พิมพ์ค้างอยู่ต้องไม่หาย)
  const refreshAttendance = async () => {
    try {
      const att = await loadAttendanceDays(month)
      let changed = false
      setRows((prev) =>
        prev.map((r) => {
          const a = att.get(r.userId)
          if (!a || (a.work === r.workDays && a.absent === r.absentDays)) return r
          changed = true
          return { ...r, workDays: a.work, absentDays: a.absent }
        })
      )
      if (changed) setDirty(true)
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  /**
   * ดึงเลขที่ระบบเป็นเจ้าของ (วันมา/ขาด + ชั่วโมง OT ของคนมีสิทธิ์) มาทับ —
   * ใช้กรณีบันทึกกลางเดือนแล้วแถวถูกตรึง ข้อมูลใหม่ไม่ไหลเข้าเอง
   * ของที่กรอกมือ (เงินเดือน ค่าคอม พิเศษ หัก หมายเหตุ) ไม่ถูกแตะ
   * และ OT ที่พิมพ์เองให้คนไม่มีสิทธิ์ก็คงไว้
   */
  const refreshReality = async () => {
    try {
      const [att, ot] = await Promise.all([loadAttendanceDays(month), loadOtHours(month)])
      let changed = false
      setRows((prev) =>
        prev.map((r) => {
          const a = att.get(r.userId)
          const o = ot.has(r.userId) ? ot.get(r.userId)! : r.otHours
          const next = {
            ...r,
            workDays: a?.work ?? r.workDays,
            absentDays: a?.absent ?? r.absentDays,
            otHours: o,
          }
          if (
            next.workDays !== r.workDays ||
            next.absentDays !== r.absentDays ||
            next.otHours !== r.otHours
          ) {
            changed = true
            return next
          }
          return r
        })
      )
      if (changed) {
        setDirty(true)
        showToast('อัปเดตวันมา/ขาด และชั่วโมง OT จากข้อมูลจริงแล้ว — กดบันทึกเพื่อยืนยัน', 'success')
      } else {
        showToast('ตัวเลขตรงกับข้อมูลจริงอยู่แล้ว', 'success')
      }
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const patch = (userId: string, field: keyof PayrollRow, value: number | string) => {
    setDirty(true)
    setRows((prev) =>
      prev.map((r) => {
        if (r.userId !== userId) return r
        const next = { ...r, [field]: value }
        // แก้เงินเดือนแล้วอัตรา OT มาตรฐานขยับตาม (เฉพาะตอนยังใช้ค่ามาตรฐานอยู่)
        if (field === 'baseSalary' && r.otRate === standardOtRate(r.baseSalary)) {
          next.otRate = standardOtRate(Number(value))
        }
        return next
      })
    )
  }

  const save = async () => {
    try {
      setSaving(true)
      await savePayroll(month, rows, userData!.id!)
      showToast('บันทึกสรุปเงินเดือนแล้ว', 'success')
      setDirty(false)
      setRows((prev) => prev.map((r) => ({ ...r, saved: true })))
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const pullPrevious = async () => {
    try {
      const prev = await loadPreviousExtras(month)
      if (!prev.size) {
        showToast('เดือนก่อนยังไม่มีข้อมูลบันทึกไว้', 'error')
        return
      }
      setRows((rs) =>
        rs.map((r) => {
          const p = prev.get(r.userId)
          return p ? { ...r, commission: p.commission, extra: p.extra, note: p.note } : r
        })
      )
      setDirty(true)
      showToast(`ดึงค่าคอม/เงินพิเศษจากเดือนก่อนแล้ว (${prev.size} คน)`, 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  // แถวที่ผ่านตัวกรอง — ตาราง ยอดรวมท้ายตาราง และไฟล์โอนธนาคาร ใช้ชุดนี้
  const visible = useMemo(() => {
    const q = nameFilter.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!fnFilter || r.jobFunctionId === fnFilter) &&
        (!companyFilter || r.companyId === companyFilter) &&
        (!q || r.name.toLowerCase().includes(q))
    )
  }, [rows, fnFilter, companyFilter, nameFilter])
  const filtering = !!(fnFilter || companyFilter || nameFilter.trim())

  const exportCsv = () => {
    const blob = new Blob([payrollCsv(visible)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `payroll-${format(month, 'yyyy-MM')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const grandTotal = useMemo(() => visible.reduce((s, r) => s + payrollTotal(r), 0), [visible])

  if (loading && rows.length === 0) return <TechLoader />

  const num = (v: number) => (Number.isFinite(v) ? v : 0)
  const cell =
    'w-24 rounded-md border border-gray-200 px-2 py-1 text-right font-mono text-sm tabular-nums focus:border-red-300 focus:outline-none'

  return (
    <div className="space-y-5">
      <PageHeader
        title="สรุปเงินเดือน"
        description="รวมยอดที่ต้องโอนต่อคน — กรอกค่าคอม/เงินพิเศษ แล้ว export ไฟล์ขึ้นธนาคาร"
        icon={Wallet}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={refreshReality}
              title="ดึงวันมา/ขาด กับชั่วโมง OT ล่าสุดมาทับ — ของที่กรอกมือไม่ถูกแตะ"
            >
              <RefreshCw size={15} /> อัปเดตจากข้อมูลจริง
            </Button>
            <Button variant="secondary" size="sm" onClick={pullPrevious}>
              <CopyPlus size={15} /> ดึงค่าคอมเดือนก่อน
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download size={15} /> ไฟล์โอนธนาคาร
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              <Save size={15} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </>
        }
      />

      {/* เลือกเดือน */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-36 text-center font-medium">
          {format(month, 'MMMM yyyy', { locale: th })}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
        >
          <ChevronRight size={16} />
        </button>
        {dirty && (
          <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            แก้แล้ว ยังไม่บันทึก
          </span>
        )}

        {/* ตัวกรอง — มีผลกับตาราง ยอดรวม และไฟล์โอนธนาคาร */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="ค้นหาชื่อพนักงาน..."
              className="h-8 w-44 rounded-lg border border-gray-200 pl-8 pr-2 text-sm focus:border-red-300 focus:outline-none"
            />
          </div>
          <SelectMenu
            value={fnFilter}
            options={fnOptions}
            onChange={setFnFilter}
            placeholder="ทุกตำแหน่ง"
            clearable="ทุกตำแหน่ง"
            size="sm"
            className="w-44"
          />
          <SelectMenu
            value={companyFilter}
            options={companyOptions}
            onChange={setCompanyFilter}
            placeholder="ทุกบริษัท"
            clearable="ทุกบริษัท"
            size="sm"
            className="w-40"
          />
          {filtering && (
            <span className="text-xs text-gray-400">
              แสดง {visible.length} จาก {rows.length} คน
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">รหัส</th>
              <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">พนักงาน</th>
              <th className="border-b border-gray-200 px-3 py-2 text-center font-medium">มา/ขาด</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-medium">เงินเดือน</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-medium">OT (ชม.)</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-medium">OT/ชม.</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-medium">ค่าคอม</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-medium">พิเศษ</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-medium">หัก</th>
              <th className="border-b border-gray-200 px-3 py-2 text-right font-medium">รวมโอน</th>
              <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.userId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                <td className="px-3 py-1.5 font-mono text-gray-500 tabular-nums">
                  {r.employeeCode != null ? String(r.employeeCode).padStart(3, '0') : '-'}
                </td>
                <td className="max-w-48 truncate px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => setScheduleFor({ userId: r.userId, name: r.name })}
                    className="max-w-full truncate text-left hover:text-red-500 hover:underline"
                    title="กดเพื่อแก้ตารางวันทำงาน / วันหยุดประจำ"
                  >
                    {r.name}
                  </button>
                </td>
                <td className="px-3 py-1.5 text-center">
                  {/* มา X จากที่ควรมา Y ตามตารางของคนนั้น — ขาด = Y-X */}
                  <span className="whitespace-nowrap">
                    <span className="text-green-700">{r.workDays}</span>
                    <span className="text-gray-400">/{r.workDays + r.absentDays}</span>
                  </span>
                  {r.absentDays > 0 && (
                    <p className="text-xs font-semibold text-red-600">ขาด {r.absentDays}</p>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <MoneyInput
                    className={cell}
                    value={r.baseSalary || ''}
                    onValueChange={(n) => patch(r.userId, 'baseSalary', n)}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    className={`${cell} w-20`}
                    value={r.otHours || ''}
                    onChange={(e) => patch(r.userId, 'otHours', num(e.target.valueAsNumber))}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <MoneyInput
                    decimals={3}
                    className={`${cell} w-20`}
                    value={r.otRate || ''}
                    onValueChange={(n) => patch(r.userId, 'otRate', n)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center justify-end gap-1">
                    {r.variableItems.length > 0 && (
                      <button
                        type="button"
                        title="กรอกยอดขาย/จำนวนชิ้น ให้ระบบคิดค่าคอมตามกติกาของคนนี้"
                        onClick={() => {
                          setCalcDraft(r.variableInputs)
                          setCalcUserId(r.userId)
                        }}
                        className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Calculator size={15} />
                      </button>
                    )}
                    <MoneyInput
                      className={cell}
                      value={r.commission || ''}
                      onValueChange={(n) => patch(r.userId, 'commission', n)}
                    />
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <MoneyInput
                    className={`${cell} w-20`}
                    value={r.extra || ''}
                    onValueChange={(n) => patch(r.userId, 'extra', n)}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <MoneyInput
                    className={`${cell} w-20`}
                    value={r.deduction || ''}
                    onValueChange={(n) => patch(r.userId, 'deduction', n)}
                  />
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums">
                  {baht.format(payrollTotal(r))}
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    className="w-40 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-red-300 focus:outline-none"
                    value={r.note}
                    onChange={(e) => patch(r.userId, 'note', e.target.value)}
                    placeholder="—"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td colSpan={9} className="px-3 py-2 text-right">
                รวมยอดโอน{filtering ? 'ตามตัวกรอง' : 'ทั้งหมด'} (
                {visible.filter((r) => payrollTotal(r) > 0).length} คน)
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-red-700">
                {baht.format(grandTotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        เงินเดือน/วันมา-ขาด/ชั่วโมง OT/รายได้พิเศษยอดคงที่ ระบบเติมให้จากข้อมูลจริง ·
        คนที่มีค่าคอมขั้นบันได/ค่าชิ้นงาน กดไอคอนเครื่องคิดเลขในช่องค่าคอม
        เพื่อกรอกยอดขาย/จำนวนชิ้นแล้วระบบคิดให้ — หรือกด &quot;ดึงค่าคอมเดือนก่อน&quot; /
        กรอกเอง · ไฟล์โอนธนาคารมี รหัส ชื่อ ธนาคาร เลขบัญชี และยอดโอนของทุกคนที่ยอดมากกว่า 0
        · กดชื่อพนักงานเพื่อแก้ตารางวันทำงาน/วันหยุดประจำ
      </p>

      {scheduleFor && (
        <UserScheduleDialog
          userId={scheduleFor.userId}
          name={scheduleFor.name}
          onClose={() => {
            setScheduleFor(null)
            refreshAttendance()
          }}
        />
      )}

      {/* dialog กรอกยอดขาย/จำนวนชิ้น → คิดค่าคอมตามกติกาใน user_pay_items */}
      {(() => {
        const row = rows.find((r) => r.userId === calcUserId)
        if (!row) return null
        const total =
          Math.round(
            row.variableItems.reduce((s, it) => s + calcVariablePay(it, calcDraft[it.id] ?? 0), 0) *
              100
          ) / 100
        return (
          <Modal
            open
            onClose={() => setCalcUserId(null)}
            title={`ค่าคอม / ค่าชิ้นงาน — ${row.name}`}
            description="กรอกยอดของเดือนนี้ ระบบคิดเป็นเงินตามกติกาที่ตั้งไว้ในหน้าพนักงาน แท็บเงินเดือน"
            footer={
              <>
                <Button variant="ghost" onClick={() => setCalcUserId(null)}>
                  ยกเลิก
                </Button>
                <Button
                  onClick={() => {
                    setRows((prev) =>
                      prev.map((r) =>
                        r.userId === row.userId
                          ? { ...r, commission: total, variableInputs: { ...calcDraft } }
                          : r
                      )
                    )
                    setDirty(true)
                    setCalcUserId(null)
                  }}
                >
                  ใส่ในช่องค่าคอม {baht.format(total)}
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              {row.variableItems.map((it) => {
                const input = calcDraft[it.id] ?? 0
                const pay = calcVariablePay(it, input)
                return (
                  <div key={it.id}>
                    <p className="mb-0.5 text-sm font-medium text-gray-800">{it.label}</p>
                    {it.calc === 'tiered_percent' && it.tiers && (
                      <p className="mb-1.5 text-xs text-gray-400">
                        {it.tiers
                          .map((t) =>
                            t.upTo === null
                              ? `เกินจากนั้น ${t.percent}%`
                              : `ไม่เกิน ${wholeBaht.format(t.upTo)} ได้ ${t.percent}%`
                          )
                          .join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-sm text-gray-500">
                        {it.calc === 'per_piece' ? 'จำนวนชิ้น' : 'ยอดขาย (บาท)'}
                      </span>
                      <MoneyInput
                        value={input || ''}
                        decimals={it.calc === 'per_piece' ? 0 : 2}
                        onValueChange={(n) => setCalcDraft((d) => ({ ...d, [it.id]: n }))}
                        className="w-36 rounded-md border border-gray-200 px-2 py-1.5 text-right font-mono text-sm tabular-nums focus:border-red-300 focus:outline-none"
                      />
                      <span className="ml-auto font-mono text-sm tabular-nums text-gray-900">
                        = {baht.format(pay)}
                        {it.calc === 'per_piece' && (
                          <span className="ml-1 text-xs font-sans text-gray-400">
                            ({wholeBaht.format(it.amount)}/ชิ้น)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
              <p className="border-t border-gray-100 pt-2.5 text-right text-sm text-gray-700">
                รวม{' '}
                <span className="font-mono font-semibold tabular-nums text-gray-900">
                  {baht.format(total)}
                </span>{' '}
                บาท
              </p>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}

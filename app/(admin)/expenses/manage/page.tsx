'use client'

// จัดการใบเบิกค่าใช้จ่าย — ผู้จัดการ/แอดมินอนุมัติขั้นแรก · บัญชี/HR ขั้นสอง + จ่าย
//
// ไม่มีความสัมพันธ์หัวหน้า-ลูกน้องในระบบ ผู้จัดการคนไหนก็อนุมัติขั้นแรกได้ (แบบใบลา)
// ลำดับขั้นและ "อนุมัติใบตัวเองไม่ได้" ตรวจซ้ำในฟังก์ชัน SQL — หน้านี้แค่ซ่อนปุ่ม
//
// 3 พ.ย. 69: แท็บรอโอนรวมใบจ่าย supplier · เลือกหลายใบ → ส่งออกไฟล์โอน SCB (ตีตราส่งออกแล้ว
// กันโอนซ้ำ) → บันทึกจ่ายทั้งชุดพร้อมสลิปใบเดียว · ปุ่มสรุปสิ้นเดือนตามฟอร์มบัญชี

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'
import { FileSpreadsheet, FileUp, Receipt } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { SCB_PRODUCT_LABEL, isScbAccount, type ScbProduct } from '@/lib/services/bankTransferFile'
import { createClient } from '@/lib/supabase/client'
import {
  Alert,
  Button,
  Checkbox,
  IconChip,
  StatusTabs,
  DatePicker,
  EmptyState,
  Field,
  FileDropzone,
  Input,
  Modal,
  SelectMenu,
} from '@/components/aoo'
import { FilterBar, FilterSelect, PageHeader, SectionCard, Skeleton } from '@/components/shared'
import { SECTION_VISUAL, thb } from '@/components/expenses/expenseVisuals'
import ExpenseStatusPill from '@/components/expenses/ExpenseStatusPill'
import ClaimEditModal from '@/components/expenses/ClaimEditModal'
import ClaimDetailModal from '@/components/expenses/ClaimDetailModal'
import ClaimThumb, { useFirstReceiptUrls } from '@/components/expenses/ClaimThumb'
import {
  SECTION_BY_POPULARITY,
  SECTION_LABEL,
  SECTION_SHORT,
  clearExported,
  formSectionOf,
  countPending,
  financeDecide,
  listClaims,
  listClaimsForMonth,
  markExported,
  saveExportFile,
  listExportFiles,
  downloadExportFile,
  type ExportFile,
  markTransferred,
  type ExpenseClaim,
  type ExpenseStatus,
} from '@/lib/services/expenseService'

const thaiDate = (iso: string) => format(new Date(`${iso}T00:00:00`), 'd MMM yyyy', { locale: th })

/** 12 เดือนล่าสุด (เดือนนี้ก่อน) — ตัวเลือกสรุปสิ้นเดือน */
const recentMonths = () =>
  Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const value = format(d, 'yyyy-MM')
    return { value, label: format(d, 'MMMM yyyy', { locale: th }) }
  })

type Company = { id: string; code: string; name_th: string; name_en: string | null; logo_url: string | null; scb_debit_account: string | null }

// ขั้นโอน (เจ้าของ 3 พ.ย. 69): บัญชีอนุมัติ → รอส่งไฟล์ธนาคาร (เลือกบริษัท/คน/ใบ → export ไฟล์ SCB)
// → รอโอน (ส่งไฟล์แล้ว รอเจ้าของ approve ในแอปธนาคาร) → บัญชีแนบสลิป กดโอนแล้ว
// เจ้าของ 3 พ.ย. 69: เลิก "รวมกับเงินเดือน" — เบิกคืนโอนคืนอย่างเดียว (พนักงานอยากได้ไวสุด)
// อนุมัติรอบเดียวโดยบัญชี — ไม่มีขั้นผู้จัดการแล้ว (migration 20261103160000)
type Tab = 'finance' | 'export' | 'transfer' | 'done'

const TAB_STATUSES: Record<Tab, ExpenseStatus[]> = {
  finance: ['pending_finance'],
  export: ['approved'],
  transfer: ['approved'],
  done: ['paid', 'rejected'],
}

export default function ExpenseManagePage() {
  const { userData } = useAuth()
  const { showToast } = useToast()

  const role = userData?.role ?? ''
  const isFinance = role === 'hr' || role === 'admin' || userData?.jobFunctionCode === 'accountant'
  const canView = isFinance

  const [tab, setTab] = useState<Tab>('finance')
  const [rows, setRows] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // ไม่อนุมัติ / โอนแล้ว ต้องกรอกเพิ่ม — ใช้ modal เดียวสลับโหมด · โอนแล้วรับได้หลายใบ (ทั้งชุดไฟล์ SCB)
  const [dialog, setDialog] = useState<{ mode: 'reject' | 'paid'; claims: ExpenseClaim[] } | null>(null)
  // แท็บรอโอน: ใบที่ติ๊กเลือก
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // สรุปสิ้นเดือน
  const [companies, setCompanies] = useState<Company[]>([])
  const [reportOpen, setReportOpen] = useState(false)
  const [reportMonth, setReportMonth] = useState<string | null>(null)
  const [reportCompany, setReportCompany] = useState<string | null>(null)
  // ส่งออกไฟล์ SCB: 1 ไฟล์ = 1 บริษัท (บัญชีตัดเงินของบริษัทนั้น) · กรองบริษัท/คนในแท็บรอส่งไฟล์
  const [exportOpen, setExportOpen] = useState(false)
  const [exportCompany, setExportCompany] = useState<string | null>(null)
  // ตัวกรองด้านบน (FilterBar ตัวกลาง) — ใช้ได้ทุกช่อง · กดชื่อคนในแถว = กรองคนนั้น
  const [q, setQ] = useState('')
  const [fPerson, setFPerson] = useState<string | null>(null)
  const [fCompany, setFCompany] = useState<string | null>(null)
  const [fSection, setFSection] = useState<string | null>(null)
  const [debitAccount, setDebitAccount] = useState('')
  const [valueDate, setValueDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [product, setProduct] = useState<ScbProduct>('OAT')
  const [text, setText] = useState('')
  const [slip, setSlip] = useState<File | null>(null)
  // บัญชีเลือกวิธีจ่ายใหม่ได้ตอนอนุมัติ
  const [counts, setCounts] = useState<Awaited<ReturnType<typeof countPending>> | null>(null)
  // บัญชีแก้หมวด/รายละเอียดก่อนอนุมัติ/ก่อนโอน
  const [editing, setEditing] = useState<ExpenseClaim | null>(null)
  // ไฟล์โอนที่ส่งออกแล้ว (ดาวน์โหลดซ้ำ)
  const [filesOpen, setFilesOpen] = useState(false)
  const [exportFiles, setExportFiles] = useState<{ companyId: string | null; files: ExportFile[] }[]>([])
  // กดแถว → ดูรายละเอียด + รูป ก่อนอนุมัติ
  const [viewing, setViewing] = useState<ExpenseClaim | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      let list = await listClaims(TAB_STATUSES[tab], tab === 'done' ? 100 : 300)
      if (tab === 'export') list = list.filter((c) => c.payout === 'transfer' && !c.exportedAt)
      if (tab === 'transfer') list = list.filter((c) => c.payout === 'transfer' && !!c.exportedAt)
      setRows(list)
      setPicked(new Set())
      countPending().then(setCounts).catch(() => {})
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (canView) load()
  }, [canView, load])

  useEffect(() => {
    if (!canView) return
    createClient()
      .from('companies')
      .select('id, code, name_th, name_en, logo_url, scb_debit_account')
      .order('code')
      .then(({ data }) => setCompanies((data ?? []) as Company[]))
  }, [canView])


  const run = async (id: string, fn: () => Promise<void>, done: string) => {
    try {
      setBusy(id)
      await fn()
      showToast(done, 'success')
      setDialog(null)
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const confirmDialog = () => {
    if (!dialog) return
    const c = dialog.claims[0]
    if (dialog.mode === 'reject') {
      if (!text.trim()) {
        showToast('ใส่เหตุผลที่ไม่อนุมัติ', 'error')
        return
      }
      run(
        c.id,
        () => financeDecide(c, false, { reason: text }),
        'ไม่อนุมัติใบเบิกแล้ว'
      )
    } else {
      run(
        c.id,
        () => markTransferred(dialog.claims, userData!.id!, text, slip),
        `บันทึกว่าโอนแล้ว ${dialog.claims.length} ใบ`
      )
    }
  }

  // ── แท็บรอส่งไฟล์ / รอโอน ──
  const companyOf = (id: string | null) => companies.find((c) => c.id === id)
  // ผู้รับเงิน = supplier หรือพนักงานเจ้าของใบ — ใช้กรอง "ใบของใคร"
  const payeeOf = (c: ExpenseClaim) => (c.kind === 'supplier' ? c.payeeName ?? '' : c.userName)
  // แท็บรอส่งไฟล์: เห็นทีละบริษัท (1 ไฟล์ = 1 บริษัท) + กรองคนได้
  const matches = (c: ExpenseClaim) => {
    if (fPerson && c.userId !== fPerson) return false
    // ช่องรอส่งไฟล์เลือกบริษัทจากการ์ดโลโก้ (1 ไฟล์ = 1 บริษัท) — ไม่ใช้ตัวกรองบริษัทด้านบน
    if (tab !== 'export' && fCompany && c.companyId !== fCompany) return false
    if (fSection && formSectionOf(c.category, c.vatAmount) !== fSection) return false
    const t = q.trim().toLowerCase()
    if (t && ![c.description, c.userName, c.payeeName ?? ''].some((x) => x.toLowerCase().includes(t))) return false
    return true
  }
  const visible = rows.filter((c) => matches(c) && (tab !== 'export' || c.companyId === exportCompany))
  const people = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of rows) m.set(c.userId, c.userName)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'th')).map(([value, label]) => ({ value, label }))
  }, [rows])
  // คนที่กรองไว้ไม่มีใบในช่องนี้ → ล้างตัวกรอง (เดิมช่องโชว์ "ทุกคน" แต่ยังกรองอยู่ รายการเลยว่าง — 3 พ.ย. 69)
  useEffect(() => {
    if (!loading && fPerson && !people.some((p) => p.value === fPerson)) setFPerson(null)
  }, [loading, fPerson, people])
  const pickedRows = visible.filter((r) => picked.has(r.id))
  const thumbUrls = useFirstReceiptUrls(visible)
  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allPicked = visible.length > 0 && visible.every((r) => picked.has(r.id))
  const togglePickAll = () => setPicked(allPicked ? new Set() : new Set(visible.map((r) => r.id)))

  // บริษัทที่มีใบรอส่งไฟล์ (เรียงมากไปน้อย) — เปิดแท็บแล้วเลือกบริษัทแรกให้เอง
  const exportCompanies = useMemo(() => {
    const m = new Map<string | null, { count: number; amount: number }>()
    for (const c of rows) {
      const v = m.get(c.companyId) ?? { count: 0, amount: 0 }
      m.set(c.companyId, { count: v.count + 1, amount: v.amount + c.amount })
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [rows])
  useEffect(() => {
    if (tab !== 'export') return
    if (!exportCompanies.some(([id]) => id === exportCompany)) setExportCompany(exportCompanies[0]?.[0] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, exportCompanies])

  const openExport = () => {
    if (!pickedRows.length) {
      showToast('ติ๊กเลือกใบที่จะส่งออกก่อน', 'error')
      return
    }
    setDebitAccount(companyOf(exportCompany)?.scb_debit_account ?? '')
    setValueDate(format(new Date(), 'yyyy-MM-dd'))
    setExportOpen(true)
  }

  const exportTransfer = async () => {
    const target = pickedRows
    const account = debitAccount.replace(/\D/g, '')
    if (!isScbAccount(account)) {
      showToast('บัญชีตัดเงินต้องเป็นเลขบัญชี SCB 10 หลักที่ถูกต้อง', 'error')
      return
    }
    try {
      setBusy('export')
      // จำบัญชีตัดเงินไว้กับบริษัท — ครั้งหน้าไม่ต้องกรอก
      const company = companyOf(exportCompany)
      if (company && company.scb_debit_account !== account) {
        const { error } = await createClient().rpc('set_company_scb_debit_account', {
          p_company_id: company.id,
          p_account: account,
        })
        if (error) throw new Error(`บันทึกบัญชีตัดเงินไม่สำเร็จ: ${error.message}`)
        setCompanies((list) => list.map((c) => (c.id === company.id ? { ...c, scb_debit_account: account } : c)))
      }
      const { downloadTransferFile } = await import('@/lib/services/expenseExport')
      const res = await downloadTransferFile(target, { product, debitAccount: account, valueDate })
      if (res.includedIds.length) await markExported(res.includedIds, userData!.id!)
      // เก็บสำเนาไว้ดาวน์โหลดซ้ำ — เก็บไม่สำเร็จไม่ล้มทั้งงาน (ไฟล์ดาวน์โหลดไปแล้ว)
      if (res.file) saveExportFile(exportCompany, res.file).catch((e) => showToast((e as Error).message, 'error'))
      if (res.problems.length) {
        const name = (id: string) => payeeOf(rows.find((r) => r.id === id)!)
        showToast(
          `ไม่ได้ใส่ไฟล์ ${res.problems.length} ใบ: ${res.problems.map((p) => `${name(p.claimId)} (${p.reason})`).join(', ')}`,
          'error'
        )
      }
      setExportOpen(false)
      if (res.includedIds.length) {
        // ใบที่ส่งไฟล์แล้วย้ายไป "รอโอน" — รอเจ้าของ approve ในแอปธนาคาร แล้วบัญชีค่อยแนบสลิป
        showToast(
          `ส่งออก ${res.includedIds.length} ใบ รวม ${thb(res.total)} — อัปโหลดเข้า SCB แล้วรอ approve · ใบย้ายไป "รอโอน"`,
          'success'
        )
      }
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  // อนุมัติหลายใบทีเดียว — ข้ามใบของตัวเอง (SQL ห้ามอนุมัติใบตัวเองอยู่แล้ว)
  const approvePicked = async () => {
    const list = pickedRows.filter((c) => c.userId !== userData?.id)
    if (!list.length) {
      showToast('ใบที่เลือกเป็นของคุณเอง — ให้คนอื่นอนุมัติ', 'error')
      return
    }
    try {
      setBusy('bulk')
      for (const c of list) await financeDecide(c, true, { payout: 'transfer' })
      showToast(`อนุมัติแล้ว ${list.length} ใบ — ไปที่ "รอส่งไฟล์ธนาคาร" เพื่อ export`, 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(null)
      load()
    }
  }

  const openFiles = async () => {
    setFilesOpen(true)
    try {
      const ids: (string | null)[] = [...companies.map((c) => c.id), null]
      const lists = await Promise.all(ids.map(async (id) => ({ companyId: id, files: await listExportFiles(id) })))
      setExportFiles(lists.filter((l) => l.files.length))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const resetExported = () =>
    run('export', () => clearExported(pickedRows.map((r) => r.id)), 'ย้ายกลับไป "รอส่งไฟล์" แล้ว ส่งออกใหม่ได้')

  const downloadReport = async () => {
    if (!reportMonth) {
      showToast('เลือกเดือน', 'error')
      return
    }
    const company = companies.find((c) => c.id === reportCompany)
    try {
      setBusy('report')
      const claims = await listClaimsForMonth(reportMonth, reportCompany)
      if (!claims.length) {
        showToast('เดือนนี้ไม่มีใบที่อนุมัติแล้ว', 'error')
        return
      }
      const { downloadMonthlyReport } = await import('@/lib/services/expenseExport')
      await downloadMonthlyReport({
        month: reportMonth,
        companyName: company ? company.name_en || company.name_th : 'ทุกบริษัท',
        companyCode: company?.code ?? 'ALL',
        claims,
      })
      setReportOpen(false)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  if (!canView) {
    return (
      <Alert tone="error">
        <p className="font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <div>เฉพาะฝ่ายบัญชี HR และผู้ดูแลระบบ</div>
      </Alert>
    )
  }

  const mine = (c: ExpenseClaim) => c.userId === userData?.id

  return (
    <div className="space-y-4">
      <PageHeader
        title="อนุมัติ / โอนจ่าย"
        description="บัญชีอนุมัติ → ส่งไฟล์ SCB → เจ้าของ approve ในแอปธนาคาร → บัญชีแนบสลิป"
        icon={Receipt}
        actions={
          <>
          <Link href="/expenses">
            <Button size="sm" variant="ghost" icon={Receipt}>
              ใบเบิกของฉัน
            </Button>
          </Link>
          {isFinance && (
            <Button
              size="sm"
              variant="secondary"
              icon={FileSpreadsheet}
              onClick={() => {
                setReportMonth(recentMonths()[1].value)
                setReportCompany(null)
                setReportOpen(true)
              }}
            >
              สรุปสิ้นเดือน
            </Button>
          )}
          </>
        }
      />

      {/* แท็บขั้นตอน + จำนวน (แบบหน้าคำสั่งซื้อ aoo) — เห็นทันทีว่าขั้นไหนค้างกี่ใบ */}
      <StatusTabs
        fill
        ariaLabel="ขั้นตอน"
        activeKey={tab}
        onSelect={(k) => setTab(k as Tab)}
        tabs={[
          { key: 'finance', label: 'รออนุมัติ', count: counts?.finance ?? '–', tone: 'warning' },
          {
            key: 'export',
            label: 'รอส่งไฟล์ธนาคาร',
            count: counts?.toExport ?? '–',
            tone: 'accent',
          },
          {
            key: 'transfer',
            label: 'รอโอน (ส่งไฟล์แล้ว)',
            count: counts?.exported ?? '–',
            tone: 'danger',
          },
          { key: 'done', label: 'จ่ายแล้วเดือนนี้', count: counts?.paidThisMonth ?? '–', tone: 'success' },
        ]}
      />

      <FilterBar
        search={q}
        onSearch={setQ}
        placeholder="ค้นหาค่าใช้จ่าย / ชื่อคน / ร้าน"
        sticky={false}
        activeCount={[fPerson, fCompany, fSection].filter(Boolean).length}
      >
        <FilterSelect label="ทุกคน" value={fPerson} options={people} onChange={setFPerson} width={200} />
        {tab !== 'export' && (
          <FilterSelect
            label="ทุกบริษัท"
            value={fCompany}
            options={companies.map((c) => ({ value: c.id, label: c.code, hint: c.name_th }))}
            onChange={setFCompany}
          />
        )}
        <FilterSelect
          label="ทุกหมวด"
          value={fSection}
          options={SECTION_BY_POPULARITY.map((k) => ({ value: k, label: SECTION_SHORT[k] }))}
          onChange={setFSection}
        />
      </FilterBar>

      <SectionCard>
        {/* แถบเดียว: เลือกทั้งหมด · บริษัท (รอส่งไฟล์) · ยอดรวม · ปุ่มของขั้นนั้น (เจ้าของ 3 พ.ย. 69: หัวการ์ดกินที่เกิน) */}
        {!loading && (rows.length > 0 || tab === 'export') && (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-100 pb-3">
            {isFinance && tab !== 'done' && visible.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox checked={allPicked} onChange={togglePickAll} aria-label="เลือกทั้งหมด" />
                เลือกทั้งหมด
              </label>
            )}
            {tab === 'export' && exportCompanies.length > 0 && (
              // 1 ไฟล์ = 1 บริษัท
              <StatusTabs
                compact
                ariaLabel="บริษัทที่จ่าย"
                activeKey={exportCompany ?? ''}
                onSelect={(v) => {
                  setExportCompany(v || null)
                  setPicked(new Set())
                }}
                tabs={exportCompanies.map(([id, v]) => ({
                  key: id ?? '',
                  image: companyOf(id)?.logo_url,
                  label: companyOf(id)?.code ?? 'ไม่ระบุบริษัท',
                  count: v.count,
                  tone: 'neutral',
                }))}
              />
            )}
            <span className="text-sm text-gray-500">
              {tab === 'export' && rows.length === 0
                ? 'ยังไม่มีใบ — อนุมัติในช่อง "รออนุมัติ" ก่อน'
                : `${visible.length} ใบ · รวม ${thb(visible.reduce((s, r) => s + r.amount, 0))}`}
            </span>
            {isFinance && (
              <div className="ml-auto flex flex-wrap gap-1.5">
                {tab === 'finance' && (
                  <Button size="sm" icon="Check" disabled={!pickedRows.length || !!busy} loading={busy === 'bulk'} onClick={approvePicked}>
                    อนุมัติที่เลือก{pickedRows.length ? ` (${pickedRows.length})` : ''}
                  </Button>
                )}
                {(tab === 'export' || tab === 'transfer') && (
                  <Button size="sm" variant="ghost" icon="Download" onClick={openFiles}>
                    ไฟล์ที่ส่งออกแล้ว
                  </Button>
                )}
                {tab === 'export' && rows.length > 0 && (
                  <Button size="sm" icon={FileUp} disabled={!pickedRows.length} onClick={openExport}>
                    ส่งออกไฟล์ SCB{pickedRows.length ? ` (${pickedRows.length} ใบ · ${thb(pickedRows.reduce((s, c) => s + c.amount, 0))})` : ''}
                  </Button>
                )}
                {tab === 'transfer' && (
                  <>
                    <Button size="sm" variant="ghost" onClick={resetExported} disabled={!pickedRows.length || !!busy}>
                      ย้ายกลับไปรอส่งไฟล์
                    </Button>
                    <Button
                      size="sm"
                      icon="Check"
                      disabled={!pickedRows.length}
                      onClick={() => {
                        setText('')
                        setSlip(null)
                        setDialog({ mode: 'paid', claims: pickedRows })
                      }}
                    >
                      โอนแล้ว · แนบสลิป{pickedRows.length ? ` (${pickedRows.length})` : ''}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {loading ? (
          <Skeleton rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState icon={<Receipt size={28} />} title="ไม่มีใบในช่องนี้" />
        ) : (
          <div className="divide-y divide-gray-100">
            {/* หัวคอลัมน์ (จอกว้าง) — มือถือย่อบริษัท/วันที่ไว้ใต้ชื่อ */}
            <div className="hidden grid-cols-[28px_52px_minmax(0,1fr)_120px_88px_100px_130px_150px] items-center gap-3 pb-2 text-sm font-medium text-gray-500 sm:grid">
              <span />
              <span />
              <span>รายการ</span>
              <span>หมวด</span>
              <span>บริษัท</span>
              <span>วันที่</span>
              <span className="text-right">ยอด</span>
              <span>สถานะ</span>
            </div>
            {visible.map((c) => {
              const sec = formSectionOf(c.category, c.vatAmount)
              const selectable = (tab === 'finance' || tab === 'export' || tab === 'transfer') && isFinance
              const files = c.receiptPaths.length + (c.slipPath ? 1 : 0)
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewing(c)}
                  onKeyDown={(e) => e.key === 'Enter' && setViewing(c)}
                  className="grid cursor-pointer grid-cols-[28px_52px_minmax(0,1fr)_auto] items-center gap-3 py-3 hover:bg-gray-50 sm:grid-cols-[28px_52px_minmax(0,1fr)_120px_88px_100px_130px_150px]"
                >
                  <span onClick={(e) => e.stopPropagation()}>
                    {selectable && (
                      <Checkbox checked={picked.has(c.id)} onChange={() => togglePick(c.id)} aria-label="เลือกใบนี้" />
                    )}
                  </span>
                  <ClaimThumb claim={c} url={thumbUrls.get(c.id)} size={52} />
                  <span className="min-w-0">
                    {/* ชื่อค่าใช้จ่ายเด่นสุด · ชื่อคนกดแล้วกรองเฉพาะคนนั้น */}
                    <span className="block truncate text-base font-semibold text-gray-900">{c.description}</span>
                    <span className="block truncate text-sm">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFPerson(c.userId)
                        }}
                        className="font-semibold text-red-700 hover:underline"
                        title="ดูเฉพาะคนนี้"
                      >
                        {c.userName}
                      </button>
                      {c.kind === 'supplier' && <span className="text-gray-500"> · จ่ายร้าน {c.payeeName}</span>}
                      {files === 0 && <span className="text-amber-700"> · ไม่มีใบเสร็จ</span>}
                      <span className="text-gray-500 sm:hidden"> · {companyOf(c.companyId)?.code ?? '—'} · {thaiDate(c.expenseDate)}</span>
                    </span>
                  </span>
                  <span className="hidden min-w-0 items-center gap-2 sm:flex" title={SECTION_LABEL[sec]}>
                    <IconChip icon={SECTION_VISUAL[sec].icon} tone={SECTION_VISUAL[sec].tone} size={32} />
                    <span className="truncate text-sm text-gray-700">{SECTION_SHORT[sec]}</span>
                  </span>
                  <span className="hidden truncate text-[15px] text-gray-700 sm:block">{companyOf(c.companyId)?.code ?? '—'}</span>
                  <span className="hidden text-[15px] text-gray-700 sm:block">{thaiDate(c.expenseDate)}</span>
                  <span className="text-right text-lg font-bold tabular-nums text-gray-900">{thb(c.amount)}</span>
                  <span className="hidden sm:block">
                    <ExpenseStatusPill status={c.status} payout={c.payout} exportedAt={c.exportedAt} />
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={
          dialog?.mode === 'reject'
            ? 'ไม่อนุมัติใบเบิก'
            : `บันทึกว่าโอนแล้ว${dialog && dialog.claims.length > 1 ? ` ${dialog.claims.length} ใบ` : ''}`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              ยกเลิก
            </Button>
            <Button onClick={confirmDialog} loading={!!busy} variant={dialog?.mode === 'reject' ? 'danger' : 'primary'}>
              {dialog?.mode === 'reject' ? 'ไม่อนุมัติ' : 'บันทึก'}
            </Button>
          </>
        }
      >
        {dialog && (
          <div className="space-y-3">
            {dialog.mode === 'paid' && (
              <p className="text-xs text-gray-500">อัปโหลดไฟล์เข้า SCB แล้วยืนยันรายการเรียบร้อย ค่อยกดบันทึก — ยังไม่โอนก็ปิดหน้าต่างนี้ไว้ก่อนได้</p>
            )}
            {dialog.claims.length === 1 ? (
              <p className="text-sm text-gray-700">
                {dialog.claims[0].kind === 'supplier' ? dialog.claims[0].payeeName : dialog.claims[0].userName} ·{' '}
                {thb(dialog.claims[0].amount)} · {dialog.claims[0].description}
              </p>
            ) : (
              <p className="text-sm text-gray-700">
                {dialog.claims.length} ใบ · รวม {thb(dialog.claims.reduce((s, c) => s + c.amount, 0))} —
                สลิป/รายงานโอนใบเดียวใช้กับทุกใบ
              </p>
            )}
            <Field label={dialog.mode === 'reject' ? 'เหตุผล (พนักงานจะเห็น)' : 'หมายเหตุ (ไม่บังคับ)'}>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={dialog.mode === 'reject' ? 'เช่น ไม่ใช่ค่าใช้จ่ายของงาน' : 'เช่น โอนผ่านไฟล์ SCB 3 พ.ย.'}
              />
            </Field>
            {dialog.mode === 'paid' && (
              <Field label="สลิปโอน (ไม่บังคับ)">
                <FileDropzone
                  files={slip ? [slip] : []}
                  onChange={(f) => setSlip(f[0] ?? null)}
                  allowPdf
                  size="sm"
                  label="ลากสลิป/รายงานโอนจาก SCB มาวาง หรือกดเพื่อเลือก"
                />
              </Field>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="สรุปค่าใช้จ่ายสิ้นเดือน"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportOpen(false)}>
              ยกเลิก
            </Button>
            <Button icon="Download" onClick={downloadReport} loading={busy === 'report'}>
              ดาวน์โหลด Excel
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="เดือน" help="ตามวันที่จ่ายเงิน / วันที่ใบแจ้งหนี้ · เฉพาะใบที่บัญชีอนุมัติแล้ว" asDiv>
            <SelectMenu value={reportMonth} options={recentMonths()} onChange={setReportMonth} />
          </Field>
          <Field label="บริษัท" asDiv>
            <SelectMenu
              value={reportCompany}
              options={companies.map((c) => ({ value: c.id, label: c.code, hint: c.name_th }))}
              onChange={setReportCompany}
              clearable="ทุกบริษัท"
              placeholder="ทุกบริษัท"
            />
          </Field>
          <p className="text-xs text-gray-500">
            ได้ชีตสรุป + ชีตละคนตามฟอร์ม EXPENSES REIMBURSEMENT (ค่าเดินทาง · รับรอง · โทรศัพท์ · อื่น ๆ · อื่น ๆ VAT 7%) +
            ชีตจ่าย supplier
          </p>
        </div>
      </Modal>

      <Modal open={filesOpen} onClose={() => setFilesOpen(false)} title="ไฟล์โอน SCB ที่ส่งออกแล้ว" maxWidth={560}>
        {exportFiles.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีไฟล์ — ไฟล์ที่ส่งออกตั้งแต่วันนี้ไปจะเก็บไว้ที่นี่</p>
        ) : (
          <div className="space-y-4">
            {exportFiles.map(({ companyId, files }) => (
              <div key={companyId ?? 'none'}>
                <p className="mb-1 text-sm font-semibold text-gray-700">{companyOf(companyId)?.code ?? 'ไม่ระบุบริษัท'}</p>
                <div className="divide-y divide-gray-100">
                  {files.map((f) => (
                    <div key={f.path} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-gray-900">
                          {f.createdAt ? format(new Date(f.createdAt), 'd MMM yyyy HH:mm', { locale: th }) : f.filename}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {f.count} รายการ · {thb(f.total)} · {f.filename}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="Download"
                        onClick={() => downloadExportFile(f).catch((e) => showToast((e as Error).message, 'error'))}
                      >
                        ดาวน์โหลด
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ClaimDetailModal
        claim={viewing}
        company={viewing ? companyOf(viewing.companyId) : undefined}
        canApprove={!!viewing && isFinance && viewing.status === 'pending_finance' && !mine(viewing)}
        canMarkPaid={!!viewing && isFinance && viewing.status === 'approved' && !!viewing.exportedAt}
        busy={!!viewing && busy === viewing.id}
        onClose={() => setViewing(null)}
        onApprove={() => {
          const c = viewing!
          run(c.id, () => financeDecide(c, true, { payout: 'transfer' }), 'อนุมัติแล้ว ย้ายไปรอส่งไฟล์ธนาคาร').then(() => setViewing(null))
        }}
        onReject={() => {
          setText('')
          setDialog({ mode: 'reject', claims: [viewing!] })
          setViewing(null)
        }}
        onEdit={() => {
          setEditing(viewing)
          setViewing(null)
        }}
        onMarkPaid={() => {
          setText('')
          setSlip(null)
          setDialog({ mode: 'paid', claims: [viewing!] })
          setViewing(null)
        }}
      />
      <ClaimEditModal
        claim={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          showToast('บันทึกการแก้ไขแล้ว', 'success')
          load()
        }}
      />

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="ส่งออกไฟล์โอน SCB"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExportOpen(false)}>
              ยกเลิก
            </Button>
            <Button icon="Download" onClick={exportTransfer} loading={busy === 'export'}>
              ดาวน์โหลดไฟล์ (.txt)
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">{companyOf(exportCompany)?.code ?? 'ไม่ระบุบริษัท'}</span> · {pickedRows.length} ใบ · รวม{' '}
            {thb(pickedRows.reduce((s, c) => s + c.amount, 0))}
          </p>
          <Field label="บัญชีตัดเงิน (SCB ของบริษัท)" help="ใช้หักค่าธรรมเนียมด้วย · กรอกครั้งเดียว ระบบจำไว้กับบริษัท">
            <Input
              value={debitAccount}
              onChange={(e) => setDebitAccount(e.target.value)}
              inputMode="numeric"
              placeholder="xxx-x-xxxxx-x"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="วันที่รายการมีผล" asDiv>
              <DatePicker value={valueDate} onChange={setValueDate} />
            </Field>
            <Field label="บริการโอน" asDiv>
              <SelectMenu
                value={product}
                options={(Object.keys(SCB_PRODUCT_LABEL) as ScbProduct[]).map((k) => ({ value: k, label: SCB_PRODUCT_LABEL[k], hint: k }))}
                onChange={(v) => v && setProduct(v as ScbProduct)}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-500">
            ได้ไฟล์ SCB_file_reference_….txt แบบเดียวกับปุ่ม Export ของ CPX Toolkit — อัปโหลดเข้า SCB Business Anywhere ได้เลย ·
            ไฟล์นี้โอนได้เฉพาะบัญชี SCB (บัญชีธนาคารอื่นจะแจ้งว่าข้ามไป)
          </p>
          <p className="text-xs text-amber-700">
            กดดาวน์โหลดแล้ว ใบจะย้ายไป &quot;รอโอน&quot; และเก็บไฟล์ไว้ที่ปุ่ม &quot;ไฟล์ที่ส่งออกแล้ว&quot; · ถ้าแค่ลอง ย้ายกลับได้ที่แท็บรอโอน →
            ติ๊กใบ → &quot;ย้ายกลับไปรอส่งไฟล์&quot;
          </p>
        </div>
      </Modal>
    </div>
  )
}

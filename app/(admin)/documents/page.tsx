'use client'

// เอกสารบริษัท — รายการเอกสารที่เคยออก (= ประวัติ) + ปุ่มสร้างใบใหม่
//
// ที่นี่คือ "ประวัติ" ตามที่เจ้าของขอ: ทุกใบที่เคยทำอยู่ในตารางนี้
// (ประวัติการ "แก้" ของแต่ละใบอยู่ในหน้าเอกสารนั้น ปุ่มประวัติการแก้ไข)
//
// ลบได้ตามกติกาที่เจ้าของวางไว้ 21 ส.ค.: แอดมินลบได้ทุกใบ · คนอื่นลบได้
// เฉพาะใบที่ยังเป็นร่าง — บังคับจริงที่ RLS ไม่ใช่แค่ซ่อนปุ่ม
//
// ── ทำไมต้องทำงานได้จบในตารางนี้ (เจ้าของทัก 21 ส.ค.) ───────────────
// งานที่ทำบ่อยที่สุดคือ "หาใบเก่าแล้วสั่งพิมพ์/โหลดซ้ำ" ไม่ใช่แก้เนื้อหา
// ถ้าต้องเปิดเข้าไปในใบก่อนถึงจะกดโหลดได้ = เสีย 2 จอทุกครั้งที่แค่อยากได้ไฟล์
// เมนู ⋯ กับปุ่มสถานะจึงอยู่ในแถวเลย

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { ActionMenu, Button, ConfirmDialog, Pill } from '@/components/aoo'
import {
  DataTable,
  FilterBar,
  FilterSelect,
  PageHeader,
  TechLoader,
  type Column,
} from '@/components/shared'
import { DocumentSheet, printCss } from '@/components/documents/DocumentSheet'
import {
  parseBody,
  thaiDate,
  type CompanyHead,
  type Signer,
} from '@/lib/documents/types'
import { copyText, downloadFile, shareUrl } from '@/lib/documents/download'

type Row = {
  id: string
  doc_no: string
  title: string
  status: 'draft' | 'issued'
  recipient: string
  updated_at: string
  created_by: string | null
  share_token: string
  company: { code: string; name_th: string } | null
}

export default function DocumentsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  /** id ผู้ใช้ → ชื่อที่ใช้เรียกจริง (ชื่อเล่นถ้ามี) */
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [q, setQ] = useState('')
  const [company, setCompany] = useState('all')
  /** ใบที่กำลังถามยืนยันลบ — null = ไม่มีกล่องเปิดอยู่ */
  const [toDelete, setToDelete] = useState<Row | null>(null)
  /** ใบที่กำลังจะพิมพ์ — เรนเดอร์แผ่น A4 ซ่อนไว้ท้ายหน้าแล้วสั่งพิมพ์ */
  const [toPrint, setToPrint] = useState<PrintJob | null>(null)

  useEffect(() => {
    // ผู้จัดการออกเอกสารได้ด้วย (เจ้าของสั่ง 21 ส.ค.) — ตรงกับ can_view_all() ฝั่ง RLS
    if (userData && !['hr', 'admin', 'manager'].includes(userData.role)) {
      router.push('/unauthorized')
    }
  }, [userData, router])

  const load = async () => {
    const sb = createClient()
    const { data, error } = await sb
      .from('documents')
      .select(
        'id, doc_no, title, status, recipient, updated_at, created_by, share_token, company:companies(code, name_th)'
      )
      .order('updated_at', { ascending: false })
    if (error) {
      showToast(`โหลดรายการเอกสารไม่สำเร็จ: ${error.message}`, 'error')
      setRows([])
      return
    }
    const list = (data ?? []) as unknown as Row[]
    setRows(list)

    // ดึงชื่อแยก ไม่ join มากับ documents — ชื่อที่ถูกต้องคือ display_name ถ้ามี
    // ไม่ใช่ full_name เสมอไป (กติกาเดียวกับที่ระบบใช้ทุกหน้า)
    const ids = [
      ...new Set(list.map((r) => r.created_by).filter(Boolean)),
    ] as string[]
    if (ids.length) {
      const { data: users } = await sb
        .from('users')
        .select('id, full_name, display_name')
        .in('id', ids)
      setNames(
        new Map((users ?? []).map((u) => [u.id, u.display_name || u.full_name]))
      )
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const companies = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rows ?? []) {
      if (r.company) seen.set(r.company.code, r.company.name_th)
    }
    return [...seen.entries()]
  }, [rows])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? []).filter((r) => {
      if (company !== 'all' && r.company?.code !== company) return false
      if (!needle) return true
      return [r.title, r.recipient, r.doc_no]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [rows, q, company])

  /** ── ปุ่มสร้าง ไม่แตะฐานข้อมูล ────────────────────────────────
   *  เจ้าของสั่ง 21 ส.ค.: "ถ้ายังไม่ได้บันทึก ไม่ต้องสร้าง จะได้ไม่มีขยะ"
   *  ของเดิมยิง insert ทันทีที่กด — กดเล่นแล้วปิดหน้าไป = ใบร้างค้างในตาราง
   *  และกินเลขที่เอกสารไปด้วย ทำให้เลขที่ออกจริงขาดช่วง
   *  ตอนนี้แค่เปิดหน้าเปล่า แถวเกิดตอนกดบันทึกเท่านั้น
   */
  /** สลับร่าง ↔ ออกแล้ว จากในตารางเลย
   *  เปลี่ยนบนจอก่อนแล้วค่อยยิง (พลาดแล้วคืนค่าเดิม) ปุ่มจะได้ไม่หน่วง */
  const toggleStatus = async (r: Row) => {
    const next = r.status === 'draft' ? 'issued' : 'draft'
    setRows((prev) =>
      (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: next } : x))
    )
    const { error } = await createClient()
      .from('documents')
      // ไม่แตะ issued_at — มันคือ "วันที่บนเอกสาร" (= วันที่สร้าง)
      // ไม่ใช่ "วันที่กดว่าออกแล้ว" · ดึงกลับเป็นร่างแล้วล้างทิ้งจะทำให้
      // วันที่บนหน้ากระดาษหายไปเฉย ๆ
      .update({ status: next, updated_by: userData?.id ?? null })
      .eq('id', r.id)
    if (error) {
      setRows((prev) =>
        (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: r.status } : x))
      )
      showToast(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`, 'error')
    }
  }

  /** ลบได้ไหม — ต้องตรงกับ policy documents_delete ในฐานข้อมูล
   *  ถ้าสองที่ไม่ตรงกัน จะมีปุ่มที่กดแล้วเงียบ ๆ ไม่เกิดอะไรขึ้น */
  const canDelete = (r: Row) =>
    userData?.role === 'admin' || r.status === 'draft'

  const remove = async (r: Row) => {
    const { error } = await createClient()
      .from('documents')
      .delete()
      .eq('id', r.id)
    if (error) {
      showToast(`ลบไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    setRows((prev) => (prev ?? []).filter((x) => x.id !== r.id))
    showToast(`ลบ ${r.doc_no || 'เอกสาร'} แล้ว`, 'success')
  }

  /** ── สั่งพิมพ์จากในตาราง ไม่ต้องเปิดเข้าไปในเอกสารก่อน ────────
   *  (เจ้าของสั่ง 21 ส.ค. — ของเดิมเด้งไปหน้าเอกสารแล้วค่อยเปิดกล่องพิมพ์)
   *
   *  window.print() พิมพ์เฉพาะสิ่งที่อยู่ใน DOM ตอนนั้น จึงต้องดึงเนื้อหา
   *  มาเรนเดอร์เป็นแผ่น A4 จริงก่อน (ซ่อนไว้บนจอ — ดู PrintSheet ท้ายไฟล์)
   */
  const printRow = async (r: Row) => {
    const sb = createClient()
    const { data: doc } = await sb
      .from('documents')
      .select('*')
      .eq('id', r.id)
      .maybeSingle()
    if (!doc) {
      showToast('เปิดเอกสารไม่สำเร็จ', 'error')
      return
    }
    const { data: comp } = await sb
      .from('companies')
      .select(
        'id, code, name_th, name_en, address, phone, registration_no, branch_label, logo_url'
      )
      .eq('id', doc.company_id)
      .maybeSingle()
    const company = (comp ?? null) as CompanyHead | null

    // โหลดโลโก้ให้เสร็จก่อนค่อยสั่งพิมพ์ ไม่งั้นได้กระดาษที่หัวจดหมายไม่มีโลโก้
    if (company?.logo_url) {
      await new Promise<void>((done) => {
        const img = new window.Image()
        img.onload = img.onerror = () => done()
        img.src = company.logo_url as string
      })
    }

    setToPrint({
      company,
      docNo: doc.doc_no ?? '',
      title: doc.title ?? '',
      period: doc.period ?? '',
      recipient: doc.recipient ?? '',
      bodyText: doc.body_text ?? '',
      signers: (doc.signers ?? []) as Signer[],
      issuedAt: doc.issued_at ?? null,
    })
  }

  const columns: Column<Row>[] = [
    {
      key: 'title',
      header: 'เรื่อง',
      mobilePrimary: true,
      cell: (r) => (
        <div className="min-w-0">
          <Link
            href={`/documents/${r.id}`}
            className="font-medium text-gray-900 hover:text-red-600"
          >
            {r.title.trim() || '(ยังไม่ได้ตั้งเรื่อง)'}
          </Link>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {r.doc_no.trim() !== '' && `เลขที่ ${r.doc_no} · `}
            เรียน {r.recipient.trim() || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'บริษัท',
      hideOnMobile: true,
      cell: (r) => <span className="text-gray-600">{r.company?.name_th ?? '—'}</span>,
    },
    {
      key: 'creator',
      header: 'ผู้สร้าง',
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-gray-600">
          {r.created_by ? (names.get(r.created_by) ?? '—') : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'สถานะ',
      cell: (r) => <StatusButton status={r.status} onClick={() => toggleStatus(r)} />,
    },
    {
      key: 'updated',
      header: 'แก้ล่าสุด',
      hideOnMobile: true,
      cell: (r) => <span className="text-gray-500">{thaiDate(r.updated_at)}</span>,
    },
    {
      key: 'menu',
      header: '',
      width: 40,
      mobileFooterAction: true,
      cell: (r) => (
        <ActionMenu
          label={`จัดการเอกสาร ${r.title}`}
          items={[
            {
              label: 'เปิดแก้ไข',
              icon: 'Pencil',
              onSelect: () => router.push(`/documents/${r.id}`),
            },
            {
              label: 'พิมพ์ / บันทึก PDF',
              icon: 'Printer',
              onSelect: () => printRow(r),
            },
            {
              // ให้คนอื่นเปิดดูเพื่อ approve — ต้องล็อกอินก่อนเสมอ
              label: 'คัดลอกลิงก์ให้คนอื่นดู',
              icon: 'Link',
              onSelect: async () => {
                const ok = await copyText(shareUrl(r.id, r.share_token))
                showToast(
                  ok
                    ? 'คัดลอกลิงก์แล้ว — คนที่เปิดต้องล็อกอินก่อน'
                    : 'คัดลอกไม่สำเร็จ ลองใหม่อีกครั้ง',
                  ok ? 'success' : 'error'
                )
              },
            },
            {
              label: 'ดาวน์โหลด Word',
              icon: 'FileDown',
              onSelect: () => downloadFile(`/api/documents/${r.id}/docx`),
            },
            { kind: 'divider' },
            {
              label: r.status === 'draft' ? 'ทำเครื่องหมายว่าออกแล้ว' : 'ดึงกลับเป็นร่าง',
              icon: r.status === 'draft' ? 'Check' : 'Undo2',
              onSelect: () => toggleStatus(r),
            },
            {
              label: 'ลบเอกสาร',
              icon: 'Trash2',
              tone: 'danger',
              // ใบที่ออกไปแล้ว มีแต่แอดมินที่ลบได้
              disabled: !canDelete(r),
              onSelect: () => setToDelete(r),
            },
          ]}
        />
      ),
    },
  ]

  if (!rows) return <TechLoader />

  return (
    <div className="space-y-5">
      <PageHeader
        title="เอกสารบริษัท"
        description="ออกจดหมาย/ประกาศจากแม่แบบกลาง — บันทึกเป็น PDF หรือ Word"
        icon={FileText}
        actions={
          <Button size="sm" icon="Plus" onClick={() => router.push('/documents/new')}>
            สร้างเอกสาร
          </Button>
        }
      />

      <FilterBar
        search={q}
        onSearch={setQ}
        placeholder="ค้นหาเรื่อง / ผู้รับ / เลขที่"
        sticky={false}
      >
        <FilterSelect
          label="ทุกบริษัท"
          width={224}
          value={company === 'all' ? null : company}
          onChange={(v) => setCompany(v ?? 'all')}
          options={companies.map(([code, name]) => ({ value: code, label: name }))}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={shown}
        rowKey={(r) => r.id}
        emptyTitle={
          rows.length === 0
            ? 'ยังไม่มีเอกสาร — กด “สร้างเอกสาร” เพื่อออกใบแรก'
            : 'ไม่พบเอกสารที่ตรงกับที่ค้นหา'
        }
      />
      {toPrint && (
        <PrintSheet job={toPrint} onDone={() => setToPrint(null)} />
      )}

      <ConfirmDialog
        open={!!toDelete}
        tone="danger"
        title="ลบเอกสารนี้?"
        description={
          toDelete
            ? `${toDelete.doc_no || 'เอกสาร'} — ${toDelete.title.trim() || '(ยังไม่ได้ตั้งเรื่อง)'} · ลบแล้วประวัติการแก้ทั้งหมดหายไปด้วย และเลขที่ใบนี้จะไม่ถูกนำกลับมาใช้ซ้ำ`
            : ''
        }
        confirmLabel="ลบเลย"
        onConfirm={async () => {
          if (toDelete) await remove(toDelete)
          setToDelete(null)
        }}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}

/** ป้ายสถานะที่กดสลับได้ — ไม่ใช่ป้ายอ่านอย่างเดียว
 *  ใส่ ring ตอน hover ให้รู้ว่ากดได้ ไม่งั้นไม่มีใครลองกด */
function StatusButton({
  status,
  onClick,
}: {
  status: 'draft' | 'issued'
  onClick: () => void
}) {
  const issued = status === 'issued'
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        issued ? 'กดเพื่อดึงกลับเป็นร่าง' : 'กดเพื่อทำเครื่องหมายว่าออกแล้ว'
      }
      className="rounded-full ring-1 ring-transparent transition hover:ring-gray-400"
    >
      <Pill tone={issued ? 'success' : 'warning'}>{issued ? 'ออกแล้ว' : 'ร่าง'}</Pill>
    </button>
  )
}

type PrintJob = {
  company: CompanyHead | null
  docNo: string
  title: string
  period: string
  recipient: string
  bodyText: string
  signers: Signer[]
  issuedAt: string | null
}

/** แผ่น A4 ที่มีอยู่เพื่อสั่งพิมพ์อย่างเดียว
 *
 *  ⚠️ ซ่อนด้วย h-0 + overflow-hidden ห้ามใช้ display:none หรือ visibility —
 *  printCss ทำงานด้วยการซ่อนทั้งหน้าแล้วเปิดเฉพาะแผ่นนี้ ถ้าแผ่นถูก
 *  display:none ไว้ ตอนพิมพ์จะได้กระดาษเปล่า
 *
 *  ⚠️ กล่องที่ครอบต้องไม่ใช่ตัวที่ถูกจัดตำแหน่ง (position ไม่ใช่ static) —
 *  ตอนพิมพ์แผ่นเป็น position:absolute ถ้ากล่องครอบถูกจัดตำแหน่งไว้
 *  แผ่นจะไปอ้างอิงกล่องนั้นแทนหน้ากระดาษ แล้วหลุดออกนอกหน้าไปเลย
 */
function PrintSheet({ job, onDone }: { job: PrintJob; onDone: () => void }) {
  // เก็บ callback ไว้ใน ref — ถ้าใส่เป็น dependency ตรง ๆ effect จะรันใหม่
  // ทุกครั้งที่ parent วาดซ้ำ (prop เป็นฟังก์ชันใหม่เสมอ) แล้วสั่งพิมพ์ซ้ำ
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  /** สั่งพิมพ์ได้ครั้งเดียวต่อการเปิดหนึ่งครั้ง — React โหมดพัฒนารัน effect
   *  สองรอบ ถ้าไม่กั้นไว้ กล่องพิมพ์จะเด้งสองที (จับได้ตอนทดสอบ 21 ส.ค.) */
  const fired = useRef(false)

  useEffect(() => {
    const after = () => doneRef.current()
    window.addEventListener('afterprint', after)
    // กันค้าง: บางเบราว์เซอร์ไม่ยิง afterprint ถ้าผู้ใช้กดยกเลิก
    const bail = setTimeout(() => doneRef.current(), 60_000)
    return () => {
      window.removeEventListener('afterprint', after)
      clearTimeout(bail)
    }
  }, [])

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    // รอให้เบราว์เซอร์วาดแผ่นเสร็จก่อนอย่างน้อย 2 เฟรม
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }, [])

  return (
    <div className="h-0 overflow-hidden">
      <DocumentSheet
        company={job.company}
        docNo={job.docNo}
        title={job.title}
        period={job.period}
        recipient={job.recipient}
        body={parseBody(job.bodyText)}
        signers={job.signers}
        issuedAt={job.issuedAt}
      />
      <style>{printCss}</style>
    </div>
  )
}

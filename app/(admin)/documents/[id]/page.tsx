'use client'

// หน้าแก้เอกสารหนึ่งใบ — กรอกซ้าย เห็นผลจริงขวา
//
// ── ทำไมต้องเห็นตัวอย่างสด ๆ ──────────────────────────────────────
// เอกสารทางการผิดพลาดแล้วแก้ทีหลังไม่ได้ (ส่งออกไปแล้ว) คนกรอกต้องเห็น
// หน้ากระดาษจริงตอนพิมพ์ ไม่ใช่กด "ดูตัวอย่าง" แล้วเด้งหน้าใหม่
// แผ่นตัวอย่างคือ DocumentSheet ตัวเดียวกับที่ถูกสั่งพิมพ์ — ไม่มีทางเพี้ยน
//
// ⚠️ ไฟล์ Word สร้างจากข้อมูลใน "ฐานข้อมูล" ไม่ใช่จากฟอร์มบนจอ
//    ปุ่มโหลด Word จึงบันทึกให้ก่อนเสมอ ไม่งั้นจะได้ไฟล์รุ่นเก่าโดยไม่รู้ตัว

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  Download,
  FileText,
  History,
  Link2,
  Printer,
  Save,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { ActionMenu, Button, Modal, SelectMenu } from '@/components/aoo'
import { PageHeader, TechLoader } from '@/components/shared'
import { DocumentSheet, printCss } from '@/components/documents/DocumentSheet'
import { copyText, downloadFile, shareUrl } from '@/lib/documents/download'
import {
  blocksToText,
  parseBody,
  thaiDate,
  type Block,
  type CompanyHead,
  type Signer,
} from '@/lib/documents/types'

const FIELD =
  'h-9 w-full rounded-lg border border-gray-200 px-2.5 text-sm outline-none focus:border-red-400'
const AREA =
  'w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm leading-6 outline-none focus:border-red-400'

// doc_no กับ issued_at ไม่อยู่ในฟอร์ม — ระบบออกให้เอง (trigger documents_number)
// ถ้าใส่ไว้ในฟอร์มแล้วส่งกลับไปด้วย จะไปทับเลขที่ trigger เพิ่งออกให้
type Form = {
  company_id: string
  title: string
  period: string
  recipient: string
  body_text: string
  signers: Signer[]
  status: 'draft' | 'issued'
}

type Version = {
  version: number
  created_at: string
  snapshot: Record<string, unknown>
}

export default function DocumentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  // /documents/new = ใบใหม่ที่ยังไม่มีแถวในฐานข้อมูล
  // แถวเกิดตอนกดบันทึกเท่านั้น (เจ้าของสั่ง 21 ส.ค. — กันใบร้างและกันเลขขาดช่วง)
  const isNew = id === 'new'
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [companies, setCompanies] = useState<CompanyHead[]>([])
  const [form, setForm] = useState<Form | null>(null)
  /** สำเนาตอนโหลด/บันทึกล่าสุด — ใช้บอกว่ายังมีอะไรค้างไม่ได้บันทึก */
  const savedRef = useRef<string>('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  /** ชื่อคนสร้าง + วันที่สร้าง ไว้โชว์ใต้หัวข้อ (เจ้าของขอ 21 ส.ค.) */
  const [origin, setOrigin] = useState<{ by: string; at: string } | null>(null)
  /** เลขที่ + วันที่บนเอกสาร — ระบบออกให้ อ่านอย่างเดียว */
  const [issued, setIssued] = useState<{ no: string; at: string }>({
    no: '',
    at: '',
  })
  /** token สำหรับลิงก์ให้คนอื่นเปิดดู — ใบใหม่ยังไม่มีจนกว่าจะบันทึก */
  const [shareToken, setShareToken] = useState('')

  useEffect(() => {
    // ผู้จัดการออกเอกสารได้ด้วย (เจ้าของสั่ง 21 ส.ค.) — ตรงกับ can_view_all() ฝั่ง RLS
    if (userData && !['hr', 'admin', 'manager'].includes(userData.role)) {
      router.push('/unauthorized')
    }
  }, [userData, router])

  useEffect(() => {
    ;(async () => {
      const sb = createClient()
      const { data: comps } = await sb
        .from('companies')
        .select(
          'id, code, name_th, name_en, address, phone, registration_no, branch_label, logo_url'
        )
        .eq('is_active', true)
        .order('code')
      const list = (comps ?? []) as CompanyHead[]
      setCompanies(list)

      if (isNew) {
        const blank: Form = {
          company_id: list[0]?.id ?? '',
          title: '',
          period: '',
          recipient: '',
          body_text: '',
          signers: [{ name: '', title: '' }],
          status: 'draft',
        }
        // นับว่า "ยังไม่มีอะไรเปลี่ยน" — เปิดหน้าเปล่าแล้วปิดไป ต้องไม่มีใครเตือน
        savedRef.current = JSON.stringify(blank)
        setForm(blank)
        setIssued({ no: '', at: new Date().toISOString().slice(0, 10) })
        return
      }

      const { data: doc, error } = await sb
        .from('documents')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !doc) {
        showToast('ไม่พบเอกสารนี้', 'error')
        router.push('/documents')
        return
      }

      setIssued({ no: doc.doc_no ?? '', at: doc.issued_at ?? '' })
      setShareToken(doc.share_token ?? '')
      const f: Form = {
        company_id: doc.company_id,
        title: doc.title ?? '',
        period: doc.period ?? '',
        recipient: doc.recipient ?? '',
        body_text: doc.body_text ?? '',
        signers: (doc.signers ?? []) as Signer[],
        status: doc.status as 'draft' | 'issued',
      }
      savedRef.current = JSON.stringify(f)
      setForm(f)

      if (doc.created_by) {
        const { data: u } = await sb
          .from('users')
          .select('full_name, display_name')
          .eq('id', doc.created_by)
          .maybeSingle()
        if (u) {
          setOrigin({
            by: u.display_name || u.full_name,
            at: doc.created_at,
          })
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  /** ช่องที่ต้องมีก่อนถึงจะบันทึกได้ — ใบเปล่า ๆ ที่ไม่มีอะไรเลยคือขยะ
   *  (เจ้าของสั่ง 21 ส.ค.) · ที่เหลือเว้นว่างได้หมด */
  const missing = useMemo(
    () =>
      (
        [
          form?.title.trim() === '' && 'เรื่อง',
          form?.body_text.trim() === '' && 'เนื้อหา',
        ] as (string | false | undefined)[]
      ).filter(Boolean) as string[],
    [form?.title, form?.body_text]
  )

  const patch = useCallback((p: Partial<Form>) => {
    setForm((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...p }
      setDirty(JSON.stringify(next) !== savedRef.current)
      return next
    })
  }, [])

  // เตือนก่อนปิดแท็บถ้ายังไม่บันทึก — เอกสารที่พิมพ์ไปครึ่งใบแล้วหายคือหายจริง
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const company = useMemo(
    () => companies.find((c) => c.id === form?.company_id) ?? null,
    [companies, form?.company_id]
  )

  // แปลข้อความเป็นบล็อกใหม่ทุกครั้งที่พิมพ์ — ตัวแปลตัวเดียวกับที่ไฟล์ Word ใช้
  // ตัวอย่างบนจอกับไฟล์ที่โหลดไปจึงเป็นผลของโค้ดชุดเดียวกันเสมอ
  const blocks = useMemo(
    () => parseBody(form?.body_text ?? ''),
    [form?.body_text]
  )

  /** คืน id ของเอกสาร (ใบใหม่ = id ที่เพิ่งเกิด) · null = บันทึกไม่สำเร็จ */
  const save = async (): Promise<string | null> => {
    if (!form) return null
    if (missing.length) {
      showToast(`ต้องกรอก${missing.join('และ')}ก่อนถึงจะบันทึกได้`, 'error')
      return null
    }
    setSaving(true)
    const sb = createClient()

    // ใบใหม่ — แถวเพิ่งเกิดตรงนี้ trigger จะออกเลขที่เอกสารให้พร้อมกัน
    if (isNew) {
      const { data, error } = await sb
        .from('documents')
        .insert({
          ...form,
          created_by: userData?.id ?? null,
          updated_by: userData?.id ?? null,
        })
        .select('id, doc_no, issued_at, share_token')
        .single()
      setSaving(false)
      if (error || !data) {
        showToast(`สร้างเอกสารไม่สำเร็จ: ${error?.message ?? ''}`, 'error')
        return null
      }
      savedRef.current = JSON.stringify(form)
      setDirty(false)
      setIssued({ no: data.doc_no ?? '', at: data.issued_at ?? '' })
      setShareToken(data.share_token ?? '')
      showToast(`สร้างเอกสารแล้ว — เลขที่ ${data.doc_no}`, 'success')
      // replace ไม่ใช่ push — กด back แล้วต้องไม่ย้อนมาหน้า /new ที่ว่างเปล่า
      router.replace(`/documents/${data.id}`)
      return data.id
    }

    // ขอ doc_no/issued_at กลับมาด้วย — ย้ายบริษัทแล้ว trigger ออกเลขใหม่ให้
    // ถ้าไม่อ่านกลับ หน้าจอจะยังโชว์เลขของบริษัทเดิมจนกว่าจะรีเฟรช
    const { data, error } = await sb
      .from('documents')
      .update({ ...form, updated_by: userData?.id ?? null })
      .eq('id', id)
      .select('doc_no, issued_at')
      .maybeSingle()
    setSaving(false)
    if (error) {
      showToast(`บันทึกไม่สำเร็จ: ${error.message}`, 'error')
      return null
    }
    if (data) setIssued({ no: data.doc_no ?? '', at: data.issued_at ?? '' })
    savedRef.current = JSON.stringify(form)
    setDirty(false)
    setVersions(null) // ประวัติเพิ่มเวอร์ชันใหม่แล้ว โหลดใหม่ตอนเปิดครั้งหน้า
    showToast('บันทึกแล้ว', 'success')
    return id
  }

  /** Word อ่านจากฐานข้อมูล — ต้องบันทึกก่อนเสมอ ไม่งั้นได้ไฟล์รุ่นเก่า */
  const downloadWord = async () => {
    // ใบใหม่ต้องถูกบันทึกก่อนถึงจะมีอะไรให้เซิร์ฟเวอร์อ่าน — และต้องใช้ id
    // ที่เพิ่งเกิด ไม่ใช่คำว่า "new" บน URL
    const docId = isNew || dirty ? await save() : id
    if (!docId) return
    downloadFile(`/api/documents/${docId}/docx`)
  }

  const openHistory = async () => {
    setShowHistory(true)
    if (versions) return
    const { data, error } = await createClient()
      .from('document_versions')
      .select('version, created_at, snapshot')
      .eq('document_id', id)
      .order('version', { ascending: false })
    if (error) {
      showToast(`โหลดประวัติไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    setVersions((data ?? []) as Version[])
  }

  /** เอาเวอร์ชันเก่ามาใส่ฟอร์ม — ยังไม่บันทึกให้ ต้องกดบันทึกเองอีกที
   *  (ทับของปัจจุบันทันทีจะเสี่ยงมาก คนกดยังไม่ทันเห็นว่าใช่เวอร์ชันที่ต้องการไหม) */
  const restore = (v: Version) => {
    const s = v.snapshot as Record<string, never>
    patch({
      company_id: s.company_id,
      title: s.title ?? '',
      period: s.period ?? '',
      recipient: s.recipient ?? '',
      // เวอร์ชันเก่าที่เก็บก่อนย้ายมาเป็นข้อความ ยังมี body เป็นบล็อก — แปลงกลับให้
      body_text: s.body_text ?? blocksToText((s.body ?? []) as Block[]),
      signers: (s.signers ?? []) as Signer[],
    })
    setShowHistory(false)
    showToast(`ใส่เวอร์ชัน ${v.version} ให้แล้ว — กดบันทึกเพื่อยืนยัน`, 'success')
  }

  if (!form) return <TechLoader />

  return (
    <div className="space-y-4">
      <PageHeader
        title={form.title.trim() || 'เอกสารใหม่'}
        description={
          [
            origin && `สร้างโดย ${origin.by} · ${thaiDate(origin.at)}`,
            isNew
              ? missing.length
                ? `ยังไม่ได้สร้าง — ต้องกรอก${missing.join('และ')}ก่อน`
                : 'ยังไม่ได้สร้าง — กดบันทึกเพื่อออกเอกสาร'
              : missing.length
                ? `ยังกรอกไม่ครบ: ${missing.join(' · ')}`
                : dirty
                  ? 'มีการแก้ไขที่ยังไม่ได้บันทึก'
                  : 'บันทึกแล้วทั้งหมด',
          ]
            .filter(Boolean)
            .join(' — ')
        }
        icon={FileText}
        backHref="/documents"
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={openHistory}
              disabled={isNew}
            >
              <History size={15} /> ประวัติการแก้ไข
            </Button>
            {/* ลิงก์ให้คนอื่นเปิดดูเพื่อ approve (เจ้าของขอ 21 ส.ค.)
                ใบใหม่ยังไม่มี token จนกว่าจะบันทึก จึงกดไม่ได้ */}
            <Button
              variant="ghost"
              size="sm"
              disabled={!shareToken}
              title={
                shareToken ? undefined : 'บันทึกเอกสารก่อนถึงจะแชร์ได้'
              }
              onClick={async () => {
                const ok = await copyText(shareUrl(id, shareToken))
                showToast(
                  ok
                    ? 'คัดลอกลิงก์แล้ว — คนที่เปิดต้องล็อกอินก่อน'
                    : 'คัดลอกไม่สำเร็จ ลองใหม่อีกครั้ง',
                  ok ? 'success' : 'error'
                )
              }}
            >
              <Link2 size={15} /> แชร์
            </Button>

            {/* สั่งพิมพ์ทันที — งานที่ทำบ่อยสุดต้องกดครั้งเดียวถึง
                ไม่ต้องเปิดเมนูก่อน (เจ้าของขอ 21 ส.ค.) */}
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer size={15} /> พิมพ์
            </Button>

            {/* เอาไฟล์เก็บไว้ รวมไว้ในเมนูเดียว */}
            <ActionMenu
              label="ดาวน์โหลดเอกสาร"
              minWidth={230}
              items={[
                {
                  label: 'ไฟล์ Word (.docx)',
                  icon: 'FileText',
                  onSelect: downloadWord,
                },
                {
                  // ทางเดียวที่ออก PDF ได้คือหน้าต่างพิมพ์ของเบราว์เซอร์
                  // (ปลายทางเลือก "Save as PDF") — เขียนกำกับไว้ให้รู้ว่า
                  // มันเด้งกล่องเดียวกับปุ่มพิมพ์ ไม่ใช่บั๊ก
                  label: 'ไฟล์ PDF (เลือก Save as PDF)',
                  icon: 'FileDown',
                  onSelect: () => window.print(),
                },
              ]}
              trigger={({ onClick, open }) => (
                <Button variant="secondary" size="sm" onClick={onClick}>
                  <Download size={15} /> ดาวน์โหลด
                  <ChevronDown
                    size={14}
                    className={open ? 'rotate-180 transition' : 'transition'}
                  />
                </Button>
              )}
            />
            <Button
              size="sm"
              onClick={save}
              disabled={saving || missing.length > 0 || (!dirty && !isNew)}
              title={
                missing.length
                  ? `ต้องกรอก${missing.join('และ')}ก่อน`
                  : undefined
              }
            >
              <Save size={15} />
              {saving
                ? 'กำลังบันทึก...'
                : isNew
                  ? 'บันทึก & สร้างเอกสาร'
                  : 'บันทึก'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(360px,440px)_1fr]">
        {/* ── ฟอร์ม ─────────────────────────────────────────────── */}
        <div className="space-y-4 print:hidden">
          <Card title="ข้อมูลหัวเอกสาร">
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled
                label="บริษัท"
                hint="เปลี่ยนแล้วโลโก้/ที่อยู่/เลขที่เอกสาร เปลี่ยนตาม"
              >
                {/* ใช้ SelectMenu ของระบบ ไม่ใช่ <select> ของ OS —
                    แผงที่กางออกมาของ native แต่งไม่ได้ หน้าตาไม่เข้ากับที่เหลือ
                    (ดูคำอธิบายใน components/aoo/select-menu.tsx) */}
                <SelectMenu
                  value={form.company_id}
                  onChange={(v) => v && patch({ company_id: v })}
                  options={companies.map((c) => ({
                    value: c.id,
                    label: c.name_th,
                    hint: c.code,
                  }))}
                  placeholder="เลือกบริษัท"
                />
              </Labeled>
              {/* เลขที่กับวันที่ ระบบออกให้เอง — โชว์ให้เห็นแต่ไม่ให้แก้
                  ช่องที่ระบบรู้คำตอบอยู่แล้ว ไม่ควรให้คนมานั่งกรอก
                  (เลขเดินแยกตามบริษัท+ปี ย้ายบริษัทแล้วออกเลขใหม่ให้เอง) */}
              <Readonly
                label="เลขที่เอกสาร"
                value={issued.no || 'ออกให้ตอนกดบันทึก'}
              />
              <Readonly label="วันที่บนเอกสาร" value={thaiDate(issued.at)} />
              <Labeled label="เรื่อง" full>
                <input
                  value={form.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="เช่น กลยุทธ์อัดฉีดยอดขายสินค้า Brand GB และ Stokke"
                  className={FIELD}
                />
              </Labeled>
              <Labeled label="ระยะเวลา" full hint="เว้นว่าง = ไม่ขึ้นบรรทัดนี้">
                <input
                  value={form.period}
                  onChange={(e) => patch({ period: e.target.value })}
                  placeholder="เช่น 1 กันยายน 2569 – 31 ตุลาคม 2569"
                  className={FIELD}
                />
              </Labeled>
              <Labeled label="เรียน" full>
                <input
                  value={form.recipient}
                  onChange={(e) => patch({ recipient: e.target.value })}
                  placeholder="เช่น พีซีประจำห้าง และพนักงานร้าน ABC THE BABY"
                  className={FIELD}
                />
              </Labeled>
            </div>
          </Card>

          <Card title="เนื้อหา">
            <textarea
              value={form.body_text}
              onChange={(e) => patch({ body_text: e.target.value })}
              rows={16}
              spellCheck={false}
              placeholder={
                'พิมพ์เนื้อหาที่นี่ได้เลย\n\n' +
                'เพื่อสร้างแรงผลักดันและเพิ่มโอกาสปิดการขาย บริษัทขอประกาศ...\n' +
                '# สินค้าที่ร่วมแคมเปญ\n' +
                '- รถเข็น Swan Pro ชิ้นละ 200 บาท\n' +
                '- STOKKE : Sleepi ชิ้นละ 500 บาท'
              }
              className={`${AREA} font-mono text-[13px] leading-7`}
            />
            <div className="mt-2 space-y-0.5 text-[11.5px] leading-5 text-gray-400">
              <p>
                ขึ้นต้นด้วย <Key>-</Key> = หัวข้อย่อย (ติดกันหลายบรรทัด =
                รายการเดียวกัน)
              </p>
              <p>
                ขึ้นต้นด้วย <Key>#</Key> = หัวข้อตัวหนา
              </p>
              <p>บรรทัดอื่น = ย่อหน้า · ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่</p>
            </div>
          </Card>

          <Card title="ผู้ลงนาม">
            <SignerEditor
              signers={form.signers}
              onChange={(signers) => patch({ signers })}
            />
          </Card>

          <Card title="สถานะ">
            <div className="flex gap-2">
              {(
                [
                  ['draft', 'ร่าง', 'ยังแก้ได้เรื่อย ๆ'],
                  ['issued', 'ออกแล้ว', 'ส่งออกไปแล้ว'],
                ] as const
              ).map(([v, label, hint]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => patch({ status: v })}
                  className={[
                    'flex-1 rounded-lg border px-3 py-2 text-left text-sm',
                    form.status === v
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                  ].join(' ')}
                >
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs opacity-70">{hint}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* ── ตัวอย่างหน้ากระดาษจริง ─────────────────────────────── */}
        <div className="min-w-0">
          <p className="mb-2 text-xs text-gray-400 print:hidden">
            ตัวอย่างขนาดเท่าของจริง (A4) — สิ่งที่เห็นคือสิ่งที่พิมพ์ออกมา
          </p>
          {/* จอแคบกว่ากระดาษ A4 ให้เลื่อนดูแนวนอนได้ — แต่ตอนพิมพ์ต้องปลดออก
              ไม่งั้นกล่องนี้ตัดขอบแผ่นที่ถูกยกไปวางมุมบนซ้ายด้วย position:absolute */}
          <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
            <DocumentSheet
              company={company}
              docNo={issued.no}
              title={form.title}
              period={form.period}
              recipient={form.recipient}
              body={blocks}
              signers={form.signers}
              issuedAt={issued.at || null}
            />
          </div>
        </div>
      </div>

      <Modal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title="ประวัติการแก้ไข"
        description="เก็บอัตโนมัติทุกครั้งที่บันทึกแล้วมีอะไรเปลี่ยน"
        maxWidth={560}
      >
        {!versions ? (
          <p className="py-6 text-center text-sm text-gray-400">กำลังโหลด...</p>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            ยังไม่เคยแก้หลังสร้าง — ยังไม่มีเวอร์ชันเก่าให้ย้อนดู
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {versions.map((v) => (
              <li
                key={v.version}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {String(v.snapshot.title ?? '').trim() || '(ไม่มีเรื่อง)'}
                  </p>
                  <p className="text-xs text-gray-400">
                    เวอร์ชัน {v.version} · {thaiDate(v.created_at)}{' '}
                    {new Date(v.created_at).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => restore(v)}>
                  ใช้เวอร์ชันนี้
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <style>{printCss}</style>
    </div>
  )
}

/* ── ชิ้นส่วนย่อย ─────────────────────────────────────────────── */

function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

/** คำอธิบายอยู่ "ใต้ช่องกรอก" ไม่ใช่ต่อท้ายป้ายชื่อ
 *  ของเดิมต่อท้ายป้าย พอข้อความยาวมันตกบรรทัด แล้วคำที่ตกไปลอยเบียด
 *  ช่องกรอกจนดูเหมือนป้ายหลง (เจ้าของทัก 21 ส.ค. ว่า UI แปลก ๆ) */
function Labeled({
  label,
  hint,
  full,
  children,
}: {
  label: string
  hint?: string
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={full ? 'block sm:col-span-2' : 'block'}>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

function SignerEditor({
  signers,
  onChange,
}: {
  signers: Signer[]
  onChange: (s: Signer[]) => void
}) {
  const blank = (): Signer => ({ name: '', title: '' })
  // เอกสารต้องมีอย่างน้อย 1 ช่องเสมอ — แถวว่างในฐานข้อมูลก็ยังต้องมีช่องให้กรอก
  const list: Signer[] = signers.length ? signers.slice(0, 2) : [blank()]
  const count = list.length

  const setCount = (n: 1 | 2) =>
    onChange(n === 1 ? [list[0]] : [list[0], list[1] ?? blank()])

  const set = (i: number, p: Partial<Signer>) =>
    onChange(list.map((s, k) => (k === i ? { ...s, ...p } : s)))

  return (
    <div className="space-y-3">
      <div>
        <span className="text-xs text-gray-500">จำนวนช่องลงชื่อ</span>
        <div className="mt-1 flex gap-2">
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={[
                'flex-1 rounded-lg border px-3 py-1.5 text-sm',
                count === n
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              ].join(' ')}
            >
              {n} ช่อง
            </button>
          ))}
        </div>
      </div>

      {list.map((s, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-500">
            {count === 2 ? `ช่องที่ ${i + 1} — ${i === 0 ? 'ซ้าย' : 'ขวา'}` : 'ช่องลงชื่อ'}
          </p>
          {/* เรียงลงมาแนวตั้ง — การ์ดนี้กว้างราว 400px ยัด 2 คอลัมน์แล้ว
              ป้ายกับคำอธิบายตกบรรทัดจนอ่านไม่รู้เรื่อง */}
          <div className="space-y-2.5">
            <Labeled
              label="ชื่อผู้ลงนาม"
              hint="เว้นว่างไว้ = พิมพ์เส้นประให้เซ็นแล้วเขียนชื่อเอง"
            >
              <input
                value={s.name}
                onChange={(e) => set(i, { name: e.target.value })}
                placeholder="เว้นว่างได้"
                className={FIELD}
              />
            </Labeled>
            <Labeled label="ตำแหน่ง">
              <input
                value={s.title}
                onChange={(e) => set(i, { title: e.target.value })}
                placeholder="เช่น ประธานกรรมการบริษัท"
                className={FIELD}
              />
            </Labeled>
          </div>
        </div>
      ))}
    </div>
  )
}

/** ตัวอักษรพิเศษในคำอธิบายวิธีพิมพ์ — ให้เห็นชัดว่าเป็นสัญลักษณ์ ไม่ใช่คำ */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-gray-600">
      {children}
    </code>
  )
}

/** ค่าที่ระบบออกให้ ไม่ใช่ช่องกรอก — ทำให้ดูต่างจากช่องกรอกชัด ๆ
 *  ไม่งั้นคนจะพยายามคลิกพิมพ์แล้วงงว่าทำไมพิมพ์ไม่ได้ */
function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <p className="mt-1 flex h-9 items-center rounded-lg bg-gray-50 px-2.5 font-mono text-sm text-gray-500 ring-1 ring-gray-100 ring-inset">
        {value}
      </p>
    </div>
  )
}

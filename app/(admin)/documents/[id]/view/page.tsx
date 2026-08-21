'use client'

// หน้าดูเอกสารอย่างเดียว — เปิดจากลิงก์แชร์ (เจ้าของสั่ง 21 ส.ค.)
//
// ── ใครเปิดได้ ──────────────────────────────────────────────────────
// พนักงานคนไหนก็ได้ที่ **ล็อกอินแล้ว และมีลิงก์** — ลิงก์พก token มาด้วย
// ไม่ได้เปิด policy ให้พนักงานอ่าน documents ทุกใบ (ดู migration share_link)
// ถ้าไม่ล็อกอิน ProtectedRoute ของ layout เด้งไปหน้า login ก่อนอยู่แล้ว
//
// หน้านี้ไม่มีปุ่มแก้/ลบ/ดาวน์โหลด Word โดยตั้งใจ — คนที่ได้ลิงก์มาเพื่อดู
// และ approve ไม่ควรแก้เอกสารของคนอื่นได้ · ดาวน์โหลด Word ยิงผ่าน RLS
// ปกติ คนที่ไม่ใช่ HR/ผู้จัดการจะได้ 404 อยู่ดี จึงไม่เอามาไว้ตรงนี้

import { use, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/aoo'
import { PageHeader, TechLoader } from '@/components/shared'
import { DocumentSheet, printCss } from '@/components/documents/DocumentSheet'
import { FitToWidth } from '@/components/documents/FitToWidth'
import {
  parseBody,
  thaiDate,
  type CompanyHead,
  type Signer,
} from '@/lib/documents/types'

type Shared = {
  doc_no: string
  title: string
  period: string
  recipient: string
  body_text: string
  signers: Signer[]
  status: 'draft' | 'issued'
  issued_at: string | null
  company: CompanyHead | null
}

export default function DocumentViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const token = useSearchParams().get('t') ?? ''
  const [doc, setDoc] = useState<Shared | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      if (!token) {
        setError('ลิงก์ไม่สมบูรณ์ — ต้องเปิดจากลิงก์แชร์ที่ได้รับมาทั้งเส้น')
        return
      }
      const { data, error: err } = await createClient().rpc(
        'document_by_share',
        { p_id: id, p_token: token }
      )
      if (err) {
        setError(`เปิดเอกสารไม่สำเร็จ: ${err.message}`)
        return
      }
      if (!data) {
        // แยกไม่ออกว่า "ลิงก์ผิด" หรือ "ใบถูกลบ" โดยตั้งใจ — ไม่บอกคนนอก
        // ว่าเอกสารนี้มีอยู่จริงไหม
        setError('ไม่พบเอกสารนี้ หรือลิงก์หมดอายุแล้ว')
        return
      }
      setDoc(data as unknown as Shared)
    })()
  }, [id, token])

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <FileText size={32} className="mx-auto text-gray-300" />
        <p className="mt-3 text-sm text-gray-600">{error}</p>
      </div>
    )
  }
  if (!doc) return <TechLoader />

  return (
    <div className="space-y-4">
      <PageHeader
        title={doc.title.trim() || '(ไม่มีชื่อเรื่อง)'}
        description={[
          doc.doc_no && `เลขที่ ${doc.doc_no}`,
          thaiDate(doc.issued_at),
          doc.status === 'draft' ? 'ยังเป็นร่าง ยังไม่ได้ออกจริง' : 'ออกแล้ว',
        ]
          .filter(Boolean)
          .join(' · ')}
        icon={FileText}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="print:hidden"
          >
            <Printer size={15} /> พิมพ์ / บันทึก PDF
          </Button>
        }
      />

      {/* ย่อให้พอดีจอ ไม่ใช่บีบ — บนมือถือแผ่น A4 กว้างกว่าจอเกือบเท่าตัว */}
      <FitToWidth>
        <DocumentSheet
          company={doc.company}
          docNo={doc.doc_no}
          title={doc.title}
          period={doc.period}
          recipient={doc.recipient}
          body={parseBody(doc.body_text)}
          signers={doc.signers ?? []}
          issuedAt={doc.issued_at}
        />
      </FitToWidth>

      <style>{printCss}</style>
    </div>
  )
}

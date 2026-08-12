'use client'

// หนังสือรับรองการทำงานและเงินเดือน — พิมพ์/บันทึก PDF ผ่านหน้าต่างพิมพ์ (คู่กับหน้าสัญญาจ้าง)
//
// ใช้ยื่นสินเชื่อ/วีซ่า/ราชการ: รับรองว่าเป็นพนักงานจริง ตำแหน่งอะไร เริ่มงานเมื่อไหร่
// เงินเดือนเท่าไหร่ (+ รายได้ประจำอื่นถ้ามี) — ข้อมูลดึงจากระบบทั้งหมด
// ช่องที่ยังไม่มีข้อมูลเว้นเส้นประให้เขียนมือ + เตือนบนจอ (ไม่ติดไปตอนพิมพ์)
// เลขที่หนังสือกับผู้ลงนามเว้นว่างไว้ — แล้วแต่ระเบียบเอกสารของบริษัท

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/aoo'
import { TechLoader } from '@/components/shared'
import { thaiBahtText } from '@/lib/utils/thaiBaht'

type CertData = {
  fullName: string
  nationalId: string | null
  startDate: string | null
  position: string | null
  company: {
    name_th: string
    address: string | null
    registration_no: string | null
    logo_url: string | null
  } | null
  salaryNow: number | null
  /** รายได้ประจำอื่นรวมต่อเดือน (เฉพาะยอดคงที่ — ค่าคอม/ค่าชิ้นงานผันตามยอด ไม่รับรอง) */
  fixedExtra: number
}

const baht = new Intl.NumberFormat('th-TH')

const thDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

/** มีค่า = ตัวหนา · ไม่มี = เส้นประเว้นไว้เขียนมือ */
function Fill({ v, w = 130 }: { v?: string | null; w?: number }) {
  if (v) return <span className="font-semibold">{v}</span>
  return (
    <span
      className="inline-block border-b border-dotted border-gray-600 align-baseline"
      style={{ minWidth: w }}
    >
      &nbsp;
    </span>
  )
}

export default function SalaryCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<CertData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const sbc = createClient()
      const { data: u, error: uErr } = await sbc
        .from('users')
        .select('full_name, national_id, start_date, company_id, job_function_id')
        .eq('id', id)
        .maybeSingle()

      if (uErr || !u) {
        setError('ไม่พบข้อมูลพนักงาน')
        return
      }

      const [comp, jf, sal, items] = await Promise.all([
        u.company_id
          ? sbc
              .from('companies')
              .select('name_th, address, registration_no, logo_url')
              .eq('id', u.company_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        u.job_function_id
          ? sbc.from('job_functions').select('name_th').eq('id', u.job_function_id).maybeSingle()
          : Promise.resolve({ data: null }),
        sbc
          .from('user_compensation')
          .select('base_salary, effective_from')
          .eq('user_id', id)
          .order('effective_from', { ascending: false }),
        sbc.from('user_pay_items').select('amount, calc').eq('user_id', id),
      ])

      const today = new Date().toISOString().slice(0, 10)
      const nowRow = (sal.data ?? []).find((r) => r.effective_from <= today)
      const fixedExtra = (items.data ?? [])
        .filter((i) => i.calc === 'fixed')
        .reduce((s, i) => s + Number(i.amount), 0)

      setData({
        fullName: u.full_name,
        nationalId: u.national_id,
        startDate: u.start_date,
        position: jf.data?.name_th ?? null,
        company: comp.data,
        salaryNow: nowRow ? Number(nowRow.base_salary) : null,
        fixedExtra,
      })
    })()
  }, [id])

  if (error) return <p className="p-8 text-red-600">{error}</p>
  if (!data) return <TechLoader />

  const missing = [
    !data.company && 'ยังไม่ได้เลือกบริษัท (หน้าแก้ไขพนักงาน แท็บข้อมูล)',
    data.company && !data.company.address && 'ที่อยู่บริษัท (กรอกที่หลังบ้าน ตาราง companies)',
    data.company && !data.company.registration_no && 'เลขทะเบียนนิติบุคคล (ตาราง companies)',
    !data.position && 'ตำแหน่ง (หน้าแก้ไขพนักงาน)',
    !data.nationalId && 'เลขบัตรประชาชน (หน้าแก้ไขพนักงาน แท็บข้อมูล)',
    !data.salaryNow && 'เงินเดือน (แท็บเงินเดือน)',
    !data.startDate && 'วันเริ่มงาน',
  ].filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-[210mm] space-y-4">
      {/* แถบควบคุม — จอเท่านั้น */}
      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/employees/${id}/edit`}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={15} /> กลับหน้าพนักงาน
          </Link>
          <div className="ml-auto">
            <Button size="sm" onClick={() => window.print()}>
              <Printer size={15} /> พิมพ์ / บันทึก PDF
            </Button>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">ข้อมูลยังไม่ครบ — ช่องที่ขาดจะเว้นเส้นประไว้เขียนมือ:</p>
            <ul className="mt-1 list-inside list-disc">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ตัวหนังสือรับรอง — แผ่น A4 จริง (210×297มม.) ส่วนเดียวที่ติดไปตอนพิมพ์ */}
      <div
        id="certificate-sheet"
        className="mx-auto flex w-[210mm] max-w-full min-h-[297mm] flex-col rounded-xl border border-gray-200 bg-white p-[20mm] pt-[30mm] text-[15px] leading-8 text-gray-900 shadow-sm print:min-h-[247mm] print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <p className="text-sm text-gray-700">เลขที่ ............/............</p>

        {/* พื้นที่โลโก้ — จองไว้เสมอให้หัวเอกสารคงที่ ยังไม่อัพโหลดเห็นเป็นกรอบบอกบนจอ
            (ตอนพิมพ์กรอบหาย เหลือที่ว่างไว้ประทับ/แปะเองได้) */}
        <div className="mt-4 mb-10 flex h-20 items-center justify-center">
          {data.company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.company.logo_url}
              alt={data.company.name_th}
              className="h-full object-contain"
            />
          ) : (
            <div className="flex h-full w-44 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 print:hidden">
              โลโก้บริษัท — อัพโหลดที่ ตั้งค่า &gt; บริษัท
            </div>
          )}
        </div>

        <h1 className="text-center text-xl font-bold">หนังสือรับรองการทำงานและเงินเดือน</h1>

        <p className="mt-6 indent-12">
          บริษัท <Fill v={data.company?.name_th} w={180} /> ทะเบียนนิติบุคคลเลขที่{' '}
          <Fill v={data.company?.registration_no} w={140} /> สำนักงานตั้งอยู่ที่{' '}
          <Fill v={data.company?.address} w={240} /> ขอรับรองว่า
        </p>

        <p className="mt-4 indent-12">
          <Fill v={data.fullName} w={200} /> เลขบัตรประจำตัวประชาชน{' '}
          <Fill v={data.nationalId} w={150} /> เป็นพนักงานของบริษัทจริง ปัจจุบันดำรงตำแหน่ง{' '}
          <Fill v={data.position} w={160} /> โดยเริ่มปฏิบัติงานตั้งแต่วันที่{' '}
          <Fill v={thDate(data.startDate)} w={160} /> จนถึงปัจจุบัน
        </p>

        <p className="mt-4 indent-12">
          ได้รับเงินเดือนอัตราเดือนละ{' '}
          <Fill v={data.salaryNow ? baht.format(data.salaryNow) : null} w={110} /> บาท (
          <Fill v={data.salaryNow ? thaiBahtText(data.salaryNow) : null} w={190} />)
          {data.fixedExtra > 0 && data.salaryNow ? (
            <>
              {' '}
              และรายได้ประจำอื่นรวมเดือนละ {baht.format(data.fixedExtra)} บาท (
              {thaiBahtText(data.fixedExtra)}) รวมรายได้ประจำต่อเดือนทั้งสิ้น{' '}
              {baht.format(data.salaryNow + data.fixedExtra)} บาท (
              {thaiBahtText(data.salaryNow + data.fixedExtra)})
            </>
          ) : null}
        </p>

        <p className="mt-4 indent-12">
          หนังสือรับรองฉบับนี้ออกให้เพื่อรับรองสถานภาพการทำงานและรายได้ของพนักงานดังกล่าว
          เพื่อใช้ประกอบการพิจารณาตามที่ผู้ขอร้องขอเท่านั้น
        </p>

        <p className="mt-4 indent-12">ให้ไว้ ณ วันที่ {thDate(new Date().toISOString())}</p>

        {/* ผู้ลงนาม — ชิดขวา ดันลงชิดขอบล่างของกระดาษเสมอ */}
        <div className="ml-auto mt-auto w-72 pt-16 text-center">
          <p>ลงชื่อ ................................................</p>
          <p className="mt-3">( ................................................ )</p>
          <p className="mt-3">ตำแหน่ง ................................................</p>
          <p className="mt-3 text-sm text-gray-700">ผู้มีอำนาจลงนามของบริษัท</p>
        </div>
      </div>

      {/* พิมพ์: โชว์เฉพาะตัวหนังสือรับรอง */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #certificate-sheet, #certificate-sheet * { visibility: visible; }
          #certificate-sheet { position: absolute; left: 0; top: 0; width: 100%; }
          /* หัวกระดาษ 30มม. ตามที่เจ้าของขอ — ท้าย 20มม. */
          @page { size: A4; margin: 30mm 20mm 20mm; }
        }
      `}</style>
    </div>
  )
}

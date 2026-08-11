'use client'

// สัญญาจ้าง — เลือกได้ 2 แบบ แล้วพิมพ์/บันทึก PDF ผ่านหน้าต่างพิมพ์ของเบราว์เซอร์
//
//   ทดลองงาน   วันเริ่มงาน → วันพ้นทดลองงาน · โชว์เงินเดือนช่วงโปร + หลังผ่านโปร (ถ้าตั้งไว้)
//   จ้างรายปี   นโยบายเจ้าของ: สัญญาทุกฉบับสิ้นสุด 31 ธ.ค. แล้วต่อใหม่เป็นรายปี
//               คนเริ่มงานกลางปี = เริ่มตามวันจริง ถึงสิ้นปีนั้น
//
// ข้อมูลดึงจากระบบทั้งหมด — ช่องที่ยังไม่มีข้อมูลเว้นเส้นประให้เขียนมือ
// พร้อมกล่องเตือนบนจอ (ไม่ติดไปตอนพิมพ์) ว่าขาดอะไร ไปกรอกที่ไหน

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/aoo'
import { TechLoader } from '@/components/shared'
import { thaiBahtText } from '@/lib/utils/thaiBaht'

type ContractData = {
  fullName: string
  nationalId: string | null
  address: string | null
  startDate: string | null
  probationEndDate: string | null
  employmentStatus: string | null
  position: string | null
  cycle: string | null
  company: { name_th: string; address: string | null; registration_no: string | null } | null
  salaryNow: number | null
  salaryUpcoming: { amount: number; from: string } | null
}

const baht = new Intl.NumberFormat('th-TH')

const thDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

const CYCLE_TEXT: Record<string, string> = {
  c28: 'ทุกวันที่ 28 ของเดือน',
  eom: 'ทุกวันสิ้นเดือน',
  c4: 'ทุกวันที่ 4 ของเดือน',
}

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

export default function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<ContractData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ctype, setCtype] = useState<'probation' | 'annual'>('annual')
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    ;(async () => {
      const sbc = createClient()
      const { data: u, error: uErr } = await sbc
        .from('users')
        .select(
          'full_name, national_id, address, start_date, probation_end_date, employment_status, company_id, job_function_id, payroll_cycle'
        )
        .eq('id', id)
        .maybeSingle()

      if (uErr || !u) {
        setError('ไม่พบข้อมูลพนักงาน')
        return
      }

      const [comp, jf, sal] = await Promise.all([
        u.company_id
          ? sbc
              .from('companies')
              .select('name_th, address, registration_no')
              .eq('id', u.company_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        u.job_function_id
          ? sbc
              .from('job_functions')
              .select('name_th, payroll_cycle')
              .eq('id', u.job_function_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        sbc
          .from('user_compensation')
          .select('base_salary, effective_from')
          .eq('user_id', id)
          .order('effective_from', { ascending: false }),
      ])

      const today = new Date().toISOString().slice(0, 10)
      const rows = sal.data ?? []
      const nowRow = rows.find((r) => r.effective_from <= today)
      const upcoming = [...rows].reverse().find((r) => r.effective_from > today)

      setData({
        fullName: u.full_name,
        nationalId: u.national_id,
        address: u.address,
        startDate: u.start_date,
        probationEndDate: u.probation_end_date,
        employmentStatus: u.employment_status,
        position: jf.data?.name_th ?? null,
        cycle: u.payroll_cycle ?? jf.data?.payroll_cycle ?? null,
        company: comp.data,
        salaryNow: nowRow ? Number(nowRow.base_salary) : null,
        salaryUpcoming: upcoming
          ? { amount: Number(upcoming.base_salary), from: upcoming.effective_from }
          : null,
      })
      if (u.employment_status === 'probation') setCtype('probation')
    })()
  }, [id])

  if (error) return <p className="p-8 text-red-600">{error}</p>
  if (!data) return <TechLoader />

  const isProbation = ctype === 'probation'

  // ช่วงเวลาของสัญญา
  const annualStart =
    data.startDate && new Date(data.startDate).getFullYear() === year
      ? data.startDate
      : `${year}-01-01`
  const termStart = isProbation ? data.startDate : annualStart
  const termEnd = isProbation ? data.probationEndDate : `${year}-12-31`
  const probationDays =
    isProbation && data.startDate && data.probationEndDate
      ? Math.round(
          (new Date(data.probationEndDate).getTime() - new Date(data.startDate).getTime()) /
            86_400_000
        ) + 1
      : null

  // เงินเดือนหลังพ้นโปร — เอาเฉพาะแถวที่ลงวันที่ตรงกับวันพ้นโปรจริง
  const afterProbation =
    isProbation &&
    data.salaryUpcoming &&
    data.probationEndDate &&
    data.salaryUpcoming.from >= data.probationEndDate
      ? data.salaryUpcoming.amount
      : null

  // ของที่ยังขาด — เตือนบนจอ ไม่ติดไปในกระดาษ
  const missing = [
    !data.company && 'ยังไม่ได้เลือกบริษัท (หน้าแก้ไขพนักงาน แท็บข้อมูล)',
    data.company && !data.company.address && 'ที่อยู่บริษัท (กรอกที่หลังบ้าน ตาราง companies)',
    data.company && !data.company.registration_no && 'เลขทะเบียนนิติบุคคล (ตาราง companies)',
    !data.position && 'ตำแหน่ง (หน้าแก้ไขพนักงาน)',
    !data.nationalId && 'เลขบัตรประชาชน (หน้าแก้ไขพนักงาน แท็บข้อมูล)',
    !data.address && 'ที่อยู่พนักงาน (หน้าแก้ไขพนักงาน แท็บข้อมูล)',
    !data.salaryNow && 'เงินเดือน (แท็บเงินเดือน)',
    !data.startDate && 'วันเริ่มงาน',
    isProbation && !data.probationEndDate && 'วันพ้นทดลองงาน (แท็บข้อมูล — สถานะทดลองงาน)',
  ].filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* แถบควบคุม — จอเท่านั้น */}
      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/employees/${id}/edit`}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={15} /> กลับหน้าพนักงาน
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setCtype('probation')}
                className={`px-3 py-1.5 text-sm ${isProbation ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                ทดลองงาน
              </button>
              <button
                type="button"
                onClick={() => setCtype('annual')}
                className={`px-3 py-1.5 text-sm ${!isProbation ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                จ้างรายปี
              </button>
            </div>

            {!isProbation && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setYear((y) => y - 1)}
                  className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="min-w-20 text-center text-sm font-medium">พ.ศ. {year + 543}</span>
                <button
                  type="button"
                  onClick={() => setYear((y) => y + 1)}
                  className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

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

      {/* ตัวสัญญา — ส่วนเดียวที่ติดไปตอนพิมพ์ */}
      <div
        id="contract-sheet"
        className="rounded-xl border border-gray-200 bg-white p-10 text-[15px] leading-7 text-gray-900 print:rounded-none print:border-0 print:p-0"
      >
        <h1 className="text-center text-xl font-bold">
          {isProbation ? 'สัญญาจ้างทดลองงาน' : 'สัญญาจ้างงาน'}
        </h1>
        {!isProbation && (
          <p className="text-center text-sm text-gray-600">
            กำหนดระยะเวลา · ประจำปี พ.ศ. {year + 543}
          </p>
        )}

        <p className="mt-4 text-right">
          ทำที่ บริษัท <Fill v={data.company?.name_th} w={160} />
          <br />
          วันที่ {thDate(new Date().toISOString())}
        </p>

        <p className="mt-4 indent-12">
          สัญญาฉบับนี้ทำขึ้นระหว่าง บริษัท <Fill v={data.company?.name_th} w={160} /> ทะเบียนนิติบุคคลเลขที่{' '}
          <Fill v={data.company?.registration_no} w={140} /> สำนักงานตั้งอยู่ที่{' '}
          <Fill v={data.company?.address} w={240} /> ซึ่งต่อไปในสัญญานี้เรียกว่า &ldquo;นายจ้าง&rdquo; ฝ่ายหนึ่ง กับ{' '}
          <Fill v={data.fullName} w={180} /> เลขบัตรประจำตัวประชาชน <Fill v={data.nationalId} w={140} /> ที่อยู่{' '}
          <Fill v={data.address} w={240} /> ซึ่งต่อไปในสัญญานี้เรียกว่า &ldquo;ลูกจ้าง&rdquo; อีกฝ่ายหนึ่ง
          ทั้งสองฝ่ายตกลงทำสัญญาจ้างกันโดยมีข้อความดังต่อไปนี้
        </p>

        <p className="mt-3 indent-12">
          <b>ข้อ 1. การจ้าง</b> นายจ้างตกลงจ้างลูกจ้างเข้าทำงานในตำแหน่ง{' '}
          <Fill v={data.position} w={160} /> หรือหน้าที่อื่นตามที่นายจ้างมอบหมายตามความเหมาะสม
          และลูกจ้างตกลงรับจ้างทำงานดังกล่าวโดยจะปฏิบัติหน้าที่ด้วยความซื่อสัตย์สุจริต
          และเต็มความสามารถ ภายใต้ระเบียบข้อบังคับการทำงานของนายจ้าง
        </p>

        {isProbation ? (
          <p className="mt-3 indent-12">
            <b>ข้อ 2. ระยะเวลาทดลองงาน</b> นายจ้างตกลงให้ลูกจ้างทดลองปฏิบัติงาน ตั้งแต่วันที่{' '}
            <Fill v={thDate(termStart)} w={150} /> ถึงวันที่ <Fill v={thDate(termEnd)} w={150} />
            {probationDays ? ` (รวม ${probationDays} วัน)` : ''} เมื่อครบกำหนดและลูกจ้างผ่านการประเมินผลการทดลองงาน
            นายจ้างจะพิจารณาบรรจุลูกจ้างเป็นพนักงานตามเงื่อนไขของนายจ้างต่อไป
            หากผลการประเมินไม่ผ่านเกณฑ์ นายจ้างมีสิทธิเลิกจ้างเมื่อครบกำหนดระยะเวลาทดลองงานได้ตามกฎหมาย
          </p>
        ) : (
          <p className="mt-3 indent-12">
            <b>ข้อ 2. ระยะเวลาจ้าง</b> สัญญาฉบับนี้มีกำหนดระยะเวลา ตั้งแต่วันที่{' '}
            <Fill v={thDate(termStart)} w={150} /> ถึงวันที่ <Fill v={thDate(termEnd)} w={150} />{' '}
            เมื่อครบกำหนดระยะเวลาแล้ว สัญญาเป็นอันสิ้นสุดลง
            หากทั้งสองฝ่ายประสงค์จะว่าจ้างกันต่อ ให้จัดทำสัญญาจ้างฉบับใหม่เป็นรายปีต่อไป
          </p>
        )}

        <p className="mt-3 indent-12">
          <b>ข้อ 3. ค่าจ้าง</b> นายจ้างตกลงจ่ายค่าจ้างให้ลูกจ้างในอัตราเดือนละ{' '}
          <Fill v={data.salaryNow ? baht.format(data.salaryNow) : null} w={110} /> บาท (
          <Fill v={data.salaryNow ? thaiBahtText(data.salaryNow) : null} w={180} />) กำหนดจ่าย
          {data.cycle ? CYCLE_TEXT[data.cycle] ?? 'ตามรอบที่นายจ้างกำหนด' : 'ตามรอบที่นายจ้างกำหนด'}
          {isProbation && afterProbation
            ? ` ทั้งนี้ เมื่อลูกจ้างผ่านการทดลองงานแล้ว นายจ้างตกลงปรับค่าจ้างเป็นเดือนละ ${baht.format(afterProbation)} บาท (${thaiBahtText(afterProbation)})`
            : ''}
        </p>

        <p className="mt-3 indent-12">
          <b>ข้อ 4. วันเวลาทำงานและวันหยุด</b> ลูกจ้างตกลงทำงานตามวันและเวลาทำงานปกติที่นายจ้างกำหนด
          วันละไม่เกิน 8 ชั่วโมง โดยวันหยุดประจำสัปดาห์ วันหยุดตามประเพณี วันลา
          และสวัสดิการต่าง ๆ ให้เป็นไปตามระเบียบข้อบังคับการทำงานของนายจ้างและกฎหมายคุ้มครองแรงงาน
        </p>

        <p className="mt-3 indent-12">
          <b>ข้อ 5. หน้าที่ของลูกจ้าง</b> ลูกจ้างจะปฏิบัติตามระเบียบ ข้อบังคับ ประกาศ
          และคำสั่งอันชอบด้วยกฎหมายของนายจ้างอย่างเคร่งครัด จะไม่ทำงานให้แก่ผู้อื่น
          หรือประกอบกิจการใดอันเป็นการแข่งขันหรือขัดต่อผลประโยชน์ของนายจ้างตลอดระยะเวลาการจ้าง
        </p>

        <p className="mt-3 indent-12">
          <b>ข้อ 6. การรักษาความลับ</b> ลูกจ้างจะเก็บรักษาข้อมูลทางการค้า ข้อมูลลูกค้า
          และความลับทางธุรกิจของนายจ้างไว้เป็นความลับ ไม่เปิดเผยต่อบุคคลภายนอก
          ทั้งในระหว่างการจ้างและภายหลังสัญญาสิ้นสุดลง
        </p>

        <p className="mt-3 indent-12">
          <b>ข้อ 7. การสิ้นสุดของสัญญา</b> สัญญานี้สิ้นสุดลงเมื่อครบกำหนดระยะเวลาตามข้อ 2.
          หากฝ่ายใดประสงค์จะบอกเลิกสัญญาก่อนครบกำหนด ให้บอกกล่าวล่วงหน้าเป็นหนังสือไม่น้อยกว่า 30 วัน
          เว้นแต่กรณีลูกจ้างกระทำผิดร้ายแรงตามกฎหมายคุ้มครองแรงงาน
          นายจ้างมีสิทธิเลิกจ้างได้ทันทีโดยไม่ต้องบอกกล่าวล่วงหน้า
        </p>

        <p className="mt-4 indent-12">
          คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยตลอดแล้ว
          เห็นว่าตรงตามเจตนาของตน จึงลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน
        </p>

        {/* ช่องลงชื่อ */}
        <div className="mt-12 grid grid-cols-2 gap-x-10 gap-y-12 text-center">
          <div>
            <p>ลงชื่อ ................................................ นายจ้าง</p>
            <p className="mt-2 text-sm text-gray-700">( ................................................ )</p>
          </div>
          <div>
            <p>ลงชื่อ ................................................ ลูกจ้าง</p>
            <p className="mt-2 text-sm text-gray-700">( {data.fullName} )</p>
          </div>
          <div>
            <p>ลงชื่อ ................................................ พยาน</p>
            <p className="mt-2 text-sm text-gray-700">( ................................................ )</p>
          </div>
          <div>
            <p>ลงชื่อ ................................................ พยาน</p>
            <p className="mt-2 text-sm text-gray-700">( ................................................ )</p>
          </div>
        </div>
      </div>

      {/* พิมพ์: โชว์เฉพาะตัวสัญญา — ซ่อนเมนู/แถบควบคุมทั้งหมดของ layout */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #contract-sheet, #contract-sheet * { visibility: visible; }
          #contract-sheet { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4; margin: 18mm 20mm; }
        }
      `}</style>
    </div>
  )
}

// หน้ารวมคอมโพเนนต์ — ไว้ดูของจริงและทดลองกดเล่นก่อนเอาไปใช้
// ไม่ใช่หน้าใช้งาน ลบทิ้งได้ทุกเมื่อ

'use client'

import { useState } from 'react'
import { Building, Clock, Users, Wallet } from 'lucide-react'
import {
  Button,
  IconButton,
  Pill,
  SelectMenu,
  TimePicker,
  TimeRangePicker,
  DateRangeButton,
  ActionMenu,
  Modal,
  Alert,
  Toggle,
  Checkbox,
  useToast,
  type DateRangeValue,
} from '@/components/aoo'
import {
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  DataTable,
  UserCell,
  FilterBar,
  FilterSelect,
  type Column,
} from '@/components/shared'

type Row = { id: string; name: string; unit: string; status: string; hours: number }

const ROWS: Row[] = [
  { id: '1', name: 'เฟื่องฉัตร', unit: 'ออฟฟิศ AGD', status: 'active', hours: 168 },
  { id: '2', name: 'แป้งหมี่', unit: 'ABC วังเด็ก', status: 'probation', hours: 152.5 },
  { id: '3', name: 'ธวัชชัย', unit: 'คลังหลัก พระราม 2', status: 'resigned', hours: 44 },
]

export default function DesignPage() {
  const { pushToast } = useToast()
  const [unit, setUnit] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>('09:00')
  const [range, setRange] = useState<{ start: string | null; end: string | null }>({
    start: '10:00',
    end: '18:00',
  })
  const [nightRange, setNightRange] = useState<{ start: string | null; end: string | null }>({
    start: '22:00',
    end: '06:00',
  })
  const [dates, setDates] = useState<DateRangeValue>(null)
  const [modal, setModal] = useState(false)
  const [toggle, setToggle] = useState(true)
  const [checked, setChecked] = useState(false)
  const [search, setSearch] = useState('')

  const columns: Column<Row>[] = [
    { key: 'name', header: 'ชื่อ', cell: (r) => <UserCell name={r.name} subtitle={r.unit} /> },
    { key: 'status', header: 'สถานะ', cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'hours',
      header: 'ชั่วโมง',
      align: 'right',
      cell: (r) => <span className="font-mono tabular-nums">{r.hours}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="คอมโพเนนต์กลาง"
        description="ของจริงที่ใช้ได้ทั้งระบบ — กดเล่นได้"
        icon={Building}
        actions={<Button onClick={() => pushToast('ok', 'กดปุ่มแล้ว')}>ทดสอบ toast</Button>}
      />

      <Section title="การ์ดตัวเลขสรุป">
        <StatGrid>
          <StatCard label="พนักงานทั้งหมด" value={58} unit="คน" icon={Users} />
          <StatCard label="ทำงานอยู่" value={46} unit="คน" icon={Users} tone="success" />
          <StatCard label="ชั่วโมงเดือนนี้" value="8,443" unit="ชม." icon={Clock} tone="info" />
          <StatCard
            label="ต้องตรวจสอบ"
            value={203}
            icon={Wallet}
            tone="danger"
            hint="ชั่วโมงไม่น่าเชื่อถือ"
          />
        </StatGrid>
      </Section>

      <Section title="ปุ่ม">
        <div className="flex flex-wrap items-center gap-2">
          <Button>หลัก</Button>
          <Button variant="secondary">รอง</Button>
          <Button variant="ghost">โปร่ง</Button>
          <Button variant="danger">ลบ</Button>
          <Button variant="soft">อ่อน</Button>
          <Button size="sm" icon="Plus">
            เล็ก
          </Button>
          <Button disabled>ปิดใช้งาน</Button>
          <IconButton icon="Pencil" />
          <ActionMenu
            items={[
              { label: 'แก้ไข', icon: 'Pencil', onSelect: () => pushToast('ok', 'แก้ไข') },
              { kind: 'divider' },
              { label: 'ลบ', icon: 'Trash2', tone: 'danger', onSelect: () => pushToast('err', 'ลบ') },
            ]}
          />
        </div>
      </Section>

      <Section title="ป้ายสถานะ — รวมไว้ที่เดียว 30 แบบ">
        <div className="flex flex-wrap gap-2">
          {['active', 'probation', 'resigned', 'terminated', 'pending', 'approved', 'rejected',
            'worked', 'worked_wfh', 'leave', 'absent', 'needs_review', 'admin', 'hr'].map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section
        title="เลือกเวลา"
        note="ไม่ได้ใช้ <input type=time> เพราะหน้าตาต่างกันทุกเบราว์เซอร์ และตั้งช่วง 30 นาทีไม่ได้"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="เวลาเดียว">
            <TimePicker value={time} onChange={setTime} />
          </Field>
          <Field label="ช่วงเวลา — กะปกติ">
            <TimeRangePicker start={range.start} end={range.end} onChange={setRange} />
          </Field>
          <Field label="ช่วงเวลา — กะข้ามคืน (คำนวณให้ถูก)">
            <TimeRangePicker start={nightRange.start} end={nightRange.end} onChange={setNightRange} />
          </Field>
          <Field label="ช่วงวันที่">
            <DateRangeButton value={dates} onChange={setDates} />
          </Field>
        </div>
      </Section>

      <Section title="ตัวเลือก (dropdown ของเราเอง ไม่ใช่ของ OS)">
        <div className="grid max-w-md gap-4">
          <Field label="มีช่องค้นหาให้เองเมื่อตัวเลือกเกิน 8">
            <SelectMenu
              size="md"
              value={unit}
              onChange={setUnit}
              clearable="— ไม่ระบุ —"
              placeholder="เลือกหน่วยงาน"
              options={[
                { value: '1', label: 'ออฟฟิศ AGD', hint: 'AGD' },
                { value: '2', label: 'ออฟฟิศ ADF', hint: 'ADF' },
                { value: '3', label: 'คลังหลัก พระราม 2', hint: 'AGD' },
                { value: '4', label: 'โกดังใหม่ตลาดไท', hint: 'ADF' },
                { value: '5', label: 'ABC วังเด็ก', hint: 'AGD' },
                { value: '6', label: 'ABC พระราม 2', hint: 'AGD' },
                { value: '7', label: 'ABC Mega', hint: 'AGD' },
                { value: '8', label: 'Siam Paragon', hint: 'AGD' },
                { value: '9', label: 'Central World', hint: 'AGD' },
                { value: '10', label: 'Emporium', hint: 'AGD' },
              ]}
            />
          </Field>
          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Toggle checked={toggle} onChange={setToggle} />
              เปิดใช้งาน
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={checked} onChange={setChecked} />
              ยืนยัน
            </label>
          </div>
        </div>
      </Section>

      <Section title="แถบกรอง + ตาราง">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="ค้นหาชื่อ"
          sticky={false}
          actions={<Button size="sm" variant="secondary" icon="Download">ส่งออก</Button>}
        >
          <FilterSelect
            label="สถานะ"
            value={null}
            onChange={() => {}}
            options={[
              { value: 'active', label: 'ทำงานอยู่' },
              { value: 'resigned', label: 'ลาออก' },
            ]}
          />
        </FilterBar>

        <DataTable columns={columns} rows={ROWS} rowKey={(r) => r.id} />

        <p className="mt-4 mb-2 text-sm text-gray-500">ตอนไม่มีข้อมูล:</p>
        <DataTable
          columns={columns}
          rows={[]}
          rowKey={(r) => r.id}
          emptyTitle="ยังไม่มีพนักงาน"
          emptyBody="กดปุ่มเชิญพนักงานใหม่เพื่อเริ่ม"
          emptyAction={<Button size="sm" icon="UserPlus">เชิญพนักงาน</Button>}
        />
      </Section>

      <Section title="แจ้งเตือน">
        <div className="space-y-2">
          <Alert tone="info">ข้อมูลทั่วไป</Alert>
          <Alert tone="warning">ระวัง — วันเริ่มงานยังไม่ยืนยัน 58 คน</Alert>
          <Alert tone="error">ชั่วโมงทำงาน 203 รายการต้องให้ HR ตรวจสอบ</Alert>
          <Button variant="secondary" onClick={() => setModal(true)}>
            เปิด modal
          </Button>
        </div>
      </Section>

      <Modal open={modal} onClose={() => setModal(false)} title="ตัวอย่าง Modal">
        <p className="text-sm text-gray-600">
          ปิดด้วย Esc หรือคลิกนอกกรอบได้ · โฟกัสถูกล็อกไว้ในกรอบ
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(false)}>
            ยกเลิก
          </Button>
          <Button onClick={() => setModal(false)}>ตกลง</Button>
        </div>
      </Modal>
    </>
  )
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-9">
      <h2 className="mb-1 text-base font-semibold text-gray-900">{title}</h2>
      {note && <p className="mb-3 text-sm text-gray-500">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-700">{label}</p>
      {children}
    </div>
  )
}

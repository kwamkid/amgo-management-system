'use client'

// หน้าอัพสลิปสำหรับเจ้าของเว็บ (สาธารณะ ไม่ต้องล็อกอิน)
// ย้ายมาจากระบบเดิม aoo-student-website — ค้นชื่อเว็บตัวเอง → เห็นบิลค้าง → อัพสลิป
//
// อยู่นอกกลุ่ม (admin) จึงไม่มีเมนู/ไม่ต้องล็อกอิน · ข้อมูลวิ่งผ่าน /api/web/public
// ที่คืนเฉพาะฟิลด์ที่จำเป็น (ไม่มีข้อมูลติดต่อ/SSH/โน้ตภายใน)

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Alert, Button, Field, Input, Pill, RadioCardGroup, type PillTone } from '@/components/aoo'
import SectionCard from '@/components/shared/SectionCard'
import InfoPanel from '@/components/shared/InfoPanel'
import ListRow, { ListRows } from '@/components/shared/ListRow'

// บัญชีรับเงิน — ยกมาจากระบบเดิม
const BANK = { name: 'กสิกรไทย', no: '610-2-25180-4', owner: 'ยุทธนา เทียนธรรมชาติ' }

interface Bill {
  id: string
  year: number
  periodStart: string | null
  periodEnd: string | null
  hostingAmount: number
  domainAmount: number
  billDomain: boolean
  status: 'unpaid' | 'pending_review' | 'paid' | 'rejected'
}

const STATUS: Record<Bill['status'], { label: string; tone: PillTone }> = {
  unpaid: { label: 'ยังไม่ชำระ', tone: 'warning' },
  pending_review: { label: 'รอตรวจสอบ', tone: 'sky' },
  paid: { label: 'ชำระแล้ว', tone: 'success' },
  rejected: { label: 'สลิปไม่ผ่าน — อัพใหม่', tone: 'danger' },
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'
const money = (n: number) => n.toLocaleString('th-TH')

export default function PayPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; siteName: string }[]>([])
  const [site, setSite] = useState<{ id: string; siteName: string } | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [picked, setPicked] = useState<Bill | null>(null)
  const [scope, setScope] = useState<'hosting' | 'hosting_domain'>('hosting_domain')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  // ค้นหาแบบพิมพ์ไปเรื่อย ๆ — หน่วง 250ms กันยิงถี่
  useEffect(() => {
    if (site) return
    const key = q.trim()
    if (key.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/web/public?q=${encodeURIComponent(key)}`)
      const json = await res.json()
      setResults(json.sites ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [q, site])

  const pickSite = async (s: { id: string; siteName: string }) => {
    setSite(s)
    setResults([])
    setQ(s.siteName)
    const res = await fetch(`/api/web/public?siteId=${s.id}`)
    const json = await res.json()
    setBills(json.bills ?? [])
  }

  const reset = () => {
    setSite(null)
    setBills([])
    setPicked(null)
    setFile(null)
    setResult(null)
    setQ('')
  }

  const total = picked
    ? picked.hostingAmount + (picked.billDomain && scope === 'hosting_domain' ? picked.domainAmount : 0)
    : 0

  const send = async () => {
    if (!picked || !file) return
    setSending(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('slip', file)
      fd.append('billId', picked.id)
      fd.append('paidScope', scope)
      const res = await fetch('/api/web/public/slip', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ส่งสลิปไม่สำเร็จ')
      setResult({ ok: json.ok, message: json.message })
      if (json.ok && site) {
        const r = await fetch(`/api/web/public?siteId=${site.id}`)
        setBills((await r.json()).bills ?? [])
        setPicked(null)
        setFile(null)
      }
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">แจ้งชำระค่าเว็บไซต์</h1>
          <p className="mt-1 text-sm text-gray-500">ค้นชื่อเว็บของคุณ แล้วอัพสลิปโอนเงิน</p>
        </div>

        {/* ค้นหาเว็บ */}
        <SectionCard>
          <Field label="ชื่อเว็บไซต์">
            <Input
              prefix={<Search size={16} className="text-gray-400" />}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                if (site) reset()
              }}
              placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร เช่น example"
            />
          </Field>

          {results.length > 0 && (
            <ListRows variant="boxed" className="mt-2">
              {results.map((s) => (
                <ListRow key={s.id} title={s.siteName} onClick={() => pickSite(s)} />
              ))}
            </ListRows>
          )}
          {q.trim().length >= 2 && !site && results.length === 0 && (
            <p className="mt-2 text-xs text-gray-400">ไม่พบเว็บนี้ — ลองพิมพ์แค่บางส่วนของชื่อ</p>
          )}
        </SectionCard>

        {/* บิล */}
        {site && (
          <SectionCard className="mt-4">
            <p className="mb-3 font-semibold text-gray-900">{site.siteName}</p>

            {bills.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">ยังไม่มีบิลสำหรับเว็บนี้</p>
            ) : (
              <div className="space-y-2">
                {bills.map((b) => {
                  const payable = b.status === 'unpaid' || b.status === 'rejected'
                  return (
                    <button
                      key={b.id}
                      disabled={!payable}
                      onClick={() => {
                        setPicked(b)
                        setScope(b.billDomain ? 'hosting_domain' : 'hosting')
                        setResult(null)
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left ${
                        picked?.id === b.id ? 'border-red-400 bg-red-50' : 'border-gray-200'
                      } ${payable ? 'hover:bg-gray-50' : 'opacity-70'}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">ปี {b.year}</p>
                        <p className="text-xs text-gray-400">
                          {fmtDate(b.periodStart)} – {fmtDate(b.periodEnd)}
                        </p>
                      </div>
                      <Pill tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Pill>
                    </button>
                  )
                })}
              </div>
            )}
          </SectionCard>
        )}

        {/* จ่าย */}
        {picked && (
          <SectionCard className="mt-4">
            {picked.billDomain && (
              <Field label="ชำระอะไรบ้าง" asDiv className="mb-4">
                <RadioCardGroup
                  name="paidScope"
                  columns={2}
                  value={scope}
                  onChange={(v) => setScope(v as 'hosting' | 'hosting_domain')}
                  options={[
                    { value: 'hosting_domain', label: 'โฮสต์ + โดเมน' },
                    { value: 'hosting', label: 'เฉพาะโฮสต์' },
                  ]}
                />
              </Field>
            )}

            <InfoPanel className="mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ยอดที่ต้องโอน</span>
                <span className="text-2xl font-bold text-gray-900">{money(total)} บาท</span>
              </div>
              <div className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-600">
                <p className="font-medium text-gray-800">{BANK.name}</p>
                <p className="font-mono text-lg tracking-wide text-gray-900">{BANK.no}</p>
                <p className="text-xs text-gray-500">{BANK.owner}</p>
              </div>
            </InfoPanel>

            <Field label="แนบสลิปโอนเงิน" asDiv>
              {/* ช่องไฟล์ยังไม่มีคอมโพเนนต์กลาง — ใช้ input ของเบราว์เซอร์ */}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-sm"
              />
            </Field>

            <Button
              size="lg"
              icon="UploadCloud"
              onClick={send}
              disabled={!file}
              loading={sending}
              className="mt-4 w-full"
            >
              {sending ? 'กำลังส่ง...' : 'ส่งสลิป'}
            </Button>
          </SectionCard>
        )}

        {result && (
          <Alert tone={result.ok ? 'success' : 'error'} hideIcon={!result.ok} className="mt-4">
            {result.message}
          </Alert>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          อัพสลิปแล้วรอตรวจสอบ ปกติไม่เกิน 1 วันทำการ
        </p>
      </div>
    </div>
  )
}

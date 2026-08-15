'use client'

// หน้าอัพสลิปสำหรับเจ้าของเว็บ (สาธารณะ ไม่ต้องล็อกอิน)
// ย้ายมาจากระบบเดิม aoo-student-website — ค้นชื่อเว็บตัวเอง → เห็นบิลค้าง → อัพสลิป
//
// อยู่นอกกลุ่ม (admin) จึงไม่มีเมนู/ไม่ต้องล็อกอิน · ข้อมูลวิ่งผ่าน /api/web/public
// ที่คืนเฉพาะฟิลด์ที่จำเป็น (ไม่มีข้อมูลติดต่อ/SSH/โน้ตภายใน)

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Search, Upload } from 'lucide-react'

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

const STATUS: Record<Bill['status'], { label: string; cls: string }> = {
  unpaid: { label: 'ยังไม่ชำระ', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid: { label: 'ชำระแล้ว', cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'สลิปไม่ผ่าน — อัพใหม่', cls: 'bg-red-50 text-red-600 border-red-200' },
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
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">แจ้งชำระค่าเว็บไซต์</h1>
          <p className="mt-1 text-sm text-gray-500">ค้นชื่อเว็บของคุณ แล้วอัพสลิปโอนเงิน</p>
        </div>

        {/* ค้นหาเว็บ */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">ชื่อเว็บไซต์</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                if (site) reset()
              }}
              placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร เช่น example"
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-red-400 focus:bg-white"
            />
          </div>

          {results.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
              {results.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickSite(s)}
                  className="block w-full border-b border-gray-100 px-3 py-2.5 text-left text-sm text-gray-700 last:border-0 hover:bg-gray-50"
                >
                  {s.siteName}
                </button>
              ))}
            </div>
          )}
          {q.trim().length >= 2 && !site && results.length === 0 && (
            <p className="mt-2 text-xs text-gray-400">ไม่พบเว็บนี้ — ลองพิมพ์แค่บางส่วนของชื่อ</p>
          )}
        </div>

        {/* บิล */}
        {site && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
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
                      <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${STATUS[b.status].cls}`}>
                        {STATUS[b.status].label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* จ่าย */}
        {picked && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {picked.billDomain && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-700">ชำระอะไรบ้าง</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setScope('hosting_domain')}
                    className={`rounded-xl border px-3 py-2.5 text-sm ${
                      scope === 'hosting_domain' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    โฮสต์ + โดเมน
                  </button>
                  <button
                    onClick={() => setScope('hosting')}
                    className={`rounded-xl border px-3 py-2.5 text-sm ${
                      scope === 'hosting' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    เฉพาะโฮสต์
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ยอดที่ต้องโอน</span>
                <span className="text-2xl font-bold text-gray-900">{money(total)} บาท</span>
              </div>
              <div className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-600">
                <p className="font-medium text-gray-800">{BANK.name}</p>
                <p className="font-mono text-lg tracking-wide text-gray-900">{BANK.no}</p>
                <p className="text-xs text-gray-500">{BANK.owner}</p>
              </div>
            </div>

            <label className="mb-1.5 block text-sm font-medium text-gray-700">แนบสลิปโอนเงิน</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-sm"
            />

            <button
              onClick={send}
              disabled={!file || sending}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-medium text-white disabled:opacity-50"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {sending ? 'กำลังส่ง...' : 'ส่งสลิป'}
            </button>
          </div>
        )}

        {result && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-2xl border p-4 text-sm ${
              result.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-600'
            }`}
          >
            {result.ok && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          อัพสลิปแล้วรอตรวจสอบ ปกติไม่เกิน 1 วันทำการ
        </p>
      </div>
    </div>
  )
}

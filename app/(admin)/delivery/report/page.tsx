'use client'

// รายงานการส่งของ — วันไหนใครส่งกี่เจ้า สรุปทั้งเดือนในตาเดียว
//
// เปิดให้ทั้งทีม: คนขับ (ดูยอดตัวเอง/เทียบทีม) + Call Center (ตามงานให้ลูกค้า)
// + แอดมิน/HR — สิทธิ์ชุดเดียวกับเมนูงานส่งของ (canSeeDelivery)
//
// แถว = วันที่ที่มีของส่ง · คอลัมน์ = คนขับ · ช่อง = จำนวนเจ้าที่เช็คอินส่งแล้ว

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, addMonths } from 'date-fns'
import { th } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Truck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { canSeeDelivery } from '@/lib/services/user/access'
import { useToast } from '@/hooks/useToast'
import { getDeliveryMonthlySummary } from '@/lib/services/delivery/points'
import { PageHeader, TechLoader } from '@/components/shared'

type Summary = Awaited<ReturnType<typeof getDeliveryMonthlySummary>>

export default function DeliveryReportPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [data, setData] = useState<Summary | null>(null)

  useEffect(() => {
    if (userData && !canSeeDelivery(userData)) router.push('/unauthorized')
  }, [userData, router])

  useEffect(() => {
    let alive = true
    setData(null)
    getDeliveryMonthlySummary(month)
      .then((d) => alive && setData(d))
      .catch((e) => showToast((e as Error).message, 'error'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  if (!data) return <TechLoader />

  // เอาเฉพาะวันที่มีของส่งจริง เรียงวันใหม่สุดขึ้นก่อน (วันล่าสุดคือที่ทุกคนอยากเห็น)
  const days = [...new Set([...data.counts.keys()].map((k) => k.split('|')[0]))].sort().reverse()
  const totalOf = (driverId: string) =>
    days.reduce((s, d) => s + (data.counts.get(`${d}|${driverId}`) ?? 0), 0)
  const dayTotal = (d: string) =>
    data.drivers.reduce((s, dr) => s + (data.counts.get(`${d}|${dr.id}`) ?? 0), 0)
  const grand = days.reduce((s, d) => s + dayTotal(d), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="รายงานการส่งของ"
        description="วันไหนใครส่งกี่เจ้า — นับจากจุดส่งที่เช็คอินแล้ว"
        icon={Truck}
      />

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
        <span className="ml-2 text-sm text-gray-400">
          รวมทั้งเดือน {grand.toLocaleString('th-TH')} เจ้า
        </span>
      </div>

      {days.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center text-gray-500">
          เดือนนี้ยังไม่มีการส่งของ
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="sticky left-0 z-10 min-w-36 border-b border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium">
                  วันที่
                </th>
                {data.drivers.map((dr) => (
                  <th
                    key={dr.id}
                    className="border-b border-gray-200 px-3 py-2 text-right font-medium"
                  >
                    {dr.name}
                  </th>
                ))}
                <th className="w-full border-b border-gray-200" />
                <th className="border-b border-gray-200 px-3 py-2 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 text-gray-800">
                    {format(new Date(`${d}T00:00:00`), 'EEE d MMM', { locale: th })}
                  </td>
                  {data.drivers.map((dr) => {
                    const n = data.counts.get(`${d}|${dr.id}`) ?? 0
                    return (
                      <td
                        key={dr.id}
                        className={`px-3 py-1.5 text-right font-mono tabular-nums ${
                          n ? 'text-gray-800' : 'text-gray-300'
                        }`}
                      >
                        {n || '—'}
                      </td>
                    )
                  })}
                  <td />
                  <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums">
                    {dayTotal(d)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2">รวมต่อคน</td>
                {data.drivers.map((dr) => (
                  <td key={dr.id} className="px-3 py-2 text-right font-mono tabular-nums">
                    {totalOf(dr.id)}
                  </td>
                ))}
                <td />
                <td className="px-3 py-2 text-right font-mono tabular-nums text-red-700">
                  {grand}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

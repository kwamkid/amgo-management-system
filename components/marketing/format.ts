// Shared formatting for the marketing pages

import { channelLabel, metricInfo } from '@/lib/services/marketingService'

export const thDateShort = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })

export const fmtMetric = {
  label: (metric: string, channel: string) =>
    channel === 'all' ? metricInfo(metric).label : `${metricInfo(metric).label} · ${channelLabel(channel)}`,
  value: (metric: string, v: number) => {
    const { unit } = metricInfo(metric)
    if (metric === 'roas') return `${v.toLocaleString('th-TH', { maximumFractionDigits: 2 })} เท่า`
    const n = Math.abs(v) >= 100000 ? `${(v / 1000).toLocaleString('th-TH', { maximumFractionDigits: 0 })}k` : Math.round(v).toLocaleString('th-TH')
    return unit === '฿' ? `${n} ฿` : n
  },
}

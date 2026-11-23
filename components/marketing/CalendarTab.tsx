'use client'

// ปฏิทินโพสต์ — the brand's posts from aoosocial inside the plan period (GET /api/marketing/calendar),
// one agenda list by day with the plan's key dates mixed in. Accounts per brand: /marketing/settings.

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ExternalLink, Facebook, Flag, Instagram, Music2, Youtube } from 'lucide-react'
import { EmptyState } from '@/components/aoo'
import { SectionCard, StatusBadge, TechLoader } from '@/components/shared'
import { useToast } from '@/hooks/useToast'
import type { Plan } from '@/lib/services/marketingService'
import { thDateShort } from './format'

interface Post {
  id: string
  at: string
  status: string
  caption: string
  targets: { platform: string; account: string; status: string; url: string | null }[]
}

const PLATFORM_ICON = { facebook: Facebook, instagram: Instagram, tiktok: Music2, youtube: Youtube } as const

const thDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 10)
const thTime = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })

export default function CalendarTab({ plan }: { plan: Plan }) {
  const { showToast } = useToast()
  const toastRef = useRef(showToast)
  useEffect(() => {
    toastRef.current = showToast
  })
  const [posts, setPosts] = useState<Post[] | null>(null)

  useEffect(() => {
    let live = true
    const q = new URLSearchParams({ brand: plan.brand, from: plan.startDate, to: plan.endDate })
    fetch(`/api/marketing/calendar?${q}`, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`)
        return body.posts as Post[]
      })
      .then((p) => live && setPosts(p))
      .catch((e: Error) => {
        if (!live) return
        setPosts([])
        toastRef.current(`โหลดโพสต์จาก aoosocial ไม่ได้: ${e.message}`, 'error')
      })
    return () => {
      live = false
    }
  }, [plan.brand, plan.startDate, plan.endDate])

  // days that have a post or a key date, oldest first
  const days = useMemo(() => {
    const m = new Map<string, { posts: Post[]; keys: string[] }>()
    const at = (d: string) => m.get(d) ?? m.set(d, { posts: [], keys: [] }).get(d)!
    for (const p of posts ?? []) at(thDay(p.at)).posts.push(p)
    for (const k of plan.keyDates) at(k.date).keys.push(k.label)
    return [...m].sort(([a], [b]) => a.localeCompare(b))
  }, [posts, plan.keyDates])

  if (!posts) return <TechLoader />

  const published = posts.filter((p) => p.status === 'published').length
  const scheduled = posts.filter((p) => p.status === 'scheduled').length

  return (
    <SectionCard
      title="ปฏิทินโพสต์"
      description={`${thDateShort(plan.startDate)} – ${thDateShort(plan.endDate)} · ลงแล้ว ${published} · ตั้งเวลา ${scheduled} — ข้อมูลจาก aoosocial`}
    >
      {days.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<CalendarDays size={28} />}
          title="ยังไม่มีโพสต์ในช่วงแผนนี้"
          body="โพสต์ที่ตั้งเวลาหรือลงแล้วใน aoosocial ของบัญชีแบรนด์นี้จะขึ้นที่นี่ (ผูกบัญชีที่หน้าตั้งค่าแผนการตลาด)"
        />
      ) : (
        <div className="divide-y divide-gray-100">
          {days.map(([day, d]) => (
            <div key={day} className="flex flex-col gap-2 py-3 sm:flex-row sm:gap-4">
              <div className="w-28 shrink-0 text-xs font-medium text-gray-500">{thDateShort(day)}</div>
              <div className="min-w-0 flex-1 space-y-3">
                {d.keys.map((k, i) => (
                  <div key={`k${i}`} className="flex items-center gap-2 text-gray-700">
                    <Flag size={16} className="shrink-0 text-[var(--tone-ink)]" />
                    <span className="font-medium">{k}</span>
                  </div>
                ))}
                {d.posts.map((p) => (
                  <div key={p.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">{thTime(p.at)}</span>
                      <StatusBadge status={p.status} kind="socialPost" />
                      {p.targets.map((t, i) => {
                        const Icon = PLATFORM_ICON[t.platform as keyof typeof PLATFORM_ICON] ?? ExternalLink
                        const chip = (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600" title={t.account}>
                            <Icon size={14} />
                            {t.url && <ExternalLink size={12} />}
                          </span>
                        )
                        return t.url ? (
                          <a key={i} href={t.url} target="_blank" rel="noreferrer" aria-label={`เปิดโพสต์ ${t.account}`} className="hover:opacity-70">
                            {chip}
                          </a>
                        ) : (
                          <span key={i}>{chip}</span>
                        )
                      })}
                    </div>
                    <p className="line-clamp-2 break-words text-gray-700">{p.caption || '(ไม่มีข้อความ)'}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

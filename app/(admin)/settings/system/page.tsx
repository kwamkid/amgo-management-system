'use client'

// สถานะงานระบบ (admin only) — status light per cron group, cron job and queue kind (owner 2026-11-23,
// like aoocommerce superadmin ops). Data: GET /api/system/health (lib/monitor/health.ts). No auto polling:
// the page loads once and on "รีเฟรช" (Vercel Hobby CPU budget — .claude/rules/queue.md).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Modal } from '@/components/aoo'
import { PageHeader, SectionCard, StatusBadge, TechLoader } from '@/components/shared'
import type { CronRun, Health, HealthItem } from '@/lib/monitor/health'

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
    : '—'

const secs = (ms: number | null) => (ms == null ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} วิ`)

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`)
  return body as T
}

type Pick = { item: HealthItem; source: 'job' | 'queue' }

export default function SystemHealthPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  const toastRef = useRef(showToast)
  useEffect(() => {
    toastRef.current = showToast
  })
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(false)
  const [pick, setPick] = useState<Pick | null>(null)

  const isAdmin = userData?.role === 'admin'
  useEffect(() => {
    if (userData && !isAdmin) router.push('/unauthorized')
  }, [userData, isAdmin, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setHealth(await getJson<Health>('/api/system/health'))
    } catch (e) {
      toastRef.current(`โหลดสถานะไม่ได้: ${(e as Error).message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  if (!health) return <TechLoader />

  const bad = [...health.groups, ...health.jobs, ...health.queue].filter((i) => i.light === 'failing' || i.light === 'late').length

  return (
    <div className="space-y-4">
      <PageHeader
        title="สถานะงานระบบ"
        description={`งานตามเวลาและคิวกลาง ${bad ? `· มีปัญหา ${bad} งาน` : '· ทุกงานปกติ'} · ข้อมูลเมื่อ ${when(health.at)}`}
        icon={Activity}
        backHref="/settings"
        actions={
          <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={load}>
            รีเฟรช
          </Button>
        }
      />

      <SectionCard title="กลุ่ม cron" description="cron-job.org เรียกแต่ละกลุ่มทุก 10 นาที — ถ้าไม่เรียกเกิน 25 นาที จะขึ้นว่าช้า">
        <Rows items={health.groups} />
      </SectionCard>

      <SectionCard title="งานตามเวลา" description="กดที่งานเพื่อดูประวัติย้อนหลัง 30 รอบ">
        <Rows items={health.jobs} onPick={(item) => setPick({ item, source: 'job' })} />
      </SectionCard>

      <SectionCard title="คิวกลาง" description="ผลสุดท้ายของงานแต่ละชนิดในคิว (ไม่นับรอบที่กำลังลองใหม่)">
        {health.queue.length ? (
          <Rows items={health.queue} onPick={(item) => setPick({ item, source: 'queue' })} />
        ) : (
          <p className="text-gray-500">ยังไม่มีงานในคิวที่จบหลังเปิดไฟสถานะ</p>
        )}
      </SectionCard>

      {pick && <RunsModal pick={pick} onClose={() => setPick(null)} />}
    </div>
  )
}

function Rows({ items, onPick }: { items: HealthItem[]; onPick?: (i: HealthItem) => void }) {
  return (
    <div className="divide-y divide-gray-100">
      {items.map((i) => {
        const body = (
          <>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-800">{i.label}</div>
              <div className="text-xs text-gray-500">
                {[i.schedule, i.note, i.lastAt && `ล่าสุด ${when(i.lastAt)}`, secs(i.durationMs)].filter(Boolean).join(' · ')}
              </div>
              {i.light === 'failing' && i.lastError && <div className="mt-1 break-words text-xs text-[var(--danger)]">{i.lastError}</div>}
            </div>
            <StatusBadge status={i.light} kind="jobHealth" />
          </>
        )
        return onPick ? (
          <button key={i.key} type="button" onClick={() => onPick(i)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-gray-50">
            {body}
          </button>
        ) : (
          <div key={i.key} className="flex items-center gap-3 py-3">
            {body}
          </div>
        )
      })}
    </div>
  )
}

function RunsModal({ pick, onClose }: { pick: Pick; onClose: () => void }) {
  const [runs, setRuns] = useState<CronRun[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const q = pick.source === 'job' ? `job=${encodeURIComponent(pick.item.key)}` : `queue=${encodeURIComponent(pick.item.label)}`

  useEffect(() => {
    let live = true
    getJson<{ runs: CronRun[] }>(`/api/system/health?${q}`)
      .then((r) => live && setRuns(r.runs))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [q])

  return (
    <Modal open onClose={onClose} title={pick.item.label} description={pick.item.schedule ?? 'คิวกลาง'} maxWidth={640}>
      {error ? (
        <p className="text-[var(--danger)]">{error}</p>
      ) : !runs ? (
        <TechLoader />
      ) : !runs.length ? (
        <p className="text-gray-500">ยังไม่มีประวัติ</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {runs.map((r, i) => (
            <div key={i} className="space-y-1 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{when(r.startedAt)}</span>
                <StatusBadge status={r.ok == null ? 'running' : r.ok ? 'ok' : 'failing'} kind="jobHealth" />
                {r.finishedAt && <span className="text-xs text-gray-500">{secs(Date.parse(r.finishedAt) - Date.parse(r.startedAt))}</span>}
              </div>
              {r.result != null && <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs text-gray-600">{JSON.stringify(r.result)}</pre>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

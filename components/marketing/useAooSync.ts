'use client'

// "ดึงยอดตอนนี้" — queue an aoo sales re-sync and follow the queue group.
// Checks at 5 s and 15 s (one brand usually finishes by then), then every 30 s
// (client polling faster than 30 s is not allowed — .claude/rules/queue.md), gives up after 5 min.

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { getQueueGroup } from '@/lib/services/queueService'
import { syncAooSales } from '@/lib/services/marketingService'

/** waits before each check: 5 s, +10 s (= 15 s), then 30 s apart */
const WAITS_MS = [5_000, 10_000]
const EVERY_MS = 30_000
const GIVE_UP_MS = 5 * 60_000

export function useAooSync(onDone?: () => void) {
  const { showToast } = useToast()
  const toastRef = useRef(showToast)
  toastRef.current = showToast
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const run = async (brand: string, from: string, to: string) => {
    setBusy(brand)
    try {
      const { groupKey } = await syncAooSales(brand, from, to)
      const started = Date.now()
      let n = 0
      const check = async () => {
        const g = await getQueueGroup(groupKey).catch(() => null)
        if (g && !g.active) {
          setBusy(null)
          if (g.failed) toastRef.current('ดึงยอดจาก aoo ไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error')
          else toastRef.current('ดึงยอดจาก aoo แล้ว', 'success')
          doneRef.current?.()
          return
        }
        if (Date.now() - started > GIVE_UP_MS) {
          setBusy(null)
          toastRef.current('ยังดึงยอดไม่เสร็จ — งานยังทำต่อในคิว เปิดหน้านี้ใหม่ภายหลัง', 'error')
          return
        }
        timer.current = setTimeout(check, WAITS_MS[++n] ?? EVERY_MS)
      }
      timer.current = setTimeout(check, WAITS_MS[0])
    } catch (e) {
      setBusy(null)
      toastRef.current((e as Error).message, 'error')
    }
  }

  return { run, busy }
}

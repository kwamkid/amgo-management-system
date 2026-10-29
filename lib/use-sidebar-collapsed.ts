'use client'

// Sidebar "collapse to icon rail" (desktop only) — ported from AOO (aoocommerce lib/use-sidebar-collapsed.ts).
// Remembered in localStorage. useSyncExternalStore: server snapshot is always "expanded",
// the saved value applies right after hydration (no mismatch, no setState-in-effect).

import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'amgo-sidebar-collapsed'
const listeners = new Set<() => void>()
// fallback when storage is blocked (private mode) — toggle still works for this page load
let memory = false

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY)
    return v === null ? memory : v === '1'
  } catch {
    return memory
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function write(next: boolean) {
  memory = next
  try {
    localStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, read, () => false)
  const setCollapsed = useCallback((next: boolean) => write(next), [])
  const toggleCollapsed = useCallback(() => write(!read()), [])
  return { collapsed, setCollapsed, toggleCollapsed }
}

// lib/push/installPrompt.ts
//
// จับ `beforeinstallprompt` ไว้ที่เดียวแล้วแจกให้ทุกปุ่ม "ติดตั้งแอป"
//
// ทำไมต้องรวมศูนย์: เบราว์เซอร์ยิง event นี้**ครั้งเดียว**ตอนโหลดหน้า ถ้าปล่อยให้
// แต่ละ component ไปฟังเองตอน mount จะพลาด (แถบชวนติดตั้งอยู่ใน layout mount ทีหลัง
// root) — จึงจับตั้งแต่ PwaRegister ใน root layout แล้วเก็บไว้ในโมดูล
//
// Chrome/Edge บน Android + เดสก์ท็อปเท่านั้นที่มี event นี้ · Safari/iOS ไม่มีเลย
// (ต้องบอกขั้นตอนให้ผู้ใช้กดเอง — ดู app/(admin)/install)
'use client'

import { useCallback, useEffect, useState } from 'react'

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
let captured = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** เรียกครั้งเดียวตอนแอปเริ่ม (idempotent) */
export function captureInstallPrompt(): void {
  if (captured || typeof window === 'undefined') return
  captured = true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // ไม่ให้เบราว์เซอร์เด้ง mini-bar ของมันเอง — เราเลือกจังหวะเอง
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

/** ปุ่มติดตั้ง: `canPrompt` = กดแล้วขึ้นหน้าต่างติดตั้งได้ทันที · ไม่ได้ = ต้องบอกขั้นตอน */
export function useInstallPrompt() {
  const [, force] = useState(0)
  useEffect(() => {
    captureInstallPrompt()
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  const prompt = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferred) return null
    const ev = deferred
    await ev.prompt()
    const { outcome } = await ev.userChoice
    if (outcome === 'accepted') {
      deferred = null
      notify()
    }
    return outcome
  }, [])

  return { canPrompt: deferred !== null, prompt }
}

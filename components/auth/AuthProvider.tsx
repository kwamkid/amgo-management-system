'use client'

// โหลดข้อมูลผู้ใช้ครั้งเดียว แชร์ให้ทั้งแอปผ่าน useAuth() — ดูเหตุผลที่ hooks/useAuth.ts
//
// ── โหลดซ้ำเมื่อไหร่ ────────────────────────────────────────────────────
// supabase-js ยิง onAuthStateChange บ่อยกว่าที่คิด: INITIAL_SESSION ตอนเปิด ·
// TOKEN_REFRESHED ทุกชั่วโมง · SIGNED_IN ซ้ำทุกครั้งที่กลับมาที่แท็บ/แอป
// ถ้าโหลดใหม่ทุกครั้ง หน้าจอจะกระพริบตามทุกครั้งที่สลับแอปกลับมา
// → โหลดใหม่เฉพาะตอนคนเปลี่ยน (ล็อกอิน/ออก/สลับบัญชี) หรือ USER_UPDATED
//
// ดึงข้อมูลพลาดชั่วคราว (เน็ตมือถือหลุดตอนเปิดแอปกลับมา) ขณะที่มีข้อมูลของคนเดิม
// อยู่แล้ว → เก็บของเดิมไว้ ไม่เตะออกไปหน้า login

import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  AuthContext,
  FETCH_ERROR,
  INITIAL_AUTH,
  loadAuthState,
  type AuthState,
} from '@/hooks/useAuth'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_AUTH)
  // ใครกำลังโหลด/โหลดแล้ว — กันโหลดซ้อนจาก getUser กับ INITIAL_SESSION ที่มาพร้อมกัน
  const loadedFor = useRef<string | null | undefined>(undefined)
  const current = useRef<AuthState>(INITIAL_AUTH)

  useEffect(() => {
    const sb = createClient()
    let alive = true

    const load = async (authUser: User | null, force = false) => {
      const uid = authUser?.id ?? null
      if (!force && loadedFor.current === uid) return
      loadedFor.current = uid

      const next = await loadAuthState(authUser)
      if (!alive || loadedFor.current !== uid) return // ระหว่างรอ มีการเปลี่ยนคนไปแล้ว

      // พลาดชั่วคราวแต่มีข้อมูลคนเดิมอยู่ = ใช้ของเดิมต่อ
      if (next.error === FETCH_ERROR && current.current.userData && current.current.user?.id === uid) {
        return
      }
      current.current = next
      setState(next)
    }

    sb.auth.getUser().then(({ data }) => load(data.user))

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        loadedFor.current = null
        const out: AuthState = { ...INITIAL_AUTH, loading: false }
        current.current = out
        setState(out)
        return
      }
      // TOKEN_REFRESHED / SIGNED_IN ซ้ำของคนเดิม = ข้าม (load กันให้เองด้วย loadedFor)
      load(session?.user ?? null, event === 'USER_UPDATED')
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

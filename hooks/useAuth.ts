// hooks/useAuth.ts
//
// อ่าน session จาก Supabase แทน Firebase Auth
//
// ⚠️ รูปแบบ UserData ที่คืนออกไป "ต้องเหมือนเดิมทุกฟิลด์" เพราะมีหน้าจอ
//    เรียกใช้อยู่หลายสิบจุด — ตัวนี้ทำหน้าที่แปลงชื่อคอลัมน์จาก snake_case
//    ของ Postgres กลับเป็น camelCase ที่โค้ดเดิมคาดหวัง
//    พอย้ายหน้าจอครบแล้วค่อยเลิกแปลงแล้วใช้ชื่อคอลัมน์ตรง ๆ

'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { mapUser, type UserData } from '@/lib/services/user/mappers'
import { applyViewAs } from '@/lib/utils/viewAs'

// การแปลงแถว users → UserData ย้ายไปอยู่ที่ lib/services/user/mappers.ts แล้ว
// เพราะ userService ต้องใช้ตัวเดียวกัน — เดิมแปลงคนละที่แล้วไม่ตรงกัน
export type { UserData }

interface AuthState {
  user: User | null
  userData: UserData | null
  loading: boolean
  error: string | null
  /** สิทธิ์จริงตามฐานข้อมูล — ต่างจาก userData.role เมื่อแอดมินสลับ "ดูในมุมมองอื่น" */
  realRole: UserData['role'] | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    userData: null,
    loading: true,
    error: null,
    realRole: null,
  })

  const load = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setState({ user: null, userData: null, loading: false, error: null, realRole: null })
      return
    }

    const sb = createClient()
    const [{ data: row, error }, { data: locs }] = await Promise.all([
      sb.from('users').select('*').eq('id', authUser.id).maybeSingle(),
      sb.from('user_allowed_locations').select('location_id').eq('user_id', authUser.id),
    ])

    if (error) {
      console.error('ดึงข้อมูลผู้ใช้ไม่สำเร็จ:', error.message)
      setState({
        user: null,
        userData: null,
        loading: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
        realRole: null,
      })
      return
    }

    if (!row || row.deleted_at) {
      setState({ user: null, userData: null, loading: false, error: 'ไม่พบข้อมูลผู้ใช้', realRole: null })
      return
    }

    if (!row.is_active) {
      const ended = ['resigned', 'terminated', 'retired'].includes(row.employment_status)
      setState({
        user: null,
        userData: null,
        loading: false,
        error: ended ? 'บัญชีนี้สิ้นสุดการเป็นพนักงานแล้ว' : 'บัญชีของคุณยังไม่ได้รับการอนุมัติ',
        realRole: null,
      })
      await sb.auth.signOut()
      return
    }

    // สิทธิ์พิเศษตามตำแหน่ง — เห็นเมนูส่งของ (sees_delivery) + เมนูผลิต (code = production)
    let seesDelivery = false
    let jobFunctionCode: string | undefined
    if (row.job_function_id) {
      const { data: jf } = await sb
        .from('job_functions')
        .select('sees_delivery, code')
        .eq('id', row.job_function_id)
        .maybeSingle()
      seesDelivery = jf?.sees_delivery ?? false
      jobFunctionCode = jf?.code ?? undefined
    }

    // เมนู SRP Calculator — เห็นเมื่อได้รับสิทธิ์อย่างน้อย 1 แบรนด์ (แอดมินเห็นเสมอ)
    let hasSrpAccess = row.role === 'admin'
    if (!hasSrpAccess) {
      const { count } = await sb
        .from('srp_brand_access')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', row.id)
      hasSrpAccess = (count ?? 0) > 0
    }

    // เมนูดูแลเว็บไซต์ลูกค้า — งานส่วนตัวของเจ้าของ ไม่ผูกกับ role
    // (แอดมินคนอื่นก็ไม่เห็น ต้องมีชื่อใน web_owners เท่านั้น)
    const { count: webCount } = await sb
      .from('web_owners')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', row.id)
    const hasWebAccess = (webCount ?? 0) > 0

    // แอดมินสลับดูมุมมองสิทธิ์อื่นได้ (เครื่องมือทดสอบ) — จำลองแค่หน้าจอ ไม่ใช่สิทธิ์จริง
    const real = {
      ...mapUser(row, (locs ?? []).map((l) => l.location_id)),
      seesDelivery,
      jobFunctionCode,
      hasSrpAccess,
      hasWebAccess,
    }
    setState({
      user: authUser,
      userData: applyViewAs(real),
      loading: false,
      error: null,
      realRole: real.role,
    })
  }, [])

  useEffect(() => {
    const sb = createClient()
    let alive = true

    sb.auth.getUser().then(({ data }) => {
      if (alive) load(data.user)
    })

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      if (alive) load(session?.user ?? null)
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [load])

  return state
}

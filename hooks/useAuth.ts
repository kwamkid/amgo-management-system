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

// การแปลงแถว users → UserData ย้ายไปอยู่ที่ lib/services/user/mappers.ts แล้ว
// เพราะ userService ต้องใช้ตัวเดียวกัน — เดิมแปลงคนละที่แล้วไม่ตรงกัน
export type { UserData }

interface AuthState {
  user: User | null
  userData: UserData | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    userData: null,
    loading: true,
    error: null,
  })

  const load = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setState({ user: null, userData: null, loading: false, error: null })
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
      })
      return
    }

    if (!row || row.deleted_at) {
      setState({ user: null, userData: null, loading: false, error: 'ไม่พบข้อมูลผู้ใช้' })
      return
    }

    if (!row.is_active) {
      const ended = ['resigned', 'terminated', 'retired'].includes(row.employment_status)
      setState({
        user: null,
        userData: null,
        loading: false,
        error: ended ? 'บัญชีนี้สิ้นสุดการเป็นพนักงานแล้ว' : 'บัญชีของคุณยังไม่ได้รับการอนุมัติ',
      })
      await sb.auth.signOut()
      return
    }

    // สิทธิ์พิเศษตามตำแหน่ง — ตอนนี้มีเรื่องเดียว: ตำแหน่งไหนเห็นเมนูงานส่งของ
    let seesDelivery = false
    if (row.job_function_id) {
      const { data: jf } = await sb
        .from('job_functions')
        .select('sees_delivery')
        .eq('id', row.job_function_id)
        .maybeSingle()
      seesDelivery = jf?.sees_delivery ?? false
    }

    setState({
      user: authUser,
      userData: { ...mapUser(row, (locs ?? []).map((l) => l.location_id)), seesDelivery },
      loading: false,
      error: null,
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

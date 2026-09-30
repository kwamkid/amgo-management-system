'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { needsSetup } from '@/lib/todo/tasks'
import TechLoader from '@/components/shared/TechLoader'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Array<'admin' | 'hr' | 'manager' | 'employee' | 'driver' | 'marketing'>
  redirectTo?: string
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles,
  redirectTo = '/login' 
}: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, userData, loading, error } = useAuth()

  useEffect(() => {
    if (!loading) {
      // No user logged in
      if (!user) {
        router.push(redirectTo)
        return
      }

      // User not active
      if (error) {
        router.push(`${redirectTo}?error=inactive`)
        return
      }

      // Check role permissions
      if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
        router.push('/unauthorized')
        return
      }

      // ยังทำ "สิ่งที่ต้องทำก่อนใช้งาน" ไม่ครบ (ชื่อจริง+ชื่อเล่น · Discord)
      //
      // เช็คตรงนี้ ไม่ใช่แค่ตอนล็อกอิน — คนที่ล็อกอินค้างไว้ก่อนหน้าจะไม่เคย
      // ผ่านหน้า callback เลย ถ้าเช็คแค่ตอนล็อกอินก็ไม่มีวันโดนถาม
      // ยกเว้นหน้าวิธีติดตั้งแอป — การ์ด "เปิดแจ้งเตือน" ใน /setup ส่งมาที่นี่ (iPhone ต้อง
      // ติดตั้งก่อน) ถ้าดีดกลับ /setup จะวนไม่จบ
      if (userData && needsSetup(userData) && !pathname?.startsWith('/install')) {
        router.replace('/setup')
        return
      }
    }
  }, [user, userData, loading, error, allowedRoles, router, redirectTo, pathname])

  // Show loading state
  if (loading) {
    return <TechLoader />
  }

  // Don't render anything if not authorized
  if (!user || error || (allowedRoles && userData && !allowedRoles.includes(userData.role))) {
    return null
  }

  // Render children if authorized
  return <>{children}</>
}
// components/auth/ProtectedRoute.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import TechLoader from '@/components/shared/TechLoader'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Array<'admin' | 'hr' | 'manager' | 'employee'>
  redirectTo?: string
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles,
  redirectTo = '/login' 
}: ProtectedRouteProps) {
  const router = useRouter()
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
    }
  }, [user, userData, loading, error, allowedRoles, router, redirectTo])

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
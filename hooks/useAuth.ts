// hooks/useAuth.ts
'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'

export interface UserData {
  id?: string // เพิ่มบรรทัดนี้
  lineUserId: string
  lineDisplayName: string
  linePictureUrl: string
  fullName: string
  phone: string
  birthDate: string | null
  role: 'admin' | 'hr' | 'manager' | 'employee'
  permissionGroupId: string | null
  isActive: boolean
  registeredAt: Date
  createdAt: Date
}

interface AuthState {
  user: User | null
  userData: UserData | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userData: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData
            
            // Check if user is active
            if (!data.isActive) {
              setAuthState({
                user: null,
                userData: null,
                loading: false,
                error: 'บัญชีของคุณยังไม่ได้รับการอนุมัติ'
              })
              // Sign out inactive user
              await auth.signOut()
            } else {
              setAuthState({
                user,
                userData: {
                    ...data,
                    id: user.uid // เพิ่มบรรทัดนี้
                },
                loading: false,
                error: null
                })
            }
          } else {
            setAuthState({
              user: null,
              userData: null,
              loading: false,
              error: 'ไม่พบข้อมูลผู้ใช้'
            })
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          setAuthState({
            user: null,
            userData: null,
            loading: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูล'
          })
        }
      } else {
        // No user logged in
        setAuthState({
          user: null,
          userData: null,
          loading: false,
          error: null
        })
      }
    })

    return () => unsubscribe()
  }, [])

  return authState
}
'use client'

import { useRouter } from 'next/navigation'
import { useLoading } from '@/lib/contexts/LoadingContext'

export function useNavigationLoader() {
  const router = useRouter()
  const { showLoading, hideLoading } = useLoading()

  const navigate = (path: string) => {
    showLoading()
    router.push(path)
    
    // Hide loading after navigation (adjust timing as needed)
    setTimeout(() => {
      hideLoading()
    }, 500)
  }

  return { navigate }
}
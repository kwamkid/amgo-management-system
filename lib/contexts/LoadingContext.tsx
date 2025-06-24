// lib/contexts/LoadingContext.tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import TechLoader from '@/components/shared/TechLoader'

interface LoadingContextType {
  isLoading: boolean
  showLoading: () => void
  hideLoading: () => void
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  showLoading: () => {},
  hideLoading: () => {}
})

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)

  const showLoading = () => setIsLoading(true)
  const hideLoading = () => setIsLoading(false)

  return (
    <LoadingContext.Provider value={{ isLoading, showLoading, hideLoading }}>
      {children}
      {isLoading && <TechLoader />}
    </LoadingContext.Provider>
  )
}

export const useLoading = () => useContext(LoadingContext)
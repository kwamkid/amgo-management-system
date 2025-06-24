// lib/contexts/LoadingContext.tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

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
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">กำลังโหลด...</p>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  )
}

export const useLoading = () => useContext(LoadingContext)
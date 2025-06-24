// app/(admin)/layout.tsx
'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar Component */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Main content area */}
      <div className="lg:ml-64">
        {/* Navbar Component */}
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        
        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
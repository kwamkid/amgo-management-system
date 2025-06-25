// components/layout/MobileMenuButton.tsx

'use client'

import { Menu, X } from 'lucide-react'

interface MobileMenuButtonProps {
  isOpen: boolean
  onClick: () => void
}

export default function MobileMenuButton({ isOpen, onClick }: MobileMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
      aria-label="Toggle menu"
    >
      {isOpen ? (
        <X className="w-6 h-6 text-gray-600" />
      ) : (
        <Menu className="w-6 h-6 text-gray-600" />
      )}
    </button>
  )
}
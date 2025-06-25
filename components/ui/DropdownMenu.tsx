// components/ui/DropdownMenu.tsx

'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

type DropdownMenuItem = 
  | {
      label: string | React.ReactNode
      onClick: () => void
      className?: string
      disabled?: boolean
      divider?: never
    }
  | {
      divider: true
      label?: never
      onClick?: never
      className?: never
      disabled?: never
    }

interface DropdownMenuProps {
  items: DropdownMenuItem[]
  buttonClassName?: string
  menuClassName?: string
}

export default function DropdownMenu({ 
  items, 
  buttonClassName = '',
  menuClassName = ''
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuHeight = 300 // estimated max height
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      
      // Calculate position
      let top = rect.bottom + 4
      let left = rect.right - 192 // 192px = w-48 in tailwind
      
      // Adjust if menu would go off screen
      if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        top = rect.top - menuHeight - 4
      }
      
      if (left < 10) {
        left = 10
      }
      
      setPosition({ top, left })
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleItemClick = (item: DropdownMenuItem) => {
    if ('onClick' in item && item.onClick && !item.disabled) {
      item.onClick()
      setIsOpen(false)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 hover:bg-gray-100 rounded transition-colors ${buttonClassName}`}
      >
        <MoreVertical className="w-5 h-5 text-gray-500" />
      </button>
      
      {isOpen && createPortal(
        <div
          ref={menuRef}
          className={`fixed w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 ${menuClassName}`}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
        >
          {items.map((item, index) => {
            if ('divider' in item && item.divider) {
              return <div key={index} className="border-t my-1" />
            }
            
            return (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  item.disabled 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : item.className || 'text-gray-700 hover:bg-gray-100'
                }`}
                disabled={item.disabled}
              >
                {item.label}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}
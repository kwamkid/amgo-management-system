'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// Deterministic color from name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500',
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-pink-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

interface UserAvatarProps {
  name: string
  imageUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  onClick?: () => void
  showSyncHint?: boolean
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-xl',
}

export default function UserAvatar({
  name,
  imageUrl,
  size = 'md',
  className,
  onClick,
  showSyncHint = false,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const initial = (name || '?').charAt(0).toUpperCase()
  const colorClass = getAvatarColor(name || '')
  const sizeClass = sizeClasses[size]
  const isClickable = !!onClick

  const handleClick = () => {
    if (onClick) onClick()
  }

  const base = cn(
    'rounded-full flex-shrink-0 flex items-center justify-center font-semibold select-none relative overflow-hidden',
    sizeClass,
    isClickable && 'cursor-pointer',
    className
  )

  if (imageUrl && !imgError) {
    return (
      <div className={cn(base, 'bg-gray-100 group')} onClick={handleClick}>
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
        {showSyncHint && isClickable && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg className="w-1/3 h-1/3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(base, colorClass, 'text-white group')}
      onClick={handleClick}
    >
      {initial}
      {showSyncHint && isClickable && (
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
          <svg className="w-1/3 h-1/3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
      )}
    </div>
  )
}

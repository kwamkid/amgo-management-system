// ========== FILE: lib/utils/submission.ts ==========
import { 
  Instagram, 
  Music2, 
  Facebook, 
  Youtube, 
  Twitter, 
  Citrus,
  Globe,
  Link as LinkIcon
} from 'lucide-react'

// Platform detection and config
export const PLATFORM_CONFIG = {
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    patterns: ['instagram.com', 'instagr.am']
  },
  tiktok: {
    name: 'TikTok',
    icon: Music2,
    color: 'text-gray-900',
    bgColor: 'bg-gray-100',
    patterns: ['tiktok.com']
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    patterns: ['facebook.com', 'fb.com', 'fb.watch']
  },
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    patterns: ['youtube.com', 'youtu.be']
  },
  twitter: {
    name: 'Twitter/X',
    icon: Twitter,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    patterns: ['twitter.com', 'x.com']
  },
  lemon8: {
    name: 'Lemon8',
    icon: Citrus,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    patterns: ['lemon8-app.com']
  },
  website: {
    name: 'Website/Blog',
    icon: Globe,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    patterns: [] // Will be default for unmatched URLs
  }
}

// Auto-detect platform from URL
export const detectPlatform = (url: string) => {
  const lowerUrl = url.toLowerCase()
  
  for (const [platform, config] of Object.entries(PLATFORM_CONFIG)) {
    if (platform === 'website') continue // Skip website as it's the default
    
    for (const pattern of config.patterns) {
      if (lowerUrl.includes(pattern)) {
        return platform
      }
    }
  }
  
  // Default to website/blog for any valid URL
  return 'website'
}

// Validate URL
export const isValidUrl = (url: string) => {
  try {
    new URL(url)
    return true
  } catch {
    // Try adding https://
    try {
      new URL(`https://${url}`)
      return true
    } catch {
      return false
    }
  }
}

// Normalize URL (add https:// if missing)
export const normalizeUrl = (url: string) => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}
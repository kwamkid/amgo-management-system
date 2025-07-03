// lib/influencer/socialFetchers.ts

import { SocialPlatform, SocialMediaFetcher, SocialMediaFetchResult } from '@/types/influencer'

// Base fetcher class
abstract class BaseFetcher implements SocialMediaFetcher {
  abstract platform: SocialPlatform
  abstract canFetch: boolean
  
  abstract fetchData(url: string): Promise<SocialMediaFetchResult>
  
  // Helper to extract username from URL
  protected extractUsername(url: string, pattern: RegExp): string | null {
    const match = url.match(pattern)
    return match ? match[1] : null
  }
  
  // Helper to format number (1.2K, 1.5M, etc.)
  protected formatFollowerCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }
}

// YouTube Fetcher - Using YouTube Data API (requires API key)
class YouTubeFetcher extends BaseFetcher {
  platform: SocialPlatform = 'youtube'
  canFetch = true // Will need API key in env
  
  async fetchData(url: string): Promise<SocialMediaFetchResult> {
    try {
      // Extract channel info from URL
      const channelPattern = /(?:youtube\.com\/(?:c\/|channel\/|@))([A-Za-z0-9_-]+)/
      const username = this.extractUsername(url, channelPattern)
      
      if (!username) {
        return {
          success: false,
          platform: this.platform,
          error: 'Invalid YouTube URL'
        }
      }
      
      // TODO: Implement YouTube API call when API key is available
      // For now, return mock or manual input prompt
      return {
        success: false,
        platform: this.platform,
        error: 'YouTube API key not configured. Please enter follower count manually.'
      }
      
      /* Future implementation:
      const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forUsername=${username}&key=${API_KEY}`
      )
      const data = await response.json()
      
      if (data.items && data.items.length > 0) {
        const channel = data.items[0]
        return {
          success: true,
          platform: this.platform,
          data: {
            username: channel.snippet.title,
            followerCount: parseInt(channel.statistics.subscriberCount),
            isVerified: channel.status?.isLinked || false,
            profilePicture: channel.snippet.thumbnails.default.url,
            platformData: {
              subscriberCount: parseInt(channel.statistics.subscriberCount),
              videoCount: parseInt(channel.statistics.videoCount),
              viewCount: parseInt(channel.statistics.viewCount)
            }
          }
        }
      }
      */
    } catch (error) {
      return {
        success: false,
        platform: this.platform,
        error: error instanceof Error ? error.message : 'Failed to fetch YouTube data'
      }
    }
  }
}

// Twitter/X Fetcher - Limited without API
class TwitterFetcher extends BaseFetcher {
  platform: SocialPlatform = 'twitter'
  canFetch = false // Twitter API is expensive
  
  async fetchData(url: string): Promise<SocialMediaFetchResult> {
    try {
      const username = this.extractUsername(url, /(?:twitter|x)\.com\/([A-Za-z0-9_]+)/)
      
      if (!username) {
        return {
          success: false,
          platform: this.platform,
          error: 'Invalid Twitter/X URL'
        }
      }
      
      // Twitter API requires expensive access
      return {
        success: false,
        platform: this.platform,
        error: 'Twitter API not available. Please enter follower count manually.'
      }
    } catch (error) {
      return {
        success: false,
        platform: this.platform,
        error: 'Failed to fetch Twitter data'
      }
    }
  }
}

// TikTok Fetcher - Web scraping approach (limited)
class TikTokFetcher extends BaseFetcher {
  platform: SocialPlatform = 'tiktok'
  canFetch = false // Will need proxy/scraping service
  
  async fetchData(url: string): Promise<SocialMediaFetchResult> {
    try {
      const username = this.extractUsername(url, /tiktok\.com\/@([A-Za-z0-9_.]+)/)
      
      if (!username) {
        return {
          success: false,
          platform: this.platform,
          error: 'Invalid TikTok URL'
        }
      }
      
      // TikTok doesn't provide public API
      // Would need web scraping or unofficial API
      return {
        success: false,
        platform: this.platform,
        error: 'TikTok data fetching not available. Please enter follower count manually.'
      }
    } catch (error) {
      return {
        success: false,
        platform: this.platform,
        error: 'Failed to fetch TikTok data'
      }
    }
  }
}

// Instagram Fetcher - Requires Instagram Basic Display API
class InstagramFetcher extends BaseFetcher {
  platform: SocialPlatform = 'instagram'
  canFetch = false // Needs OAuth setup
  
  async fetchData(url: string): Promise<SocialMediaFetchResult> {
    try {
      const username = this.extractUsername(url, /instagram\.com\/([A-Za-z0-9_.]+)/)
      
      if (!username) {
        return {
          success: false,
          platform: this.platform,
          error: 'Invalid Instagram URL'
        }
      }
      
      // Instagram requires OAuth and approved app
      return {
        success: false,
        platform: this.platform,
        error: 'Instagram API not configured. Please enter follower count manually.'
      }
    } catch (error) {
      return {
        success: false,
        platform: this.platform,
        error: 'Failed to fetch Instagram data'
      }
    }
  }
}

// Facebook Fetcher - Limited to public page info
class FacebookFetcher extends BaseFetcher {
  platform: SocialPlatform = 'facebook'
  canFetch = false // Needs app review
  
  async fetchData(url: string): Promise<SocialMediaFetchResult> {
    try {
      // Facebook requires app review for page data
      return {
        success: false,
        platform: this.platform,
        error: 'Facebook API not configured. Please enter follower count manually.'
      }
    } catch (error) {
      return {
        success: false,
        platform: this.platform,
        error: 'Failed to fetch Facebook data'
      }
    }
  }
}

// Default fetcher for platforms without API
class DefaultFetcher extends BaseFetcher {
  constructor(public platform: SocialPlatform) {
    super()
  }
  
  canFetch = false
  
  async fetchData(url: string): Promise<SocialMediaFetchResult> {
    return {
      success: false,
      platform: this.platform,
      error: `Auto-fetch not available for ${this.platform}. Please enter data manually.`
    }
  }
}

// Fetcher Factory
export class SocialMediaFetcherFactory {
  private static fetchers: Map<SocialPlatform, SocialMediaFetcher> = new Map([
    ['youtube', new YouTubeFetcher()],
    ['twitter', new TwitterFetcher()],
    ['tiktok', new TikTokFetcher()],
    ['instagram', new InstagramFetcher()],
    ['facebook', new FacebookFetcher()],
    ['lemon8', new DefaultFetcher('lemon8')],
    ['website', new DefaultFetcher('website')],
    ['others', new DefaultFetcher('others')],
  ])
  
  static getFetcher(platform: SocialPlatform): SocialMediaFetcher {
    return this.fetchers.get(platform) || new DefaultFetcher(platform)
  }
  
  static async fetchSocialData(url: string, platform: SocialPlatform): Promise<SocialMediaFetchResult> {
    const fetcher = this.getFetcher(platform)
    return fetcher.fetchData(url)
  }
  
  static canFetch(platform: SocialPlatform): boolean {
    const fetcher = this.getFetcher(platform)
    return fetcher.canFetch
  }
}

// Utility functions
export async function tryFetchSocialData(url: string, platform: SocialPlatform): Promise<{
  data?: any
  error?: string
  needsManualInput: boolean
}> {
  const result = await SocialMediaFetcherFactory.fetchSocialData(url, platform)
  
  return {
    data: result.success ? result.data : undefined,
    error: result.error,
    needsManualInput: !result.success
  }
}

// Extract all social media info from text (for bulk import)
export function extractSocialMediaUrls(text: string): Array<{
  platform: SocialPlatform
  url: string
}> {
  const results: Array<{ platform: SocialPlatform; url: string }> = []
  
  // YouTube
  const youtubeMatch = text.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[A-Za-z0-9_-]+/)
  if (youtubeMatch) {
    results.push({ platform: 'youtube', url: youtubeMatch[0] })
  }
  
  // Instagram
  const instagramMatch = text.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/)
  if (instagramMatch) {
    results.push({ platform: 'instagram', url: instagramMatch[0] })
  }
  
  // TikTok
  const tiktokMatch = text.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/)
  if (tiktokMatch) {
    results.push({ platform: 'tiktok', url: tiktokMatch[0] })
  }
  
  // Twitter/X
  const twitterMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/)
  if (twitterMatch) {
    results.push({ platform: 'twitter', url: twitterMatch[0] })
  }
  
  // Facebook
  const facebookMatch = text.match(/(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\/\s]+/)
  if (facebookMatch) {
    results.push({ platform: 'facebook', url: facebookMatch[0] })
  }
  
  return results
}

// Helper to extract username from URL
export function extractUsernameFromUrl(url: string, platform: SocialPlatform): string | null {
  const patterns: Record<SocialPlatform, RegExp | null> = {
    youtube: /(?:youtube\.com\/(?:c\/|channel\/|@))([A-Za-z0-9_-]+)/,
    instagram: /instagram\.com\/([A-Za-z0-9_.]+)/,
    tiktok: /tiktok\.com\/@([A-Za-z0-9_.]+)/,
    twitter: /(?:twitter|x)\.com\/([A-Za-z0-9_]+)/,
    facebook: /facebook\.com\/([^\/\s?]+)/,
    lemon8: /lemon8-app\.com\/([^\/\s?]+)/,
    website: null,
    others: null
  }
  
  const pattern = patterns[platform]
  if (!pattern) return null
  
  const match = url.match(pattern)
  return match ? match[1] : null
}

// Helper to validate social media URL
export function validateSocialMediaUrl(url: string, platform: SocialPlatform): boolean {
  // More flexible patterns that accept various URL formats
  const patterns: Record<SocialPlatform, RegExp | null> = {
    youtube: /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/.+$/i,
    instagram: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/.+$/i,
    tiktok: /^(?:https?:\/\/)?(?:www\.|vm\.)?tiktok\.com\/.+$/i,
    twitter: /^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/.+$/i,
    facebook: /^(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.com|fb\.watch)\/.+$/i,
    lemon8: /^(?:https?:\/\/)?(?:www\.)?lemon8-app\.com\/.+$/i,
    website: /^https?:\/\/.+$/i,
    others: null
  }
  
  const pattern = patterns[platform]
  if (!pattern) return true // No validation for 'others'
  
  return pattern.test(url)
}
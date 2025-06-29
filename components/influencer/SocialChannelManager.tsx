// components/influencer/SocialChannelManager.tsx

'use client'

import { useState } from 'react'
import { 
  Facebook, 
  Instagram, 
  Music2, 
  Citrus, 
  Globe, 
  Youtube, 
  Twitter, 
  Plus,
  Trash2,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Check
} from 'lucide-react'
import { 
  SocialChannel, 
  SocialPlatform, 
  PLATFORM_INFO 
} from '@/types/influencer'
import { 
  SocialMediaFetcherFactory,
  validateSocialMediaUrl,
  extractUsernameFromUrl
} from '@/lib/influencer/socialFetchers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SocialChannelManagerProps {
  channels: SocialChannel[]
  onChange: (channels: SocialChannel[]) => void
  disabled?: boolean
}

// Icon mapping
const PLATFORM_ICONS: Record<SocialPlatform, any> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  lemon8: Citrus,
  website: Globe,
  youtube: Youtube,
  twitter: Twitter,
  others: Plus
}

export default function SocialChannelManager({
  channels = [],
  onChange,
  disabled = false
}: SocialChannelManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newChannel, setNewChannel] = useState<Partial<SocialChannel>>({
    platform: 'instagram' as SocialPlatform,
    profileUrl: '',
    followerCount: undefined
  })
  const [urlError, setUrlError] = useState<string>('')
  const [fetchingData, setFetchingData] = useState(false)

  // Add new channel
  const handleAddChannel = async () => {
    if (!newChannel.profileUrl || !newChannel.platform) {
      setUrlError('กรุณากรอก URL')
      return
    }

    // Validate URL format
    if (!validateSocialMediaUrl(newChannel.profileUrl, newChannel.platform)) {
      setUrlError('URL ไม่ถูกต้องสำหรับ ' + PLATFORM_INFO[newChannel.platform].name)
      return
    }

    // Check duplicate
    const isDuplicate = channels.some(
      ch => ch.profileUrl.toLowerCase() === newChannel.profileUrl!.toLowerCase()
    )
    if (isDuplicate) {
      setUrlError('URL นี้มีอยู่แล้ว')
      return
    }

    // Extract username
    const username = extractUsernameFromUrl(newChannel.profileUrl, newChannel.platform)

    // Try to fetch data (if available)
    if (SocialMediaFetcherFactory.canFetch(newChannel.platform)) {
      setFetchingData(true)
      try {
        const result = await SocialMediaFetcherFactory.fetchSocialData(
          newChannel.profileUrl,
          newChannel.platform
        )
        if (result.success && result.data) {
          newChannel.followerCount = result.data.followerCount
          newChannel.isVerified = result.data.isVerified
          newChannel.platformData = result.data.platformData
        }
      } catch (error) {
        console.error('Error fetching social data:', error)
      }
      setFetchingData(false)
    }

    // Add channel
    const channel: SocialChannel = {
      id: Date.now().toString(),
      platform: newChannel.platform,
      profileUrl: newChannel.profileUrl,
      username: username || undefined,
      followerCount: newChannel.followerCount || 0, // Default to 0 instead of undefined
      isVerified: newChannel.isVerified || false
    }

    onChange([...channels, channel])
    
    // Reset form
    setNewChannel({
      platform: 'instagram' as SocialPlatform,
      profileUrl: '',
      followerCount: undefined
    })
    setShowAddForm(false)
    setUrlError('')
  }

  // Update channel
  const handleUpdateChannel = (channelId: string, updates: Partial<SocialChannel>) => {
    const updated = channels.map(ch => 
      ch.id === channelId ? { ...ch, ...updates } : ch
    )
    onChange(updated)
  }

  // Remove channel
  const handleRemoveChannel = (channelId: string) => {
    onChange(channels.filter(ch => ch.id !== channelId))
  }

  // Format follower count
  const formatFollowers = (count?: number) => {
    if (!count) return '-'
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  return (
    <div className="space-y-4">
      {/* Channel List */}
      {channels.length > 0 && (
        <div className="space-y-3">
          {channels.map((channel) => {
            const Icon = PLATFORM_ICONS[channel.platform]
            const platformInfo = PLATFORM_INFO[channel.platform]
            
            return (
              <Card key={channel.id} className="p-4">
                <div className="flex items-start gap-4">
                  {/* Platform Icon */}
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${platformInfo.color}20` }}
                  >
                    <Icon 
                      className="w-5 h-5" 
                      style={{ color: platformInfo.color }}
                    />
                  </div>

                  {/* Channel Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {platformInfo.name}
                      </span>
                      {channel.isVerified && (
                        <Badge variant="info" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {channel.username && (
                        <span className="text-sm text-gray-500">
                          @{channel.username}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={channel.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {channel.profileUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Follower Count */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Followers:</Label>
                        {!disabled ? (
                          <Input
                            type="number"
                            value={channel.followerCount || ''}
                            onChange={(e) => handleUpdateChannel(channel.id!, {
                              followerCount: parseInt(e.target.value) || undefined
                            })}
                            placeholder="0"
                            className="w-32 h-8"
                            disabled={disabled}
                          />
                        ) : (
                          <span className="font-medium">
                            {formatFollowers(channel.followerCount)}
                          </span>
                        )}
                      </div>
                      
                      {channel.lastFetched && (
                        <span className="text-xs text-gray-500">
                          อัพเดท: {new Date(channel.lastFetched).toLocaleDateString('th-TH')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!disabled && (
                    <Button
                      onClick={() => handleRemoveChannel(channel.id!)}
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add New Channel Form */}
      {showAddForm ? (
        <Card className="p-4 border-2 border-dashed">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">เพิ่มช่องทาง Social Media</h4>
            
            {/* Platform Select */}
            <div>
              <Label>Platform</Label>
              <Select
                value={newChannel.platform}
                onValueChange={(value) => {
                  setNewChannel({ ...newChannel, platform: value as SocialPlatform })
                  setUrlError('')
                }}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_INFO).map(([key, info]) => {
                    const Icon = PLATFORM_ICONS[key as SocialPlatform]
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: info.color }} />
                          {info.name}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Profile URL */}
            <div>
              <Label>Profile URL</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={newChannel.profileUrl}
                  onChange={(e) => {
                    setNewChannel({ ...newChannel, profileUrl: e.target.value })
                    setUrlError('')
                  }}
                  placeholder={`เช่น: instagram.com/username`}
                  disabled={disabled || fetchingData}
                  className={urlError ? 'border-red-500' : ''}
                />
                {SocialMediaFetcherFactory.canFetch(newChannel.platform!) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!newChannel.profileUrl || fetchingData}
                    title="ดึงข้อมูลอัตโนมัติ"
                  >
                    <RefreshCw className={`w-4 h-4 ${fetchingData ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>
              {urlError && (
                <p className="text-sm text-red-600 mt-1">{urlError}</p>
              )}
            </div>

            {/* Follower Count (Manual) */}
            <div>
              <Label>จำนวน Followers</Label>
              <Input
                type="number"
                value={newChannel.followerCount || ''}
                onChange={(e) => setNewChannel({ 
                  ...newChannel, 
                  followerCount: parseInt(e.target.value) || undefined 
                })}
                placeholder="0"
                disabled={disabled || fetchingData}
              />
              <p className="text-xs text-gray-500 mt-1">
                กรอกจำนวน followers ปัจจุบัน
              </p>
            </div>

            {/* Auto-fetch info */}
            {!SocialMediaFetcherFactory.canFetch(newChannel.platform!) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  ระบบยังไม่รองรับการดึงข้อมูลอัตโนมัติสำหรับ {PLATFORM_INFO[newChannel.platform!].name}
                  กรุณากรอกข้อมูลด้วยตนเอง
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleAddChannel}
                disabled={disabled || fetchingData || !newChannel.profileUrl}
                className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                เพิ่ม
              </Button>
              <Button
                onClick={() => {
                  setShowAddForm(false)
                  setNewChannel({
                    platform: 'instagram' as SocialPlatform,
                    profileUrl: '',
                    followerCount: undefined
                  })
                  setUrlError('')
                }}
                variant="outline"
                disabled={fetchingData}
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          onClick={() => setShowAddForm(true)}
          variant="outline"
          disabled={disabled}
          className="w-full border-2 border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มช่องทาง Social Media
        </Button>
      )}

      {/* Total Followers Summary */}
      {channels.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Reach:</span>
            <span className="text-lg font-semibold text-gray-900">
              {formatFollowers(
                channels.reduce((sum, ch) => sum + (ch.followerCount || 0), 0)
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
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
  RefreshCw,
  Check,
  Share2
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
import { Input, Field, SelectMenu, Alert, Pill, Card, CardTitle, Button, IconButton, Spinner } from '@/components/aoo'
import { ListRows, ListRow } from '@/components/shared'
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

  const resetForm = () => {
    setShowAddForm(false)
    setNewChannel({
      platform: 'instagram' as SocialPlatform,
      profileUrl: '',
      followerCount: undefined
    })
    setUrlError('')
  }

  return (
    <div className="space-y-4">
      {/* Channel List */}
      {channels.length > 0 && (
        <ListRows variant="boxed">
          {channels.map((channel) => {
            const Icon = PLATFORM_ICONS[channel.platform]
            const platformInfo = PLATFORM_INFO[channel.platform]

            return (
              <ListRow
                key={channel.id}
                leading={
                  // สีแบรนด์ของแต่ละแพลตฟอร์ม — ค่าจากข้อมูล จึงยังเป็น style
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${platformInfo.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: platformInfo.color }} />
                  </div>
                }
                title={
                  <span className="flex items-center gap-2">
                    {platformInfo.name}
                    {channel.isVerified && (
                      <Pill tone="info">
                        <Check className="w-3 h-3" />
                        Verified
                      </Pill>
                    )}
                    {channel.username && (
                      <span className="text-sm font-normal text-gray-500">@{channel.username}</span>
                    )}
                  </span>
                }
                meta={
                  <div className="space-y-2 pt-1">
                    <a
                      href={channel.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1 break-all"
                    >
                      {channel.profileUrl}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>

                    {/* Follower Count */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Followers:</span>
                        {!disabled ? (
                          <Input
                            type="number"
                            value={channel.followerCount || ''}
                            onChange={(e) => handleUpdateChannel(channel.id!, {
                              followerCount: parseInt(e.target.value) || undefined
                            })}
                            placeholder="0"
                            className="w-32"
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
                }
                trailing={
                  !disabled ? (
                    <IconButton
                      icon={Trash2}
                      title="ลบช่องทาง"
                      tone="danger"
                      onClick={() => handleRemoveChannel(channel.id!)}
                    />
                  ) : undefined
                }
              />
            )
          })}
        </ListRows>
      )}

      {/* Add New Channel Form */}
      {showAddForm ? (
        <Card>
          <div className="space-y-4">
            <CardTitle icon={Share2} tone="info">เพิ่มช่องทาง Social Media</CardTitle>

            {/* Platform Select */}
            <Field label="Platform" asDiv>
              <SelectMenu
                size="md"
                value={newChannel.platform ?? null}
                options={Object.entries(PLATFORM_INFO).map(([key, info]) => ({ value: key, label: info.name }))}
                onChange={(value) => {
                  if (!value) return
                  setNewChannel({ ...newChannel, platform: value as SocialPlatform })
                  setUrlError('')
                }}
                disabled={disabled}
              />
            </Field>

            {/* Profile URL */}
            <Field label="Profile URL" asDiv error={urlError || undefined}>
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
                  error={!!urlError}
                  className="flex-1"
                />
                {SocialMediaFetcherFactory.canFetch(newChannel.platform!) && (
                  fetchingData ? (
                    <Spinner size="sm" />
                  ) : (
                    <IconButton
                      icon={RefreshCw}
                      tone="sunken"
                      size={40}
                      disabled={!newChannel.profileUrl}
                      title="ดึงข้อมูลอัตโนมัติ"
                    />
                  )
                )}
              </div>
            </Field>

            {/* Follower Count (Manual) */}
            <Field label="จำนวน Followers" help="กรอกจำนวน followers ปัจจุบัน">
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
            </Field>

            {/* Auto-fetch info */}
            {!SocialMediaFetcherFactory.canFetch(newChannel.platform!) && (
              <Alert tone="info">
                ระบบยังไม่รองรับการดึงข้อมูลอัตโนมัติสำหรับ {PLATFORM_INFO[newChannel.platform!].name}
                กรุณากรอกข้อมูลด้วยตนเอง
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                type="button"
                icon="Plus"
                loading={fetchingData}
                onClick={handleAddChannel}
                disabled={disabled || !newChannel.profileUrl}
              >
                เพิ่ม
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm} disabled={fetchingData}>
                ยกเลิก
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          type="button"
          variant="secondary"
          icon="Plus"
          onClick={() => setShowAddForm(true)}
          disabled={disabled}
          className="w-full"
        >
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

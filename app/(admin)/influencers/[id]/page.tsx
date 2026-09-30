// app/(admin)/influencers/[id]/page.tsx

'use client'


import { use } from 'react'
import { useInfluencer } from '@/hooks/useInfluencers'
import {
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Baby,
  ExternalLink,
  Facebook,
  Instagram,
  Music2,
  Citrus,
  Globe,
  Youtube,
  Twitter,
  Plus,
  Check,
  User,
  Share2,
  StickyNote,
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import { StatCard, PageHeader, StatusBadge, statusLabel, ListRows, ListRow } from '@/components/shared'
import { PLATFORM_INFO } from '@/types/influencer'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

import { Alert, Pill, Card, CardContent, CardHeader, CardTitle, Button, IconButton } from '@/components/aoo'
// Platform icon mapping
const PLATFORM_ICONS: Record<string, any> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  lemon8: Citrus,
  website: Globe,
  youtube: Youtube,
  twitter: Twitter,
  others: Plus
}

export default function InfluencerDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  const { influencer, loading, error } = useInfluencer(id)

  // Format follower count
  const formatFollowers = (count?: number) => {
    if (!count) return '0'
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  // Calculate age
  const calculateAge = (birthDate: string | Date | undefined): string => {
    if (!birthDate) return '-'
    
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    
    if (age < 1) {
      const months = monthDiff < 0 ? 12 + monthDiff : monthDiff
      return `${months} เดือน`
    }
    
    return `${age} ปี`
  }

  if (loading && !influencer) return <TechLoader />

  if (error || !influencer) {
    return (
      <div className="max-w-4xl">
        <Alert
          tone="error"
          action={
            <Link href="/influencers">
              <Button variant="soft" size="sm" icon="ChevronLeft">กลับไปหน้ารายการ</Button>
            </Link>
          }
        >
          {error || 'ไม่พบข้อมูล Influencer'}
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <PageHeader
        title={influencer.fullName}
        backHref="/influencers"
        description={
          <span className="flex items-center gap-2">
            <span>{influencer.nickname}</span>
            <span className="text-gray-400">•</span>
            <StatusBadge
              status={influencer.tier}
              kind="tier"
              label={`${statusLabel(influencer.tier, 'tier')} Influencer`}
            />
          </span>
        }
        actions={
          <Link href={`/influencers/${id}/edit`}>
            <Button icon="Pencil">แก้ไขข้อมูล</Button>
          </Link>
        }
      />

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Reach" value={formatFollowers(influencer.totalFollowers)} tone="plum" />
        <StatCard label="Channels" value={influencer.socialChannels?.length || 0} tone="sky" />
        <StatCard label="จำนวนลูก" value={influencer.children?.length || 0} unit="คน" tone="pink" />
        <StatCard label="สถานะ" value={influencer.isActive ? 'Active' : 'Inactive'} tone={influencer.isActive ? 'success' : 'muted'} />
      </div>

      {/* Personal Info */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={User} tone="accent">ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">ชื่อ-นามสกุล</p>
                <p className="font-medium text-base">{influencer.fullName}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">ชื่อเล่น</p>
                <p className="font-medium text-base">{influencer.nickname}</p>
              </div>

              {influencer.birthDate && (
                <div>
                  <p className="text-sm text-gray-600">วันเกิด</p>
                  <p className="font-medium text-base">
                    {format(new Date(influencer.birthDate), 'dd MMMM yyyy', { locale: th })}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  เบอร์โทรศัพท์
                </p>
                <p className="font-medium text-base">{influencer.phone}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  อีเมล
                </p>
                <p className="font-medium text-base">{influencer.email}</p>
              </div>

              {influencer.lineId && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    LINE ID
                  </p>
                  <p className="font-medium text-base">{influencer.lineId}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      {(influencer.shippingAddress || influencer.province) && (
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={MapPin} tone="grape">ที่อยู่จัดส่งสินค้า</CardTitle>
          </CardHeader>
          <CardContent>
            {influencer.shippingAddress && (
              <p className="text-gray-700 mb-2">{influencer.shippingAddress}</p>
            )}
            {influencer.province && (
              <p className="text-gray-600">จังหวัด: {influencer.province}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Social Media Channels */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Share2} tone="sky">Social Media Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <ListRows variant="boxed">
            {influencer.socialChannels?.map((channel) => {
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
                    </span>
                  }
                  meta={channel.username ? `@${channel.username}` : undefined}
                  trailing={
                    <>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Followers</p>
                        <p className="font-semibold text-lg">
                          {formatFollowers(channel.followerCount)}
                        </p>
                      </div>
                      <IconButton
                        icon={ExternalLink}
                        title="เปิดโปรไฟล์"
                        onClick={() => window.open(channel.profileUrl, '_blank', 'noopener,noreferrer')}
                      />
                    </>
                  }
                />
              )
            })}
          </ListRows>
        </CardContent>
      </Card>

      {/* Children Info */}
      {influencer.children && influencer.children.length > 0 && (
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={Baby} tone="pink">ข้อมูลลูก</CardTitle>
          </CardHeader>
          <CardContent>
            <ListRows variant="boxed">
              {influencer.children.map((child, index) => (
                <ListRow
                  key={child.id}
                  leading={
                    <span className="aoo-title-icon" data-tone={child.gender === 'male' ? 'sky' : 'pink'}>
                      <Baby size={19} strokeWidth={2} />
                    </span>
                  }
                  title={`ลูกคนที่ ${index + 1}: ${child.nickname}`}
                  meta={child.gender === 'male' ? 'ชาย' : 'หญิง'}
                  trailing={
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        เกิด: {child.birthDate
                          ? format(new Date(child.birthDate), 'dd MMM yyyy', { locale: th })
                          : '-'
                        }
                      </p>
                      <p className="text-sm font-medium">
                        อายุ: {calculateAge(child.birthDate)}
                      </p>
                    </div>
                  }
                />
              ))}
            </ListRows>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {influencer.notes && (
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={StickyNote} tone="warning">หมายเหตุ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{influencer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">สร้างเมื่อ</p>
            <p className="font-medium">
              {influencer.createdAt
                ? format(new Date(influencer.createdAt), 'dd MMMM yyyy HH:mm', { locale: th })
                : '-'
              }
            </p>
          </div>
          <div>
            <p className="text-gray-600">แก้ไขล่าสุด</p>
            <p className="font-medium">
              {influencer.updatedAt
                ? format(new Date(influencer.updatedAt), 'dd MMMM yyyy HH:mm', { locale: th })
                : '-'
              }
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

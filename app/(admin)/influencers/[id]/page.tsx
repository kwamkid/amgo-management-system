// app/(admin)/influencers/[id]/page.tsx

'use client'

import { use } from 'react'
import { useInfluencer } from '@/hooks/useInfluencers'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  Calendar,
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
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PLATFORM_INFO } from '@/types/influencer'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

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
  const router = useRouter()
  const { influencer, loading, error } = useInfluencer(id)

  // Format follower count
  const formatFollowers = (count?: number) => {
    if (!count) return '0'
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  // Get tier badge
  const getTierBadge = (tier: string) => {
    const tierConfig = {
      nano: { label: 'Nano', variant: 'secondary' as const },
      micro: { label: 'Micro', variant: 'info' as const },
      macro: { label: 'Macro', variant: 'warning' as const },
      mega: { label: 'Mega', variant: 'error' as const }
    }
    
    const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.nano
    return <Badge variant={config.variant}>{config.label} Influencer</Badge>
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

  if (loading && !influencer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          <p className="mt-2 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  if (error || !influencer) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="mb-4 text-base">
              {error || 'ไม่พบข้อมูล Influencer'}
            </p>
            <Button
              asChild
              variant="outline"
              className="bg-red-50 hover:bg-red-100 text-red-700"
            >
              <Link href="/influencers">
                <ArrowLeft className="w-4 h-4 mr-2" />
                กลับไปหน้ารายการ
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/influencers')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {influencer.fullName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-600">{influencer.nickname}</span>
              <span className="text-gray-400">•</span>
              {getTierBadge(influencer.tier)}
            </div>
          </div>
        </div>
        
        <Button
          asChild
          className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
        >
          <Link href={`/influencers/${id}/edit`}>
            <Edit className="w-4 h-4 mr-2" />
            แก้ไขข้อมูล
          </Link>
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Total Reach</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatFollowers(influencer.totalFollowers)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Channels</p>
            <p className="text-2xl font-bold text-gray-900">
              {influencer.socialChannels?.length || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">จำนวนลูก</p>
            <p className="text-2xl font-bold text-gray-900">
              {influencer.children?.length || 0} คน
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">สถานะ</p>
            <div className="mt-1">
              {influencer.isActive ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="error">Inactive</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-red-600" />
            ข้อมูลส่วนตัว
          </CardTitle>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-600" />
              ที่อยู่จัดส่งสินค้า
            </CardTitle>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Social Media Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {influencer.socialChannels?.map((channel) => {
              const Icon = PLATFORM_ICONS[channel.platform]
              const platformInfo = PLATFORM_INFO[channel.platform]
              
              return (
                <div key={channel.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${platformInfo.color}20` }}
                    >
                      <Icon 
                        className="w-5 h-5" 
                        style={{ color: platformInfo.color }}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{platformInfo.name}</p>
                        {channel.isVerified && (
                          <Badge variant="info" className="text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      {channel.username && (
                        <p className="text-sm text-gray-600">@{channel.username}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Followers</p>
                      <p className="font-semibold text-lg">
                        {formatFollowers(channel.followerCount)}
                      </p>
                    </div>
                    
                    <a
                      href={channel.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-600" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Children Info */}
      {influencer.children && influencer.children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Baby className="w-5 h-5 text-red-600" />
              ข้อมูลลูก
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {influencer.children.map((child, index) => (
                <div key={child.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      child.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'
                    }`}>
                      <Baby className={`w-5 h-5 ${
                        child.gender === 'male' ? 'text-blue-600' : 'text-pink-600'
                      }`} />
                    </div>
                    
                    <div>
                      <p className="font-medium">
                        ลูกคนที่ {index + 1}: {child.nickname}
                      </p>
                      <p className="text-sm text-gray-600">
                        {child.gender === 'male' ? 'ชาย' : 'หญิง'}
                      </p>
                    </div>
                  </div>
                  
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {influencer.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">หมายเหตุ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{influencer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>
    </div>
  )
}
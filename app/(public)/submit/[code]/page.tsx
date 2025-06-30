// ========== FILE: app/(public)/submit/[code]/page.tsx ==========
'use client'

import { use, useState, useEffect } from 'react'
import { 
  Plus,
  Trash2,
  Save,
  Send,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { useSubmission } from '@/hooks/useSubmission'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { safeFormatDate } from '@/lib/utils/date'
import { th } from 'date-fns/locale'
import TechLoader from '@/components/shared/TechLoader'
import { 
  PLATFORM_CONFIG, 
  detectPlatform, 
  isValidUrl, 
  normalizeUrl 
} from '@/lib/utils/submission'

export default function SubmissionPage({ 
  params 
}: { 
  params: Promise<{ code: string }> 
}) {
  const { code } = use(params)
  const [linkInput, setLinkInput] = useState('')
  const [links, setLinks] = useState<Array<{
    id: string
    url: string
    platform: string
  }>>([])
  const [errors, setErrors] = useState<{
    input?: string
    submit?: string
  }>({})
  
  const {
    campaign,
    submission,
    loading,
    error,
    saveSubmission,
    submitFinal
  } = useSubmission(code)

  // Load existing links if editing
  useEffect(() => {
    if (submission?.links) {
      setLinks(submission.links.map(link => ({
        id: link.id,
        url: link.url,
        platform: link.platform || detectPlatform(link.url)
      })))
    }
  }, [submission])

  // Add link
  const handleAddLink = () => {
    const trimmedUrl = linkInput.trim()
    
    // Validate
    if (!trimmedUrl) {
      setErrors({ input: 'กรุณาใส่ link' })
      return
    }
    
    if (!isValidUrl(trimmedUrl)) {
      setErrors({ input: 'กรุณาใส่ link ที่ถูกต้อง' })
      return
    }
    
    const normalizedUrl = normalizeUrl(trimmedUrl)
    
    // Check duplicate
    if (links.some(link => link.url === normalizedUrl)) {
      setErrors({ input: 'Link นี้เพิ่มแล้ว' })
      return
    }
    
    // Add link
    const newLink = {
      id: Date.now().toString(),
      url: normalizedUrl,
      platform: detectPlatform(normalizedUrl)
    }
    
    setLinks([...links, newLink])
    setLinkInput('')
    setErrors({})
  }

  // Remove link
  const handleRemoveLink = (id: string) => {
    setLinks(links.filter(link => link.id !== id))
  }

  // Save draft
  const handleSaveDraft = async () => {
    if (links.length === 0) {
      setErrors({ submit: 'กรุณาเพิ่ม link อย่างน้อย 1 link' })
      return
    }
    
    const success = await saveSubmission(links, true)
    if (!success) {
      setErrors({ submit: 'ไม่สามารถบันทึกได้ กรุณาลองใหม่' })
    }
  }

  // Submit final
  const handleSubmitFinal = async () => {
    if (links.length === 0) {
      setErrors({ submit: 'กรุณาเพิ่ม link อย่างน้อย 1 link' })
      return
    }
    
    if (confirm('ยืนยันการส่งผลงาน? (ไม่สามารถแก้ไขได้หลังส่ง)')) {
      const success = await submitFinal(links)
      if (!success) {
        setErrors({ submit: 'ไม่สามารถส่งผลงานได้ กรุณาลองใหม่' })
      }
    }
  }

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddLink()
    }
  }

  if (loading) {
    return <TechLoader />
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                ไม่พบ Link นี้
              </h2>
              <p className="text-gray-600">
                {error || 'Link อาจหมดอายุหรือไม่ถูกต้อง กรุณาติดต่อทีม Marketing'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const platformConfig = PLATFORM_CONFIG[detectPlatform(linkInput) as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.website

  // Get current status from submission data
  const currentStatus = submission?.status || 'pending'

  // Check if already submitted and not in revision
  if (currentStatus === 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                ส่งผลงานเรียบร้อยแล้ว
              </h2>
              <p className="text-gray-600">
                ขอบคุณสำหรับการส่งผลงาน ทีม Marketing จะตรวจสอบและติดต่อกลับ
              </p>
              <Badge className="mt-4 bg-green-100 text-green-700">
                Status: ผ่านการตรวจสอบแล้ว
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if submitted and waiting for review (cannot edit)
  if (currentStatus === 'submitted' || currentStatus === 'resubmitted') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                รอการตรวจสอบ
              </h2>
              <p className="text-gray-600 mb-4">
                คุณได้ส่งผลงานเรียบร้อยแล้ว กำลังรอทีม Marketing ตรวจสอบ
              </p>
              <Badge className="bg-yellow-100 text-yellow-700">
                Status: รอตรวจสอบ
              </Badge>
              
              {/* Show submitted links */}
              {submission?.links && submission.links.length > 0 && (
                <div className="mt-6 text-left">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    ผลงานที่ส่งไปแล้ว:
                  </p>
                  <div className="space-y-2">
                    {submission.links.map((link: any, idx: number) => {
                      const config = PLATFORM_CONFIG[link.platform as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.website
                      const Icon = config.icon
                      
                      return (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          <span className="text-gray-600 truncate">{link.url}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">
                ส่งผลงาน
              </h1>
              <p className="text-gray-600">
                Campaign: {campaign.name}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">สำหรับคุณ</p>
                <p className="font-medium">
                  {campaign.influencerName}
                  {campaign.influencerNickname && (
                    <span className="text-gray-500"> (@{campaign.influencerNickname})</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-600 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Deadline
                </p>
                <p className="font-medium">
                  {safeFormatDate(campaign.deadline, 'dd MMMM yyyy', { locale: th })}
                </p>
              </div>
            </div>
            
            {campaign.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600 mb-1">Brief:</p>
                <p className="text-sm">{campaign.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Show revision notes if any */}
        {currentStatus === 'revision' && submission?.reviewNotes && (
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-1">ต้องแก้ไขผลงาน:</p>
              <p>{submission.reviewNotes}</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Add Link Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">เพิ่ม Link ผลงาน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  placeholder="วาง link ของคุณที่นี่..."
                  value={linkInput}
                  onChange={(e) => {
                    setLinkInput(e.target.value)
                    setErrors({})
                  }}
                  onKeyPress={handleKeyPress}
                  className={errors.input ? 'border-red-500' : ''}
                />
                {linkInput && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className={`p-1 rounded ${platformConfig.bgColor}`}>
                      <platformConfig.icon className={`w-4 h-4 ${platformConfig.color}`} />
                    </div>
                  </div>
                )}
              </div>
              <Button
                onClick={handleAddLink}
                className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            {errors.input && (
              <p className="text-sm text-red-600 mt-1">{errors.input}</p>
            )}
          </CardContent>
        </Card>

        {/* Links List */}
        {links.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">
                Links ที่เพิ่มแล้ว ({links.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {links.map((link) => {
                const config = PLATFORM_CONFIG[link.platform as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.website
                const Icon = config.icon
                
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {config.name}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {link.url}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveLink(link.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={links.length === 0}
            className="flex-1"
          >
            <Save className="w-4 h-4 mr-2" />
            บันทึกแบบร่าง
          </Button>
          <Button
            onClick={handleSubmitFinal}
            disabled={links.length === 0}
            className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
          >
            <Send className="w-4 h-4 mr-2" />
            {currentStatus === 'revision' ? 'ส่งผลงานแก้ไข' : 'ส่งผลงาน'}
          </Button>
        </div>

        {errors.submit && (
          <Alert variant="error" className="mt-4">
            <AlertDescription>{errors.submit}</AlertDescription>
          </Alert>
        )}

        {/* Status */}
        {submission && (
          <div className="mt-4 text-center">
            {currentStatus === 'submitted' && (
              <Badge className="bg-yellow-100 text-yellow-700">
                รอตรวจสอบ
              </Badge>
            )}
            {currentStatus === 'revision' && (
              <Badge className="bg-orange-100 text-orange-700">
                ต้องแก้ไขตามคำแนะนำ
              </Badge>
            )}
            {submission?.isDraft && currentStatus === 'pending' && (
              <Badge className="bg-gray-100 text-gray-700">
                บันทึกแบบร่างแล้ว
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
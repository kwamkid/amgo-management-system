// ========== FILE: app/(public)/submit/[code]/page.tsx ==========
'use client'

import { use, useState, useEffect } from 'react'
import {
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  Link as LinkIcon,
  ListChecks,
} from 'lucide-react'
import { useSubmission } from '@/hooks/useSubmission'
import { safeFormatDate } from '@/lib/utils/date'
import { th } from 'date-fns/locale'
import TechLoader from '@/components/shared/TechLoader'
import { 
  PLATFORM_CONFIG, 
  detectPlatform, 
  isValidUrl, 
  normalizeUrl 
} from '@/lib/utils/submission'

import {
  Input,
  Field,
  Alert,
  Pill,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  IconButton,
  EmptyState,
  useConfirm,
} from '@/components/aoo'
import { InfoPanel, ListRows, ListRow } from '@/components/shared'

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
  const { confirm, dialog } = useConfirm()

// Load existing links if editing
  useEffect(() => {
    if (submission?.links) {
      setLinks(submission.links.map((link: any) => ({
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
    
    const ok = await confirm({
      title: 'ยืนยันการส่งผลงาน?',
      description: 'ไม่สามารถแก้ไขได้หลังส่ง',
      confirmLabel: 'ส่งผลงาน',
    })
    if (ok) {
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
          <EmptyState
            icon={<AlertCircle size={48} className="text-red-500" />}
            title="ไม่พบ Link นี้"
            body={error || 'Link อาจหมดอายุหรือไม่ถูกต้อง กรุณาติดต่อทีม Marketing'}
          />
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
          <EmptyState
            icon={<CheckCircle size={48} className="text-green-500" />}
            title="ส่งผลงานเรียบร้อยแล้ว"
            body="ขอบคุณสำหรับการส่งผลงาน ทีม Marketing จะตรวจสอบและติดต่อกลับ"
            action={<Pill tone="success">Status: ผ่านการตรวจสอบแล้ว</Pill>}
          />
        </Card>
      </div>
    )
  }

  // Check if submitted and waiting for review (cannot edit)
  if (currentStatus === 'submitted' || currentStatus === 'resubmitted') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <EmptyState
            icon={<Clock size={48} className="text-yellow-500" />}
            title="รอการตรวจสอบ"
            body="คุณได้ส่งผลงานเรียบร้อยแล้ว กำลังรอทีม Marketing ตรวจสอบ"
            action={<Pill tone="warning">Status: รอตรวจสอบ</Pill>}
          />

          {/* Show submitted links */}
          {submission?.links && submission.links.length > 0 && (
            <div className="mt-2 text-left">
              <p className="text-sm font-medium text-gray-700 mb-2">
                ผลงานที่ส่งไปแล้ว:
              </p>
              <div className="space-y-2">
                {submission.links.map((link: any, idx: number) => {
                  const config = PLATFORM_CONFIG[link.platform as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.website
                  const Icon = config.icon

                  return (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
                      <span className="text-gray-600 truncate">{link.url}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {dialog}
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card padding={0} className="mb-6">
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
              <InfoPanel className="mt-4">
                <p className="text-sm text-gray-600 mb-1">Brief:</p>
                <p className="text-sm">{campaign.description}</p>
              </InfoPanel>
            )}
          </CardContent>
        </Card>

        {/* Show revision notes if any */}
        {currentStatus === 'revision' && submission?.reviewNotes && (
          <Alert tone="warning" title="ต้องแก้ไขผลงาน:" className="mb-6">
            {submission.reviewNotes}
          </Alert>
        )}

        {/* Add Link Form */}
        <Card padding={0} className="mb-6">
          <CardHeader>
            <CardTitle icon={LinkIcon} tone="accent">เพิ่ม Link ผลงาน</CardTitle>
          </CardHeader>
          <CardContent>
            <Field asDiv error={errors.input}>
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
                    error={!!errors.input}
                  />
                  {linkInput && (
                    // สีประจำแพลตฟอร์ม (โซเชียล) มาจาก PLATFORM_CONFIG
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className={`p-1 rounded ${platformConfig.bgColor}`}>
                        <platformConfig.icon className={`w-4 h-4 ${platformConfig.color}`} />
                      </div>
                    </div>
                  )}
                </div>
                <Button icon="Plus" onClick={handleAddLink} aria-label="เพิ่ม Link" />
              </div>
            </Field>
          </CardContent>
        </Card>

        {/* Links List */}
        {links.length > 0 && (
          <Card padding={0} className="mb-6">
            <CardHeader>
              <CardTitle icon={ListChecks} tone="sky">
                Links ที่เพิ่มแล้ว ({links.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ListRows variant="boxed">
                {links.map((link) => {
                  const config = PLATFORM_CONFIG[link.platform as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.website
                  const Icon = config.icon

                  return (
                    <ListRow
                      key={link.id}
                      leading={
                        <div className={`p-2 rounded-lg ${config.bgColor}`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                      }
                      title={config.name}
                      meta={<span className="block truncate">{link.url}</span>}
                      trailing={
                        <IconButton
                          icon={Trash2}
                          title="ลบ Link"
                          tone="danger"
                          onClick={() => handleRemoveLink(link.id)}
                        />
                      }
                    />
                  )
                })}
              </ListRows>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="soft" icon="Save" onClick={handleSaveDraft} disabled={links.length === 0} className="flex-1">
            บันทึกแบบร่าง
          </Button>
          <Button icon="Send" onClick={handleSubmitFinal} disabled={links.length === 0} className="flex-1">
            {currentStatus === 'revision' ? 'ส่งผลงานแก้ไข' : 'ส่งผลงาน'}
          </Button>
        </div>

        {errors.submit && (
          <Alert tone="error" className="mt-4">{errors.submit}</Alert>
        )}

        {/* Status */}
        {submission && (
          <div className="mt-4 text-center">
            {currentStatus === 'submitted' && (
              <Pill tone="warning">รอตรวจสอบ</Pill>
            )}
            {currentStatus === 'revision' && (
              <Pill tone="accent">ต้องแก้ไขตามคำแนะนำ</Pill>
            )}
            {submission?.isDraft && currentStatus === 'pending' && (
              <Pill tone="neutral">บันทึกแบบร่างแล้ว</Pill>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

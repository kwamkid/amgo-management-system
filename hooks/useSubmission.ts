// ========== FILE: hooks/useSubmission.ts ==========
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import * as submissionService from '@/lib/services/submissionService'

export const useSubmission = (code: string) => {
  const [campaign, setCampaign] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get campaign and submission data by code
        const data = await submissionService.getSubmissionByCode(code)
        
        if (!data) {
          setError('ไม่พบ link นี้')
          return
        }
        
        setCampaign(data.campaign)
        setSubmission(data.submission)
      } catch (err) {
        console.error('Error fetching submission:', err)
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      fetchData()
    }
  }, [code])

  const saveSubmission = async (links: any[], isDraft: boolean) => {
    try {
      await submissionService.saveSubmission(code, links, isDraft)
      showToast('บันทึกสำเร็จ', 'success')
      
      // Refresh data
      const data = await submissionService.getSubmissionByCode(code)
      setSubmission(data?.submission)
      
      return true
    } catch (err) {
      console.error('Error saving submission:', err)
      showToast('บันทึกไม่สำเร็จ', 'error')
      return false
    }
  }

  const submitFinal = async (links: any[]) => {
    try {
      await submissionService.submitFinal(code, links)
      showToast('ส่งผลงานสำเร็จ!', 'success')
      
      // Refresh data
      const data = await submissionService.getSubmissionByCode(code)
      setSubmission(data?.submission)
      
      return true
    } catch (err) {
      console.error('Error submitting:', err)
      showToast('ส่งผลงานไม่สำเร็จ', 'error')
      return false
    }
  }

  return {
    campaign,
    submission,
    loading,
    error,
    saveSubmission,
    submitFinal
  }
}
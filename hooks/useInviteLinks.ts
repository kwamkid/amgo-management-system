// hooks/useInviteLinks.ts

import { useState, useEffect, useCallback } from 'react'
import { InviteLink, CreateInviteLinkData } from '@/types/invite'
import * as inviteService from '@/lib/services/inviteService'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'

export const useInviteLinks = (activeOnly = false) => {
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const { userData } = useAuth()

  // Fetch invite links
  const fetchInviteLinks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const links = await inviteService.getInviteLinks(activeOnly)
      setInviteLinks(links)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invite links'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  // Create invite link
  const createInviteLink = async (data: CreateInviteLinkData): Promise<boolean> => {
    try {
      setLoading(true)
      
      // Use current user data if available, otherwise use defaults
      const createdBy = userData?.id || 'system'
      const createdByName = userData?.fullName || userData?.lineDisplayName || 'System Admin'
      
      await inviteService.createInviteLink(
        data,
        createdBy,
        createdByName
      )
      showToast('สร้างลิงก์สำเร็จ', 'success')
      await fetchInviteLinks() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create invite link'
      showToast(message, 'error')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Update invite link
  const updateInviteLink = async (
    linkId: string,
    data: { isActive?: boolean; maxUses?: number; expiresAt?: string; note?: string }
  ): Promise<boolean> => {
    try {
      setLoading(true)
      await inviteService.updateInviteLink(linkId, data)
      showToast('อัพเดทลิงก์สำเร็จ', 'success')
      await fetchInviteLinks() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update invite link'
      showToast(message, 'error')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Delete invite link
  const deleteInviteLink = async (linkId: string): Promise<boolean> => {
    try {
      setLoading(true)
      await inviteService.deleteInviteLink(linkId)
      showToast('ปิดใช้งานลิงก์สำเร็จ', 'success')
      await fetchInviteLinks() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete invite link'
      showToast(message, 'error')
      return false
    } finally {
      setLoading(false)
    }
  }

  // Generate new code
  const generateCode = (): string => {
    return inviteService.generateInviteCode()
  }

  // Copy link to clipboard
  const copyInviteLink = (code: string) => {
    const url = `${window.location.origin}/register/invite?invite=${code}`
    navigator.clipboard.writeText(url)
    showToast('คัดลอกลิงก์แล้ว', 'success')
  }

  useEffect(() => {
    fetchInviteLinks()
  }, [])

  return {
    inviteLinks,
    loading,
    error,
    createInviteLink,
    updateInviteLink,
    deleteInviteLink,
    generateCode,
    copyInviteLink,
    refetch: fetchInviteLinks
  }
}

// Hook for single invite link
export const useInviteLink = (linkId: string) => {
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInviteLink = async () => {
      if (!linkId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        const [link, linkStats] = await Promise.all([
          inviteService.getInviteLink(linkId),
          inviteService.getInviteLinkStats(linkId)
        ])
        
        setInviteLink(link)
        setStats(linkStats)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch invite link'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchInviteLink()
  }, [linkId])

  return { inviteLink, stats, loading, error }
}

// Hook for validating invite code
export const useValidateInvite = () => {
  const [validating, setValidating] = useState(false)
  
  const validateInvite = async (code: string) => {
    try {
      setValidating(true)
      const result = await inviteService.validateInviteLink(code)
      return result
    } catch (err) {
      return { 
        valid: false, 
        error: 'เกิดข้อผิดพลาดในการตรวจสอบ' 
      }
    } finally {
      setValidating(false)
    }
  }
  
  return { validateInvite, validating }
}
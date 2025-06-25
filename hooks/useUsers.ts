// hooks/useUsers.ts

import { useState, useEffect, useCallback } from 'react'
import { User, UserFilters } from '@/types/user'
import * as userService from '@/lib/services/userService'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'

interface UseUsersOptions {
  pageSize?: number
  role?: string
  isActive?: boolean
  locationId?: string
}

export const useUsers = (options?: UseUsersOptions) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const { showToast } = useToast()
  const { userData } = useAuth()

  // Fetch users with pagination
  const fetchUsers = useCallback(async (loadMore = false) => {
    try {
      setLoading(true)
      setError(null)
      
      const filters = {
        role: options?.role,
        isActive: options?.isActive,
        locationId: options?.locationId
      }
      
      const result = await userService.getUsers(
        options?.pageSize || 20,
        loadMore ? lastDoc : undefined,
        filters
      )
      
      if (loadMore) {
        setUsers(prev => [...prev, ...result.users])
      } else {
        setUsers(result.users)
      }
      
      setLastDoc(result.lastDoc)
      setHasMore(result.hasMore)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [options, lastDoc])

  // Load more users
  const loadMore = () => {
    if (hasMore && !loading) {
      fetchUsers(true)
    }
  }

  // Approve user
  const approveUser = async (userId: string): Promise<boolean> => {
    try {
      if (!userData?.id) {
        showToast('ไม่พบข้อมูลผู้อนุมัติ', 'error')
        return false
      }
      
      await userService.approveUser(userId, userData.id)
      showToast('อนุมัติผู้ใช้งานสำเร็จ', 'success')
      await fetchUsers() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve user'
      showToast(message, 'error')
      return false
    }
  }

  // Deactivate user
  const deactivateUser = async (userId: string): Promise<boolean> => {
    try {
      await userService.deactivateUser(userId)
      showToast('ระงับผู้ใช้งานสำเร็จ', 'success')
      await fetchUsers() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to deactivate user'
      showToast(message, 'error')
      return false
    }
  }

  // Update user role
  const updateUserRole = async (userId: string, role: string): Promise<boolean> => {
    try {
      await userService.updateUserRole(userId, role)
      showToast('อัพเดทสิทธิ์สำเร็จ', 'success')
      await fetchUsers() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user role'
      showToast(message, 'error')
      return false
    }
  }

  // Update user locations
  const updateUserLocations = async (userId: string, locationIds: string[]): Promise<boolean> => {
    try {
      await userService.updateUserLocations(userId, locationIds)
      showToast('อัพเดทสถานที่สำเร็จ', 'success')
      await fetchUsers() // Refresh list
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user locations'
      showToast(message, 'error')
      return false
    }
  }

  // Search users
  const searchUsers = async (searchTerm: string): Promise<User[]> => {
    try {
      if (!searchTerm.trim()) {
        await fetchUsers()
        return users
      }
      
      setLoading(true)
      const results = await userService.searchUsers(searchTerm)
      setUsers(results)
      return results
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search users'
      showToast(message, 'error')
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, []) // Empty deps, fetchUsers มี useCallback

  return {
    users,
    loading,
    error,
    hasMore,
    loadMore,
    approveUser,
    deactivateUser,
    updateUserRole,
    updateUserLocations,
    searchUsers,
    refetch: fetchUsers
  }
}

// Hook for pending users
export const usePendingUsers = () => {
  const [pendingUsers, setPendingUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const fetchPendingUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const users = await userService.getPendingUsers()
      setPendingUsers(users)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pending users'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingUsers()
  }, [])

  return {
    pendingUsers,
    loading,
    error,
    refetch: fetchPendingUsers
  }
}

// Hook for user statistics
export const useUserStatistics = () => {
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    pending: 0,
    inactive: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const stats = await userService.getUserStatistics()
        setStatistics(stats)
      } catch (error) {
        console.error('Error fetching statistics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatistics()
  }, [])

  return { statistics, loading }
}
'use client'

import { useState } from 'react'
import { User } from '@/types/user'
import { deleteUser, softDeleteUser } from '@/lib/services/userService'
import { useToast } from '@/hooks/useToast'
import { AlertTriangle } from 'lucide-react'
import { Checkbox, Label, Alert, Button, Modal, RadioCardGroup } from '@/components/aoo'
import { InfoPanel, StatusBadge } from '@/components/shared'

interface DeleteUserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export default function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess
}: DeleteUserDialogProps) {
  const [deleteType, setDeleteType] = useState<'soft' | 'permanent'>('soft')
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showToast } = useToast()

  if (!user) return null

  const handleDelete = async () => {
    if (!confirmChecked) {
      showToast('กรุณายืนยันการลบ', 'error')
      return
    }

    setIsDeleting(true)

    try {
      if (deleteType === 'soft') {
        await softDeleteUser(user.id!)
        showToast('ปิดการใช้งานพนักงานสำเร็จ', 'success')
      } else {
        // Permanent delete - just call the service directly
        await deleteUser(user.id!)
        showToast('ลบพนักงานสำเร็จ', 'success')
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error('Delete error:', error)
      showToast(error.message || 'เกิดข้อผิดพลาดในการลบ', 'error')
    } finally {
      setIsDeleting(false)
      setConfirmChecked(false)
    }
  }

  const resetDialog = () => {
    setDeleteType('soft')
    setConfirmChecked(false)
  }

  const handleClose = () => {
    onOpenChange(false)
    resetDialog()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          ลบพนักงาน
        </span>
      }
      maxWidth={448}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isDeleting}>
            ยกเลิก
          </Button>
          <Button
            variant={deleteType === 'permanent' ? 'danger' : 'primary'}
            onClick={handleDelete}
            disabled={!confirmChecked}
            loading={isDeleting}
            icon={isDeleting ? undefined : 'Trash2'}
          >
            {isDeleting
              ? 'กำลังดำเนินการ...'
              : deleteType === 'soft' ? 'ปิดการใช้งาน' : 'ลบถาวร'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InfoPanel>
          <div className="font-medium text-gray-900">
            {user.fullName || user.lineDisplayName}
          </div>
          <div className="text-sm text-gray-600">{user.phone}</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            สิทธิ์: <StatusBadge status={user.role} />
          </div>
        </InfoPanel>

        {/* Delete Type Selection */}
        <div className="space-y-3">
          <Label>เลือกวิธีการลบ:</Label>
          <RadioCardGroup
            name="deleteType"
            value={deleteType}
            onChange={(v) => setDeleteType(v as 'soft' | 'permanent')}
            options={[
              {
                value: 'soft',
                label: 'ปิดการใช้งาน (Soft Delete)',
                description: (
                  <>
                    • พนักงานจะไม่สามารถเข้าใช้งานระบบได้<br/>
                    • ข้อมูลยังคงอยู่ในระบบและสามารถกู้คืนได้<br/>
                    • ประวัติการทำงานยังคงอยู่
                  </>
                ),
              },
              {
                value: 'permanent',
                label: <span className="text-red-600">ลบถาวร (Permanent Delete)</span>,
                description: (
                  <span className="text-red-600">
                    • ลบข้อมูลออกจากระบบทั้งหมด<br/>
                    • ไม่สามารถกู้คืนได้<br/>
                    • ประวัติการทำงานจะถูกลบ
                  </span>
                ),
              },
            ]}
          />
        </div>

        {/* Warning for permanent delete */}
        {deleteType === 'permanent' && (
          <Alert tone="error">
            <strong>คำเตือน:</strong> การลบถาวรไม่สามารถกู้คืนได้
            ข้อมูลทั้งหมดของพนักงานจะถูกลบออกจากระบบ
          </Alert>
        )}

        {/* Info about data backup */}
        <Alert tone="info">
          ระบบจะสำรองข้อมูลไว้ใน deleted_users collection ก่อนลบ
        </Alert>

        {/* Confirmation checkbox */}
        <InfoPanel tone="danger" className="flex items-center gap-2">
          <Checkbox
            id="confirm-delete"
            checked={confirmChecked}
            onChange={(checked) => setConfirmChecked(checked as boolean)}
          />
          <label htmlFor="confirm-delete" className="text-sm cursor-pointer select-none">
            ฉันเข้าใจและยืนยันที่จะ{deleteType === 'soft' ? 'ปิดการใช้งาน' : 'ลบ'}พนักงานคนนี้
          </label>
        </InfoPanel>
      </div>
    </Modal>
  )
}

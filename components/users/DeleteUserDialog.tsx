'use client'

import { useState } from 'react'
import { User } from '@/types/user'
import { deleteUser, softDeleteUser } from '@/lib/services/userService'
import { useToast } from '@/hooks/useToast'
import { Trash2, AlertTriangle, Info } from 'lucide-react'
import { Checkbox, Label, Alert, Button, Modal } from '@/components/aoo'
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

  return (
    <Modal open={open} onClose={() => (((isOpen) => {
      onOpenChange(isOpen)
      if (!isOpen) resetDialog()
    }))(false)} title={<><span className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" />
            ลบพนักงาน</span></>} description={<><div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-medium text-gray-900">
                  {user.fullName || user.lineDisplayName}
                </div>
                <div className="text-sm text-gray-600">{user.phone}</div>
               <div className="text-sm text-gray-600">
                สิทธิ์: {user.role === 'admin' ? 'ผู้ดูแลระบบ' :
                        user.role === 'hr' ? 'ฝ่ายบุคคล' :
                        user.role === 'manager' ? 'ผู้จัดการ' :
                        user.role === 'driver' ? 'พนักงานขับรถ' :
                        'พนักงาน'}
                </div>
              </div>

              {/* Delete Type Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">เลือกวิธีการลบ:</Label>
                
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="deleteType"
                    value="soft"
                    checked={deleteType === 'soft'}
                    onChange={(e) => setDeleteType(e.target.value as 'soft' | 'permanent')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">ปิดการใช้งาน (Soft Delete)</div>
                    <div className="text-sm text-gray-600">
                      • พนักงานจะไม่สามารถเข้าใช้งานระบบได้<br/>
                      • ข้อมูลยังคงอยู่ในระบบและสามารถกู้คืนได้<br/>
                      • ประวัติการทำงานยังคงอยู่
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border border-red-200 rounded-lg cursor-pointer hover:bg-red-50">
                  <input
                    type="radio"
                    name="deleteType"
                    value="permanent"
                    checked={deleteType === 'permanent'}
                    onChange={(e) => setDeleteType(e.target.value as 'soft' | 'permanent')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-red-600">ลบถาวร (Permanent Delete)</div>
                    <div className="text-sm text-red-600">
                      • ลบข้อมูลออกจากระบบทั้งหมด<br/>
                      • ไม่สามารถกู้คืนได้<br/>
                      • ประวัติการทำงานจะถูกลบ
                    </div>
                  </div>
                </label>
              </div>

              {/* Warning for permanent delete */}
              {deleteType === 'permanent' && (
                <Alert tone="error">
                  <div>
                    <strong>คำเตือน:</strong> การลบถาวรไม่สามารถกู้คืนได้ 
                    ข้อมูลทั้งหมดของพนักงานจะถูกลบออกจากระบบ
                  </div>
                </Alert>
              )}

              {/* Info about data backup */}
              <Alert tone="info">
                <div className="text-sm">
                  ระบบจะสำรองข้อมูลไว้ใน deleted_users collection ก่อนลบ
                </div>
              </Alert>

              {/* Confirmation checkbox */}
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                <Checkbox
                  id="confirm-delete"
                  checked={confirmChecked}
                  onChange={(checked) => setConfirmChecked(checked as boolean)}
                />
                <Label 
                  htmlFor="confirm-delete" 
                  className="text-sm text-red-700 cursor-pointer select-none"
                >
                  ฉันเข้าใจและยืนยันที่จะ{deleteType === 'soft' ? 'ปิดการใช้งาน' : 'ลบ'}พนักงานคนนี้
                </Label>
              </div>
            </div></>} maxWidth={448}>
        
        
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => (((isOpen) => {
      onOpenChange(isOpen)
      if (!isOpen) resetDialog()
    }))(false)} disabled={isDeleting}>
            ยกเลิก
          </Button>
          <Button onClick={handleDelete} disabled={!confirmChecked || isDeleting} className={deleteType === 'permanent' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700' }>
            {isDeleting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                กำลังดำเนินการ...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteType === 'soft' ? 'ปิดการใช้งาน' : 'ลบถาวร'}
              </>
            )}
          </Button>
        </div>
      </Modal>
  )
}
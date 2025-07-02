'use client'

import { useState } from 'react'
import { User } from '@/types/user'
import { deleteUser, softDeleteUser } from '@/lib/services/userService'
import { useToast } from '@/hooks/useToast'
import { auth } from '@/lib/firebase/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trash2, AlertTriangle, Info } from 'lucide-react'

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
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen)
      if (!isOpen) resetDialog()
    }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            ลบพนักงาน
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-medium text-gray-900">
                  {user.fullName || user.lineDisplayName}
                </div>
                <div className="text-sm text-gray-600">{user.phone}</div>
               <div className="text-sm text-gray-600">
                สิทธิ์: {user.role === 'admin' ? 'ผู้ดูแลระบบ' :
                        user.role === 'hr' ? 'ฝ่ายบุคคล' :
                        user.role === 'manager' ? 'ผู้จัดการ' :
                        user.role === 'marketing' ? 'Influ Marketing' :  // ✅ เพิ่ม
                        user.role === 'driver' ? 'พนักงานขับรถ' :       // ✅ เพิ่ม
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
                <Alert variant="error">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>คำเตือน:</strong> การลบถาวรไม่สามารถกู้คืนได้ 
                    ข้อมูลทั้งหมดของพนักงานจะถูกลบออกจากระบบ
                  </AlertDescription>
                </Alert>
              )}

              {/* Info about data backup */}
              <Alert variant="info">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  ระบบจะสำรองข้อมูลไว้ใน deleted_users collection ก่อนลบ
                </AlertDescription>
              </Alert>

              {/* Confirmation checkbox */}
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                <Checkbox
                  id="confirm-delete"
                  checked={confirmChecked}
                  onCheckedChange={(checked) => setConfirmChecked(checked as boolean)}
                />
                <Label 
                  htmlFor="confirm-delete" 
                  className="text-sm text-red-700 cursor-pointer select-none"
                >
                  ฉันเข้าใจและยืนยันที่จะ{deleteType === 'soft' ? 'ปิดการใช้งาน' : 'ลบ'}พนักงานคนนี้
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            ยกเลิก
          </AlertDialogCancel>
          <Button
            onClick={handleDelete}
            disabled={!confirmChecked || isDeleting}
            className={deleteType === 'permanent' 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-orange-600 hover:bg-orange-700'
            }
          >
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
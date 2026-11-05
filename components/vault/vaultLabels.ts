import type { VaultAction, VaultPerm } from '@/lib/vault/types'

export const permLabel = (p: VaultPerm) =>
  ['ดู', p.canEdit && 'แก้', p.canDelete && 'ลบ'].filter(Boolean).join(' · ')

export const ACTION_LABEL: Record<VaultAction, string> = {
  create: 'เพิ่มบัญชี',
  reveal: 'เปิดดูรหัส',
  update: 'แก้ไข',
  delete: 'ลบบัญชี',
  access: 'เปลี่ยนสิทธิ์',
}

export const FIELD_LABEL: Record<string, string> = {
  username: 'User',
  password: 'รหัสผ่าน',
  otp_phone: 'เบอร์ OTP',
  note: 'โน้ต',
  platform: 'แพลตฟอร์ม',
  name: 'ชื่อบัญชี',
}

// คอมโพเนนต์กลางของแอป — วางทับชั้น components/aoo อีกที
//
// aoo = ชิ้นส่วนดิบ (ปุ่ม การ์ด dropdown modal)
// shared = ชิ้นส่วนที่ผูกกับงาน HR แล้ว (หัวข้อหน้า การ์ดตัวเลข ป้ายสถานะ ตาราง)
//
// เรียกทีเดียว: import { PageHeader, StatCard, StatGrid, DataTable } from '@/components/shared'

export { default as PageHeader } from './PageHeader'
export { StatCard, StatGrid } from './StatCard'
export type { StatTone } from './StatCard'
export { default as StatusBadge, statusLabel } from './StatusBadge'
export { default as DataTable } from './DataTable'
export type { Column } from './DataTable'
export { default as UserCell } from './UserCell'
export { default as FilterBar, FilterSelect } from './FilterBar'
export { default as FilterCard, FilterField } from './FilterCard'
export { default as StorageImage } from './StorageImage'
export { default as UserAvatar } from './UserAvatar'
export { default as TechLoader } from './TechLoader'
export { default as Skeleton } from './Skeleton'
export { default as TableFooter } from './TableFooter'

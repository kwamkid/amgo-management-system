'use client'

// components/users/UserScheduleDialog.tsx
//
// เปิดแก้ตารางวันทำงานจากที่ไหนก็ได้ — กดชื่อพนักงานในรายงาน/สรุปเงินเดือน
// แล้วแก้จำนวนวันทำงาน + วันหยุดประจำได้เลย ไม่ต้องไล่เข้าหน้าแก้ไขพนักงาน
// ข้างในคือ WorkScheduleCard ตัวเดียวกับแท็บสถานที่เช็คอิน — แก้ที่เดียวได้ทั้งคู่
// ไม่ auto save: ต้องกดบันทึกในการ์ดเท่านั้น กดยกเลิก/พื้นหลัง = ทิ้งที่แก้ไว้
// ส่วนสลับวันหยุดรายวันไม่โชว์ใน popup (นาน ๆ ใช้ที ไปแก้ที่หน้าแก้ไขพนักงาน)

import { Modal } from '@/components/aoo'
import WorkScheduleCard from './WorkScheduleCard'

export default function UserScheduleDialog({
  userId,
  name,
  onClose,
}: {
  userId: string
  /** ชื่อที่โชว์บนหัวการ์ด — ส่ง display_name มาจะได้รู้ว่ากำลังแก้ของใคร */
  name?: string
  onClose: () => void
}) {
  return (
    <Modal open onClose={onClose} hideCloseButton maxWidth={576}>
      <WorkScheduleCard
        userId={userId}
        title={name ? `ตารางวันทำงาน — ${name}` : undefined}
        showExceptions={false}
        onCancel={onClose}
        onSaved={onClose}
      />
    </Modal>
  )
}

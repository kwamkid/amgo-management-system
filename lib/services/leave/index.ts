// lib/services/leave/index.ts
//
// ระบบลา แยกเป็น 5 ส่วนตามเรื่องที่รับผิดชอบ
// (ของเดิมเป็นไฟล์เดียว 849 บรรทัด ปนกันหมดตั้งแต่กติกาไปจนถึงบีบอัดรูป)
//
//   rules       กติกา — ไม่แตะฐานข้อมูล เรียกจากฟอร์มได้ตรง ๆ
//   mappers     แปลงแถว Postgres ↔ รูปแบบที่หน้าจอใช้
//   quota       โควต้า
//   requests    ใบลา
//   attachments ไฟล์แนบ
//   carryOver   ยกยอดข้ามปี
//
// นำเข้าได้ทั้ง `@/lib/services/leave` และ `@/lib/services/leaveService` (ทางเดิม)

export * from './rules'
export * from './quota'
export * from './requests'
export * from './attachments'
export * from './carryOver'
export { toLeaveRequest, toQuotaYear, LEAVE_TYPES } from './mappers'

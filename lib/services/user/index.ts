// lib/services/user/index.ts
//
// ข้อมูลพนักงาน แยกเป็น 3 ส่วน
// (ของเดิมเป็นไฟล์เดียว 466 บรรทัด อ่าน/เขียน/แปลงข้อมูลปนกัน)
//
//   mappers    แปลงแถว Postgres → รูปแบบที่หน้าจอใช้ (ใช้ร่วมกับ useAuth)
//   queries    อ่าน
//   mutations  เขียน
//
// นำเข้าได้ทั้ง `@/lib/services/user` และ `@/lib/services/userService` (ทางเดิม)

export * from './queries'
export * from './mutations'
export { mapUser, attachLocations } from './mappers'
export type { UserData, UserRow } from './mappers'

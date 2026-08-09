// lib/services/delivery/index.ts
//
// ส่งของ แยกเป็น 3 ส่วน
// (ของเดิมเป็นไฟล์เดียว 606 บรรทัด บีบอัดรูป/จุดส่ง/เส้นทาง/ล้างข้อมูล ปนกัน)
//
//   photos   บีบอัด + อัปโหลด + สร้างลิงก์ดูรูป
//   points   จุดส่งและเส้นทางรายวัน
//   cleanup  ลบรูป/ข้อมูลที่เก่าเกินกำหนด
//
// นำเข้าได้ทั้ง `@/lib/services/delivery` และ `@/lib/services/deliveryService`

export * from './photos'
export * from './points'
export * from './cleanup'

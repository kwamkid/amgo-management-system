# PWA + แจ้งเตือน push

## ติดตั้งเป็นแอป
- Android/Chrome: หน้าโปรไฟล์ → "ติดตั้งแอป" (หรือเมนูเบราว์เซอร์ → ติดตั้งแอป)
- iPhone/iPad: Safari → ปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" · **แจ้งเตือนใช้ได้เฉพาะเมื่อเปิดจากไอคอนแอป** (iOS 16.4+)
- manifest: `app/manifest.ts` (`/manifest.webmanifest`) · scope `/` · start `/dashboard`
- ไอคอน: `public/icons/*` สร้างจาก `node scripts/generate-pwa-icons.mjs`

## แจ้งเตือน
| เหตุการณ์ | ใครได้รับ | กดแล้วเปิด |
|---|---|---|
| ขอลา / ขอสลับวันหยุด | admin · hr · manager (ยกเว้นคนยื่นเอง) | หน้าจัดการ |
| อนุมัติ / ปฏิเสธ | เจ้าของใบ | หน้าใบของตัวเอง |

- เปิด/ปิดต่ออุปกรณ์ที่หน้าโปรไฟล์ → "แอปบนอุปกรณ์นี้" · ปุ่ม "ส่งทดสอบ" ยิงหาตัวเอง
- เช็คอิน/เช็คเอาท์ไม่ยิง push (Discord แจ้งอยู่แล้ว)

## ตั้งค่า
- env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` (สร้างด้วย `npx web-push generate-vapid-keys`) — อยู่บน Vercel production + preview แล้ว
- เปลี่ยนคู่กุญแจ = subscription เก่าใช้ไม่ได้ ทุกเครื่องต้องเปิดสวิตช์ใหม่
- ตาราง `push_subscriptions` · แถวที่ endpoint ตาย (404/410) ถูกลบเองตอนส่ง

## แก้ปัญหา
- สวิตช์บอก "ไม่รองรับ" บนเดสก์ท็อป = ไม่ได้ตั้ง `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ตอน build
- iPhone ไม่เด้ง = ยังเปิดจาก Safari ไม่ใช่จากไอคอนแอป · หรือปิดแจ้งเตือนของแอปในตั้งค่า iOS
- ส่งทดสอบ 404 = เครื่องนี้ยังไม่ได้เปิดสวิตช์

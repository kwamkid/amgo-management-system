# PWA + แจ้งเตือน push

## ติดตั้งเป็นแอป
- หน้า **/install** บอกขั้นตอนทั้ง iPhone และ Android (เลือกให้ตามเครื่อง) — HR ส่งลิงก์ `app.amgovenger.com/install` ให้พนักงานใน LINE ได้เลย
- มือถือที่เปิดจากเบราว์เซอร์จะเห็นแถบเหลืองด้านบน "ใช้ AMGO แบบแอปดีกว่า" · กด ✕ เงียบ 7 วัน
- **เปิดจาก LINE ติดตั้งไม่ได้** — ต้องกด ⋯/⋮ → เปิดใน Safari/Chrome ก่อน (หน้า /install เตือนให้เอง)
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

## ล็อกอินจากแอปที่ติดตั้ง (LINE เด้งกลับผิดที่)
- อาการ: กด LINE ในแอป → เปิดแอป LINE → ยืนยันแล้ว **เด้งไป Chrome/Safari** ไม่กลับแอป (แอป LINE ส่ง callback ให้เบราว์เซอร์หลักของเครื่อง · iOS ยังคนละถังคุกกี้กับแอปด้วย)
- ทางแก้ (4 ก.ย. 69): แอปฝัง nonce ใน `state` → callback ส่งต่อ `pwa=1&nonce` ให้หน้า verify → verify ในเบราว์เซอร์**ไม่แลก token** แต่ฝากไว้ที่ `/api/auth/handoff` แล้วขึ้นว่า "กลับไปที่แอป AMGO" → หน้า login ในแอป (ยังเปิดอยู่) วนถามด้วย nonce ทุก 2.5 วิ → ได้ token → แลก session ในแอปเอง
- ถ้าแอปยังค้างหน้า LINE อยู่ กดย้อนกลับ/ปิด (X) ให้เห็นหน้า login ก่อน ระบบจะเข้าให้เอง · รอได้ 10 นาที
- ตาราง `auth_handoffs` (migration 20260904130000) · แถวลบตอนหยิบ/หมดอายุ ไม่ต้องมี cron
- โค้ด: `lib/auth/pwaState.ts` (state/nonce · เทสต์ `scripts/test-pwa-login.mjs`) · `lib/auth/pwaHandoff.ts` · `app/api/auth/handoff` · `app/auth/verify` · `app/(auth)/login`


---
paths:
  - "app/api/**"
  - "lib/queue/**"
  - "lib/services/**"
---

# งานเบื้องหลังต้องใช้คิวกลาง (เจ้าของสั่ง 8 ต.ค. 69)

"อะไรที่ทำในอนาคตใช้คิวได้ทั้งหมด" — งานที่นานเกินไม่กี่วินาที / เรียก API ข้างนอก / ทำหลายชิ้น
ห้ามทำใน request ตรง ๆ และห้ามให้หน้าเว็บวนเรียกเอง (ปิดหน้าแล้วหยุด = ไม่ใช่คิว)

- ลงคิว: `enqueue(sb, [{ kind, payload, groupKey, label }])` แล้ว `after(() => kickQueue(origin))` — `lib/queue/queue.ts`
- ชนิดงานใหม่: เพิ่มใน `lib/queue/handlers.ts` · งานละชิ้นเล็ก จบ ≤ ~15–40 วิ (Vercel ตัด 60 วิ)
- ยังไม่พร้อม (รอผลข้างนอก) คืน `{ retryAfterMs }` · พัง = throw (ลองใหม่เอง 1/2/4 นาที)
- หน้าเว็บโชว์ความคืบหน้าด้วย `<QueueFloat>` (components/shared) + `getQueueGroup(groupKey)` (lib/services/queueService.ts)
- route ที่ cron-job.org เรียก: รับทั้ง GET และ POST · ตอบเร็ว (cron-job.org รอได้ 30 วิ) — ลงคิวแล้วจบ
- งานฟลีต (`web_jobs`) มีตัวรันของตัวเอง (โฮสต์ละงาน) แต่เริ่มทันทีแบบเดียวกัน · cron ทุก 2 นาทีของมันปลุกคิวกลางด้วย อย่าปิด

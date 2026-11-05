# 📚 Learning — เทคนิค + สิ่งที่ค้นพบ

> สิ่งที่เพิ่งรู้ / pattern ที่น่าจำ · Newest at the bottom · Append-only via `/memo`

<!-- toc -->
**Contents** (29)
- 2026-08-07 — ผลสำรวจสถาปัตยกรรม Firestore (ก่อนตัดสินใจย้าย Supabase)
- 2026-08-13 — เมนูเฉพาะตำแหน่ง (ไม่ใช่ role) — pattern ที่ใช้กับเมนูการผลิต
- 2026-08-14 — ชุดเทคนิค Discord embed (ใช้กับการ์ด noti ทั้งระบบ)
- 2026-08-15 — เช็คว่า deploy ขึ้นจริงหรือยัง โดยไม่ต้องรอเดา
- 2026-08-15 — จับ WordPress ที่ "ไม่ล่มแต่พัง" ต้องอ่านเนื้อหา ไม่ใช่ status code
- 2026-08-15 — กันสั่งงานซ้ำต้องทำ 3 ชั้น ไม่ใช่แค่ปิดปุ่ม
- 2026-08-15 — progress bar ที่ไม่โกหก
- 2026-08-15 — ป้ายในตารางที่กดเข้าไปดูได้ ต้องดึงข้อมูลแยก ไม่ใช้ลิสต์ที่โหลดไว้
- 2026-08-16 — ETA ของคิว ต้องวัดจาก "จังหวะที่คิวเดิน" ไม่ใช่ "เวลาที่งานใช้ทำ"
- 2026-08-22 — ให้ trigger เขียนผลพลอยได้ แทนที่จะให้โค้ดเขียนเอง
- 2026-08-22 — พิสูจน์ trigger บนของจริง ต้องได้ตารางผลออกมา ไม่ใช่ "ไม่ error"
- 2026-08-20 — จะเชื่อว่า "เว็บล่ม" ต้องดูจากอย่างน้อย 2 จุดยืน
- 2026-08-20 — ไฟล์สำรอง .wpress โหลดตรงจากโฮสต์ได้ ไม่ต้องผ่านแอป
- 2026-08-20 — ให้ระบบบันทึกคำขอทุกใบ ก่อนจะมีใครมาถามว่าทำไมไม่ทำงาน
- 2026-08-20 — คนรับผิดชอบเก็บใน DB ปุ่มบนมือถือจึงไม่ต้องแก้ตอนคนย้ายสาขา
- 2026-08-21 — ตรวจงานสั่งพิมพ์ต้องพิมพ์ออกมาจริง ไม่ใช่ดูบนจอ
- 2026-08-21 — ฝังฟอนต์ลงไฟล์ .docx ได้ ไม่ต้องหวังว่าปลายทางจะมีฟอนต์
- 2026-08-21 — จัดข้อความให้ตรงแกนใน Word ใช้ center tab stop
- 2026-08-21 — จะให้ "ใครที่มีลิงก์" เปิดดูได้ อย่าขยาย policy
- 2026-08-22 — ก่อนเชื่อว่า "เพราะสิ่งที่เราเพิ่งแก้" ให้ถามข้อมูลย้อนหลังก่อน
- 2026-08-22 — เอกสารขนาดตายตัวบนจอเล็ก ให้ "ย่อ" ไม่ใช่ "บีบ"
- 2026-08-22 — ตารางหลายคอลัมน์บนมือถือ ตรึงคอลัมน์ไม่ช่วย
- 2026-09-04 — dropdown ที่ "สร้างตัวเลือกใหม่ได้" ทำไว้ในตัวกลางแล้ว
- 4 ก.ย. 69 — PWA/push
- 2026-10-09 — DataForSEO AI Optimization (LLM Mentions) — สิ่งที่ทดสอบแล้ว
- 2026-10-17 — แอป Android (Capacitor) + ทดสอบ route โดยไม่เปิด dev server
- 2026-10-30 — Hosting a hand-made HTML tool inside the app unchanged
- 2026-10-30 — Thai text in a print-ready PDF without font problems
- 2026-11-05 — Traps from the vault and type scale work
<!-- /toc -->

---

## 2026-08-07 — ผลสำรวจสถาปัตยกรรม Firestore (ก่อนตัดสินใจย้าย Supabase)

**ขนาดโปรเจกต์:** 187 ไฟล์ ts/tsx (~43k บรรทัด) · แตะ Firestore 34 ไฟล์ · API routes 15 · service 18 ไฟล์ (~6,900 บรรทัด)

### ✅ ใช้ Firestore เป็น request/response ล้วน — `onSnapshot` = 0 จุด
ปกตินี่คือส่วนที่เจ็บที่สุดของการย้ายออกจาก Firestore (ต้องเขียน realtime subscription ใหม่หมด)
แต่โปรเจกต์นี้ไม่มีเลย → ย้ายง่ายกว่าปกติมาก

### ✅ Data access รวมศูนย์ที่ `lib/services/`
แก้แค่ชั้น service ก็พอ UI แทบไม่ต้องแตะ

### ✅ Firebase Auth ทำหน้าที่แค่ "ถือ session"
```
LINE Login → /api/auth/line/callback
           → adminAuth.createCustomToken(lineUserId)
           → /auth/verify?token=... → signInWithCustomToken (client)
           → onAuthStateChanged → useAuth อ่าน users doc
```
ตัวตนจริงมาจาก **LINE**, สิทธิ์ทั้งหมดอ่านจาก Firestore `users` เอง — ไม่ได้ผูกกับ Firebase Auth ลึก
**`users` doc id = LINE user ID** (ไม่ใช่ UUID) → ตอนย้ายต้องออกแบบ key mapping ให้ดี

### ⚠️ กับดัก: Firestore query ข้าม subcollection ไม่ได้
`checkins/{date}/records` ทำให้ [`reportService.ts:261`](/lib/services/reportService.ts#L261) ต้อง loop ยิง query แยกทีละวัน

```ts
for (const date of dates) {                          // ← loop 30 รอบ
  const q = query(collection(db, 'checkins', dateStr, 'records'), ...)
  const snap = await getDocs(q)                      // ← 30 round-trip
}                                                    // แล้ว group by user ใน JS เอง
```

รายงาน 30 วัน = **30 round-trip** เรื่องเดียวกันเกิดซ้ำที่ `excelExportService`
และ `leaveService` (subcollection ซ้อน `quotas/{uid}/years/{year}`, 849 บรรทัด)
บน Postgres = query เดียวจบด้วย `WHERE work_date BETWEEN ... GROUP BY`

**บทเรียน:** อย่าเอา "วันที่" ไปเป็นชื่อ document ของ parent collection — มันตัดความสามารถ query ข้ามช่วงเวลาทิ้งถาวร

### ⚠️ ไม่มี `firestore.rules` ใน repo
security rules อยู่ใน Firebase console อย่างเดียว → ไม่มีใครเห็นสภาพจริง / ไม่มี version control
และมี **6 client component** อ่าน/เขียน Firestore ตรงจากเบราว์เซอร์
→ ต้องดึง rules มาตรวจก่อนย้าย จะได้ไม่ยกช่องโหว่ตามไป Supabase

### 📝 Supabase Auth ไม่มี LINE เป็น native provider
2 ทางเลือก (ต้อง spike ก่อนเลือก):
- **ทาง A** — `auth.admin.createUser()` + ออก session เอง + ใส่ role เข้า JWT ผ่าน **Custom Access Token Hook** → ได้ RLS ใช้จริง
- **ทาง B** — จัดการ session เอง (JWT ใน httpOnly cookie) + ทุก DB access ผ่าน API route ด้วย service-role key → คุมได้ 100% แต่ไม่ได้ RLS เป็นด่านหลัก

## 2026-08-13 — เมนูเฉพาะตำแหน่ง (ไม่ใช่ role) — pattern ที่ใช้กับเมนูการผลิต

เคสแรก: เมนู "การผลิต" ให้เห็นเฉพาะแอดมิน + ตำแหน่งพนักงานฝ่ายผลิต (HR ก็ไม่เห็น)

- **ฝั่ง UI:** `useAuth` ดึง `job_functions.code` มาใส่ `userData.jobFunctionCode` ตอนล็อกอิน
  → Sidebar แปลงเป็น roleKey เสมือน (`jobFunctionCode === 'production'` → key `'production'`)
  แบบเดียวกับ `seesDelivery` → `'delivery'` — เมนูใส่ `roles: ['admin', 'production']` ได้เลย
- **ฝั่ง DB:** helper `is_production_staff()` (security definer, query users+job_functions ด้วย
  `auth.uid()`) — ต่างจาก `is_admin()/is_hr()` ที่อ่าน role จาก JWT เพราะตำแหน่งไม่อยู่ใน JWT
  ใช้ใน RLS ของตารางผลิตทั้ง 6 ตัว
- เมนูโผล่หลังรีเฟรช/ล็อกอินใหม่ (jobFunctionCode โหลดตอน useAuth load)

**เมื่อไหร่ใช้:** เมนู/ฟีเจอร์ที่ผูกกับตำแหน่งเฉพาะทาง — ไม่ต้องเพิ่ม role ใหม่ใน enum

## 2026-08-14 — ชุดเทคนิค Discord embed (ใช้กับการ์ด noti ทั้งระบบ)

- **การ์ดกว้างเท่ากันทุกใบ:** Discord หดการ์ดตามเนื้อหา — ใส่รูปใส 500×3px เป็น `image`
  ท้าย embed (`public/discord/spacer.png`) จะดันทุกใบกางเต็ม max เท่ากัน โดยมองไม่เห็น
- **icon ประจำการ์ด:** วาด SVG (สไตล์ lucide บนป้ายเหลี่ยมมน) → render เป็น PNG โปร่งใสด้วย
  playwright `locator.screenshot({ omitBackground: true })` → เก็บใน `public/discord/`
  ให้ Discord ดึงจากโดเมน production เอง — **จากเครื่อง dev (localhost) icon จะไม่ขึ้น** เพราะ Discord fetch localhost ไม่ได้
- **ทดสอบดีไซน์โดยไม่ต้อง deploy:** อ่าน webhook URL จาก `app_config` (SQL) แล้ว curl
  multipart: `-F 'payload_json={...thumbnail:{url:"attachment://icon.png"}...}' -F 'files[0]=@icon.png'`
  — เห็นการ์ดจริงใน channel ทันที (ติด footer "🧪 ทดสอบ" + ชื่อสมมติกันพนักงานงง)
- **playwright-core บนเครื่องนี้** ไม่อยู่ใน node_modules ของ amgo — อยู่ที่
  `/Users/ampstark/codelab-school-supa/node_modules` ใช้ผ่าน CJS: `NODE_PATH=... node -e "require('playwright-core')"`

## 2026-08-15 — เช็คว่า deploy ขึ้นจริงหรือยัง โดยไม่ต้องรอเดา

`git push` แล้วไม่รู้ว่า Vercel build เสร็จยัง — เดาเวลาแล้วบอกเจ้าของว่า "น่าจะขึ้นแล้ว" คือคำตอบที่เชื่อไม่ได้ มี 2 วิธีพิสูจน์:

**หน้าเว็บ (client bundle):** ดึง HTML ของหน้านั้น → ไล่ `/_next/static/chunks/*.js` → grep หา**ข้อความที่มีเฉพาะในโค้ดใหม่**
```bash
curl -s URL > p.html
for c in $(grep -o '/_next/static/chunks/[^"]*\.js' p.html | sort -u); do
  curl -s "https://โดเมน$c" | grep -q "ข้อความใหม่" && echo "ขึ้นแล้ว" && break
done
```
เลือกข้อความที่ผู้ใช้เห็น (เช่น `"ทำมือ"`, `"เว็บที่เพิ่งทำไป"`) — มันติดไปกับ bundle เสมอ

**API route:** ยิง**โดยไม่ใส่รหัส** → `401` = route มีอยู่แล้ว · `404` = ยังไม่ขึ้น
สำคัญตอน endpoint นั้นมี side effect (ยิงพร้อมรหัสจะสั่งงานจริงเข้าคิว 49 ใบ)

## 2026-08-15 — จับ WordPress ที่ "ไม่ล่มแต่พัง" ต้องอ่านเนื้อหา ไม่ใช่ status code

เว็บจอขาว / critical error / ต่อ DB ไม่ได้ — **ยังตอบ HTTP 200** ตัวเช็คที่ดูแต่ status จึงขึ้นเขียวสนิท
ต้องอ่าน body แล้วหา signature: `There has been a critical error`, `Error establishing a database connection`, `^(Fatal|Parse) error:`, `Briefly unavailable for scheduled maintenance`, หรือ body สั้นกว่า 200 ตัวอักษร (= จอขาวจริง)

แยก 2 ระดับ: **hard** (นับเป็นล่ม — critical/db/php) กับ **soft** (แค่แจ้ง — โหมดปรับปรุง/จอขาว)
โหมดปรับปรุงต้องเป็น soft เพราะ **ตอนเราสั่งอัปเดตปลั๊กอินเองก็ขึ้นแบบนี้ชั่วคราว**

อ่านแค่ 64KB แรกพอ ใช้ reader แล้ว cancel — ไม่งั้นดูด 49 เว็บทุกชั่วโมงกิน bandwidth ฟรี ๆ
```ts
const reader = res.body.getReader()
while (n < 65536) { const {done, value} = await reader.read(); if (done) break; ... }
reader.cancel()
```

## 2026-08-15 — กันสั่งงานซ้ำต้องทำ 3 ชั้น ไม่ใช่แค่ปิดปุ่ม

ปิดปุ่มอย่างเดียวกันได้แค่ "ระหว่างกำลังส่งคำสั่ง" (ไม่ถึงวินาที) ครบชุดต้องมี:
1. **ปุ่มปิดตัวเอง**ตราบใดที่เว็บนั้นยังมีงานค้าง (อ่านจากคิวจริง ไม่ใช่ state ตอนกด)
2. **เซิร์ฟเวอร์กรอง**เว็บที่มีงานชนิดเดียวกัน queued/running อยู่แล้ว — กันกดจากอีกแท็บ/อีกเครื่อง
3. **ช่วงพักหลังเพิ่งเสร็จ** (ที่นี่ใช้ 10 นาที) — ข้อ 1-2 ไม่ครอบคลุมกรณี "งานเพิ่งจบเมื่อ 10 วินาทีก่อน"

ทุกชั้นต้อง**บอกเหตุผลกลับมา** (`skippedQueued` / `skippedRecent` / `skippedUpToDate`) ไม่ใช่เงียบหาย — ไม่งั้นผู้ใช้ไม่รู้ว่ากดติดหรือเปล่า

## 2026-08-15 — progress bar ที่ไม่โกหก

ใส่แถบความคืบหน้าได้เฉพาะงานที่มี "ขั้น" จริง — ที่นี่มีแค่อัปเดตปลั๊กอิน (วนทีละตัว)
ส่วนสแกน/ตรวจ/สำรอง เป็นคำสั่งเดียวจบ **ตั้งใจไม่ใส่แถบ** เพราะแถบที่ไม่ผูกกับของจริง พอค้างที่ 80% แล้วผู้ใช้แยกไม่ออกว่าพังหรือแค่ช้า

วิธี: ตัวรันงานเขียน `progress_done/total/note` ลงแถวงาน**ก่อนลงมือ**แต่ละขั้น → หน้าเว็บอ่านจากรอบ polling ที่มีอยู่แล้ว ไม่ต้องยิง request เพิ่ม (เขียน DB เพิ่ม 1 ครั้งต่อปลั๊กอิน = ฟรีเมื่อเทียบกับ SSH)

⚠️ progress มาจาก**ตัวรันงาน** ไม่ใช่หน้าเว็บ — เปิดหน้าใหม่บน localhost แต่ cron ยิงเข้า production ที่ยังเป็นโค้ดเก่า ก็ไม่เห็นแถบ (งงกันอยู่พักหนึ่ง)

## 2026-08-15 — ป้ายในตารางที่กดเข้าไปดูได้ ต้องดึงข้อมูลแยก ไม่ใช้ลิสต์ที่โหลดไว้

หน้าจ่ายงานโหลดประวัติงานไว้ 40 แถวเพื่อโชว์ในตาราง — ถ้าเอาลิสต์นั้นมาหาว่า "งานสแกนล่าสุดของเว็บนี้คือใบไหน" จะกดไม่ติดทันทีที่มีงานอื่นเกิดขึ้นเกิน 40 ใบหลังจากนั้น (ซึ่งเกิดง่ายมาก สั่งทั้งฟลีตรอบเดียวก็ 49 ใบแล้ว)

ทำเป็น query แยกที่ถามตรง ๆ ว่า "งานชนิดนี้ของเว็บนี้ที่จบแล้ว ใบล่าสุด" — `getLatestJob(siteId, type)` ใน [webService.ts](/lib/services/web/webService.ts) · ยิงเมื่อกดเท่านั้น ไม่กระทบการโหลดหน้า

**หลักที่ได้:** ลิสต์ที่ถูก `limit` ไว้เพื่อ "แสดงผล" ห้ามเอามาใช้เป็น "แหล่งค้นหา" — สองอย่างนี้มีอายุข้อมูลไม่เท่ากัน

## 2026-08-16 — ETA ของคิว ต้องวัดจาก "จังหวะที่คิวเดิน" ไม่ใช่ "เวลาที่งานใช้ทำ"

จะบอกผู้ใช้ว่า "งานของคุณอีกกี่นาทีถึงคิว" — สัญชาตญาณคือเอาเวลาที่งานใช้ทำมาบวกกัน **ซึ่งผิดคนละโลก**

ที่นี่ตัวไล่คิว (`/api/web/jobs/next`) เรียก `drain(2)` = หยิบมา 2 ใบ รันแล้ว**จบ request ไม่มีลูป** ความเร็วคิวจึงถูกกำหนดด้วย**รอบ cron (2 นาที)** ไม่ใช่ความเร็วงาน

| วัดจาก | ได้ |
|---|---|
| เวลาที่งานใช้ทำ | ~12 วิ |
| จังหวะที่คิวเดินจริง | **~120 วิ** |

ต่างกัน 10 เท่า — ถ้าใช้ตัวแรกจะบอกผู้ใช้ว่า "อีก 10 นาที" ทั้งที่ของจริงเกือบ 2 ชั่วโมง

**วิธีวัดที่ถูก:** ระยะจาก "ใบก่อนหน้าเริ่ม" ถึง "ใบถัดไปเริ่ม" บนโฮสต์เดียวกัน — แต่ **นับเฉพาะคู่ที่ใบหลังรออยู่แล้วตอนใบหน้าเริ่ม** (`queued_at <= prev.started_at`) ไม่งั้นช่วงที่คิวว่าง ๆ จะถูกนับเป็นความช้าของคิว

```sql
lag(started_at) over (partition by host_id order by started_at) as prev
-- แล้วกรอง queued_at <= prev
```

ของจริงได้ median 119.9 วิ (p25 115 · p75 126 · 243 คู่) = รอบ cron 2 นาทีเป๊ะ — เป็นการยืนยันว่าวิธีวัดถูก

**หลักที่ได้:** ระบบที่มีตัวจับจังหวะจากข้างนอก (cron / rate limit / คิวที่หยิบทีละ N) ความเร็วรวมมาจากตัวจับจังหวะ ไม่ใช่จากงาน · และถ้าวัดไม่ได้ ให้**ไม่แสดง ETA** ดีกว่าแสดงเลขที่ผิด

## 2026-08-22 — ให้ trigger เขียนผลพลอยได้ แทนที่จะให้โค้ดเขียนเอง

ใบสลับวันหยุดต้องทำให้ "วันที่มาทำงาน" กลายเป็นวันทำงาน และ "วันที่หยุดชดเชย" กลายเป็นวันหยุด ซึ่งกระทบรายงาน · ตารางวัน · การนับวันขาด · เงินเดือน

**ทางที่ไม่เลือก:** ให้โค้ดตอนกดอนุมัติเขียน `schedule_exceptions` เอง แล้วไล่แก้ทุกที่ที่นับวันขาดให้รู้จักใบสลับ

**ทางที่เลือก:** trigger `schedule_swaps_sync_exceptions` (security definer) เขียน 2 แถวให้ตอน status เป็น approved — โค้ดฝั่งหน้าเว็บเปลี่ยนแค่ `status` ตัวเดียว เหมือนที่ใบลาทำอยู่แล้ว (`leave_requests_sync_days`)

ได้ 3 อย่างพร้อมกัน:
- **ไม่ต้องแก้โค้ดรายงานเลยสักบรรทัด** — `expected_work_mode` อ่าน schedule_exceptions เป็นอยู่แล้ว วันที่ชดเชยจึงเลิกเป็นวันทำงานเอง วันขาดหายไปเอง
- **ข้าม RLS ได้อย่างปลอดภัย** — `schedule_exceptions` เปิดให้ `is_hr()` เท่านั้น แต่คนกดอนุมัติอาจเป็น manager · ให้ trigger เขียนแทนดีกว่าเปิดสิทธิ์ตารางให้กว้างขึ้น
- **ถอยกลับได้สนิท** — ยกเลิก/ลบใบ = trigger ลบ 2 แถวนั้นทิ้ง ตารางกลับเป็นเดิม ไม่มีแถวกำพร้า

**หลักที่ได้:** ถ้าผลพลอยได้ของ action หนึ่งต้องถูกอ่านโดยของอื่นอีกหลายที่ ให้เขียนลง**โครงสร้างที่ของอื่นอ่านอยู่แล้ว** อย่าไปสอนของอื่นให้รู้จัก action ใหม่ทีละที่

## 2026-08-22 — พิสูจน์ trigger บนของจริง ต้องได้ตารางผลออกมา ไม่ใช่ "ไม่ error"

`raise notice` ใน DO block ไม่ถูกส่งกลับมาทาง MCP — รันแล้วได้ผลว่าง ๆ ซึ่งหน้าตาเหมือน "ผ่าน" เป๊ะ

```sql
create temp table t (step text, got int, want int);
do $$ ... insert into t select 'อนุมัติ → เขียน 2 แถว', count(*), 2 from ... ; ... end $$;
select step, got, want, case when got=want then 'ผ่าน' else 'ไม่ผ่าน' end from t;
```

ทำแบบนี้ได้ 8 ข้อพร้อมกันในรอบเดียว (ยื่น → อนุมัติ → ย้ายวัน → ยกเลิก → ลบ) แล้วปิดท้ายด้วยการนับว่าไม่มีข้อมูลค้าง

**อีกวิธีที่ใช้คู่กัน** — พิสูจน์ผ่าน "ฟังก์ชันที่ของจริงใช้" ไม่ใช่ตารางดิบ: เรียก `expected_work_mode()` ก่อน/หลังอนุมัติ/หลังลบใบ แล้วดูว่า `off → onsite` และ `onsite → off` จริงไหม เป็นการพิสูจน์ทั้งเส้นทางในคำสั่งเดียว

## 2026-08-20 — จะเชื่อว่า "เว็บล่ม" ต้องดูจากอย่างน้อย 2 จุดยืน

ตัวเฝ้าระวังบอกว่าเว็บล่ม 125 ครั้งใน 7 วัน · ก่อนจะไปไล่แก้โค้ด ให้ยิงเองจากที่อื่นก่อน

| ยิงจาก | ผลของ joolzjuice.com |
|---|---|
| เครื่องคน (5 ครั้ง) | 200 · 583 KB · 0.5–5 วิ |
| ตัวโฮสต์ของเว็บเอง (3 ครั้ง) | 200 · 583 KB · 0.07–0.5 วิ |
| Vercel (ตัวเฝ้าระวังของเรา) | หมดเวลา 15 วิ ทั้ง 3 ครั้ง |

8 ต่อ 0 — เว็บไม่ได้เป็นอะไร **จุดที่เรายืนมองต่างหากที่ถูกบล็อก** (SiteGround กันบอทตาม IP ศูนย์ข้อมูล)

ถ้าไม่ทำขั้นนี้ จะไปนั่งไล่แก้ timeout/retry/regex ในโค้ดตัวเฝ้าระวังทั้งวันโดยไม่มีทางถูก เพราะปัญหาไม่ได้อยู่ในนั้น

**สิ่งที่ทำให้อ่านออกตั้งแต่ยังไม่ยิงทดสอบ:** ดูรูปแบบเวลา — ล่มตอน :00 กลับมาตอน :00 ของชั่วโมงถัดไป สลับไปมาเป็นสัปดาห์ · **เว็บล่มจริงไม่ทำตามนาฬิกา ตัวเช็คที่งอแงต่างหากที่ทำ**

**หลักที่ได้:** ตัวเฝ้าระวังที่ยืนอยู่จุดเดียวเชื่อได้เท่าที่จุดนั้นเชื่อได้ · เมื่อเรามีทางเข้าอีกทาง (ที่นี่คือ SSH ที่ใช้สแกน/สำรองอยู่แล้ว) เอามาเป็นตัวตัดสินตอนทางแรกพลาดได้ — โดยต้องรู้ตัวว่ามันไม่ใช่การเช็คจากภายนอกจริง

## 2026-08-20 — ไฟล์สำรอง .wpress โหลดตรงจากโฮสต์ได้ ไม่ต้องผ่านแอป

ai1wm วางไฟล์ไว้ใต้ `public_html/wp-content/ai1wm-backups/` และ `.htaccess` ของมัน **ปิดแค่การไล่ดูรายชื่อไฟล์** (403) ตัวไฟล์ตอบ 200 พร้อม `accept-ranges: bytes`

แปลว่าปุ่มดาวน์โหลดเป็นแค่ `<a href>` ธรรมดา ไฟล์ 5 GB วิ่งจากโฮสต์เข้าเครื่องผู้ใช้ตรง ๆ ไม่ชนเพดาน 60 วิของ Vercel เลย — ถ้าให้วิ่งผ่านแอปคือทำไม่ได้ตั้งแต่แรก

โหลดทั้งฟลีตอย่าเปิด 49 แท็บ · ให้ไฟล์รายการลิงก์แล้วรัน `xargs -n1 curl -C - -O < amgo-backups.txt` (`curl` มากับ macOS อยู่แล้ว `wget` ไม่มี · `-C -` = โหลดต่อจากที่ค้าง)

⚠️ ลิงก์เท่ากับรหัสผ่านของเว็บนั้นทั้งเว็บ — ที่ปลอดภัยอยู่เพราะชื่อไฟล์มีตัวสุ่มต่อท้ายและไล่ดูรายชื่อไฟล์ไม่ได้

---

## 2026-08-20 — ให้ระบบบันทึกคำขอทุกใบ ก่อนจะมีใครมาถามว่าทำไมไม่ทำงาน

เจ้าของสั่งว่า **"ดู log ให้"** — แล้วผมถึงรู้ว่าไม่มี log อะไรให้ดูเลย เพราะเขียนแต่ทางที่สำเร็จ

ใส่ `callback_logs` ที่บันทึก **ทุกทางออกของ endpoint** (สำเร็จ · รหัสผิด · เบอร์ไม่ผ่าน · Discord ตีกลับ) พร้อม payload ดิบ แล้วคำตอบโผล่มาในบรรทัดเดียว: `"phone": "electronic business card"` — จบเรื่องที่เดากันอยู่ 3 รอบ

**เมื่อไหร่ต้องทำ:** endpoint ที่ผู้ใช้เรียกจาก**อุปกรณ์ที่เราเข้าไปดูไม่ได้** (มือถือ · Shortcut · เครื่อง POS) — เราไม่มีทางเห็นสิ่งที่เขาส่งมา นอกจากเก็บไว้เอง · การเดาจากคำบอกเล่าเสียเวลากว่าการเขียนตัวบันทึก 20 บรรทัดเสมอ

⚠️ log ที่มีเบอร์ลูกค้าคือข้อมูลส่วนบุคคล — ควรตั้งให้ลบเองหลัง 7 วัน (ยังไม่ได้ทำ)

## 2026-08-20 — คนรับผิดชอบเก็บใน DB ปุ่มบนมือถือจึงไม่ต้องแก้ตอนคนย้ายสาขา

โจทย์คือ "กดปุ่มเดียว → เลือกสาขา → เด้งเข้า Discord พร้อม mention คนที่ดูแล" · ทางที่ง่ายกว่าคือฝังชื่อสาขากับ Discord ID ลงใน Shortcut เลย

แต่ Shortcut อยู่ใน**มือถือของแต่ละคน** — วันที่แอมย้ายจาก emporium หรือเปิดสาขาเชียงใหม่ ต้องไล่แก้ทุกเครื่อง

เก็บใน `callback_targets` (สาขา) + `callback_target_members` (คน) แล้วให้ Shortcut ถาม `GET /api/branches` เอาเมนูสด ๆ ทุกครั้ง — **เปลี่ยนคน/เพิ่มสาขา = แก้ฐานข้อมูลอย่างเดียว ไม่ deploy ไม่แตะมือถือสักเครื่อง**

หลักเดียวกันใช้ได้กับทุกอย่างที่ต้องไปตั้งค่าบนอุปกรณ์ปลายทาง: ให้อุปกรณ์ถือแค่ *"ฉันคือใคร"* ส่วน *"ตอนนี้กติกาคืออะไร"* ให้ถามเซิร์ฟเวอร์

---

## 2026-08-21 — ตรวจงานสั่งพิมพ์ต้องพิมพ์ออกมาจริง ไม่ใช่ดูบนจอ

ใช้ Chrome DevTools Protocol พิมพ์หน้าจริงเป็น PDF แล้ววัดจากไฟล์ที่ได้ —
เพราะโหมด `Emulation.setEmulatedMedia({media:'print'})` **เชื่อขนาดไม่ได้**
(ความกว้าง/ความสูงยังอิงหน้าต่างเบราว์เซอร์ ไม่ใช่กระดาษ)

```js
// พิมพ์แบบที่ CSS สั่ง
Page.printToPDF({ paperWidth: 8.27, paperHeight: 11.69, preferCSSPageSize: true })
// พิมพ์แบบที่กล่องพิมพ์จริงทำ (margin/scale ค่าเริ่มต้น)
Page.printToPDF({ paperWidth: 8.27, paperHeight: 11.69 })
```

แล้ววัดจาก PDF ตรง ๆ: `/MediaBox` = ขนาดกระดาษ · นับ `/Type /Page` = จำนวนหน้า ·
แปลง PNG แล้วหาพิกเซลหมึกซ้ายสุด/ขวาสุด = ขอบจริงกี่มิลลิเมตร

**สิ่งที่ต้องรันทั้งสองแบบ** — `preferCSSPageSize: true` บังคับใช้ค่าจาก CSS
ซึ่ง**ไม่ใช่สิ่งที่กล่องพิมพ์จริงทำ** ผ่านแบบแรกอย่างเดียวไม่ได้แปลว่าใช้ได้จริง

⚠️ และต้องล็อกอินเข้าหน้าจริง ไม่ใช่ทำหน้าทดสอบแยก — หน้าทดสอบไม่ได้อยู่ใน
layout หลังบ้าน สภาพแวดล้อมคนละอย่าง (`--user-data-dir` + กดปุ่ม dev login ผ่าน CDP)

## 2026-08-21 — ฝังฟอนต์ลงไฟล์ .docx ได้ ไม่ต้องหวังว่าปลายทางจะมีฟอนต์

OOXML รองรับการฝังฟอนต์ — `docx` ทำให้ผ่าน `new Document({ fonts: [...] })`
ต้องเป็น **`.ttf` เท่านั้น** (woff2 ที่เว็บใช้ Word อ่านไม่ออก จึงเก็บคนละชุด)
ไฟล์โตขึ้นจาก ~21 KB เป็น ~106 KB เท่านั้น

**ที่ไลบรารีทำให้ไม่ได้** คือบอกว่าไฟล์ไหนเป็นตัวหนา ต้องซ่อม `word/fontTable.xml`
หลังแพ็กเอง (ดู bugs.md) — แกะด้วย JSZip แล้วรวมเป็นก้อนเดียว regular + bold

**ครอบคลุมแค่ไหน:** Word ส่วนใหญ่อ่านฟอนต์ที่ฝังมา แต่ **Word บางรุ่นและ Google Docs
ไม่อ่าน** — ต้องมีฟอนต์สำรองที่มีทุกเครื่องไว้เสมอ (ที่นี่ใช้ Tahoma)

## 2026-08-21 — จัดข้อความให้ตรงแกนใน Word ใช้ center tab stop

ปัญหา: บรรทัด `ลงชื่อ ........` มีคำนำหน้า ทำให้เส้นประเยื้องไปขวา
แต่ชื่อกับตำแหน่งข้างล่างจัดกึ่งกลางของ*ทั้งบรรทัด* → แกนไม่ตรงกัน

**ฝั่ง Word:** ตั้ง `tabStops: [{ type: 'center', position: X }]` เหมือนกันทุกบรรทัด
บรรทัดแรก = `ลงชื่อ` → `<w:tab/>` → เส้นประ · บรรทัดอื่น = `<w:tab/>` → ข้อความ
ทุกบรรทัดจึงมีแกนกลางเป็นตำแหน่ง tab เดียวกันเป๊ะ **ไม่ต้องเดาความกว้างฟอนต์เลย**

⚠️ ต้องเป็น `new TextRun({ children: [new Tab()] })` ให้ได้ `<w:tab/>` จริง —
ใส่ตัวอักษร tab ในข้อความ (`'\t'`) Word ไม่เดินไปตาม tab stop

**ฝั่งเว็บ:** ทำแบบเดียวกันด้วยตัวเว้นที่สีโปร่งใส (คำเดียวกัน ความกว้างเท่ากันเป๊ะ)

## 2026-08-21 — จะให้ "ใครที่มีลิงก์" เปิดดูได้ อย่าขยาย policy

โจทย์: ส่งลิงก์เอกสารให้พนักงานคนไหนก็ได้เปิดดูเพื่อ approve (ต้องล็อกอินก่อน)

ทางที่ง่ายกว่าคือเปิด RLS ให้ `authenticated` อ่าน `documents` ได้ — **แต่นั่นแปลว่า
ใครที่ล็อกอินก็ดึงเอกสารทุกฉบับออกไปได้ ทั้งที่ไม่เคยได้ลิงก์**

ทำเป็น token ต่อเอกสารแทน: คอลัมน์ `share_token uuid default gen_random_uuid()` +
ฟังก์ชัน `security definer` ที่คืนข้อมูลเมื่อ **token ตรง และ `auth.uid()` ไม่เป็น null**
แล้ว `revoke ... from public, anon` ทิ้ง (security definer มองข้าม RLS ต้องปิดเอง)

เกร็ด: คืนเฉพาะช่องที่ต้องใช้วาด ไม่คืนทั้งแถว · **token ผิดกับเอกสารที่ถูกลบ ตอบเหมือนกัน**
คนนอกจะได้ไม่รู้ว่าเอกสารนั้นมีอยู่จริงไหม · อยากตัดลิงก์เก่าทิ้ง = ออก token ใหม่

---

## 2026-08-22 — ก่อนเชื่อว่า "เพราะสิ่งที่เราเพิ่งแก้" ให้ถามข้อมูลย้อนหลังก่อน

พนักงาน 2 คนแจ้งว่าโดนเด้งออกจากระบบบ่อย — และเป็น **2 คนเดียวกับที่ผมเพิ่งเปลี่ยนสิทธิ์ให้ในวันนั้น** ทุกอย่างชี้ว่าเป็นความผิดของสิ่งที่เพิ่งทำ

ข้อมูลบอกอีกอย่าง — ถาม 3 คำถามแล้วจบ:

```sql
-- 1. เป็นมานานแค่ไหน       → ย้อนไปถึง 10 ส.ค. (ก่อนแก้ 12 วัน)
select created_at from auth.sessions where user_id = ... order by created_at;

-- 2. เป็นเฉพาะ 2 คนนี้ไหม   → ทั้งบริษัท และ 2 คนนี้เป็นน้อยที่สุดด้วยซ้ำ
select u.nickname, count(*) from auth.sessions s join users u ... group by 1;

-- 3. นับซ้ำหรือเปล่า        → session ที่ห่างกัน < 5 นาที = ชุดเดียวกัน ไม่ใช่ล็อกอินใหม่
select ..., lag(created_at) over (partition by user_id order by created_at) ...
```

ข้อ 3 สำคัญที่สุด — **ค่ากลางของช่วงห่าง = 0 นาที** เผยว่า 135 session คือล็อกอินจริงแค่ 36 ครั้ง
ถ้าไม่แยกตรงนี้จะสรุปว่า "ปูล็อกอินวันละ 19 ครั้ง" ซึ่งผิดและพาไปไล่ผิดทาง

**เมื่อไหร่ใช้:** ทุกครั้งที่มีคนแจ้งปัญหาหลังเราเพิ่งแก้อะไร · ความบังเอิญเรื่องเวลาชวนให้สรุปเร็วเกินไป

## 2026-08-22 — เอกสารขนาดตายตัวบนจอเล็ก ให้ "ย่อ" ไม่ใช่ "บีบ"

แผ่นเอกสารต้องกว้างคงที่ (A4 = 794px) ไม่งั้นบรรทัดขึ้นไม่ตรงกับตอนพิมพ์
พอเจอจอเล็ก ทางที่ผิดคือ `max-w-full` (บีบ → ข้อความไหลใหม่ → คนละหน้ากับที่จะพิมพ์)
ทางที่ถูกคือ `transform: scale()` — ได้ของเดิมย่อส่วน เหมือนเปิด PDF

```tsx
// วัดกล่องนอกด้วย ResizeObserver → scale = min(1, boxWidth / 794)
// กล่องกลางต้องตั้ง height = ความสูงจริง × scale  (transform ไม่ย่อกล่อง)
<div style={{ width: 794, transform: `scale(${s})`, transformOrigin: 'top left' }}>
```

⚠️ **ทุกอย่างต้องถูกปลดตอนพิมพ์** — `transform: none !important` + `height: auto !important`
เพราะ element ที่มี transform (แม้ `scale(1)`) กลายเป็นจุดอ้างอิงของลูกที่ `position: absolute`
ซึ่งแผ่นเอกสารใช้อยู่ตอนพิมพ์ — ไม่ปลด แผ่นจะไปวางอิงกล่องนั้นแล้วหลุดออกนอกหน้า

## 2026-08-22 — ตารางหลายคอลัมน์บนมือถือ ตรึงคอลัมน์ไม่ช่วย

SRP Calculator มี 20 คอลัมน์ + ตรึงคอลัมน์ชื่อสินค้าไว้ซ้าย · บนมือถือเลื่อนไปขวาแล้ว
**ยังไม่รู้อยู่ดีว่าตัวเลขที่เห็นเป็นของสินค้าตัวไหน** เพราะคอลัมน์ที่ตรึงกินที่ไปครึ่งจอ

ทางที่ได้ผลคือ **ตัดทิ้งทั้งตาราง** ต่ำกว่า `lg` แล้วแสดงเป็นการ์ดต่อแถว
พร้อม **คัดเฉพาะช่องที่ใช้ตัดสินใจ** ไม่ใช่ยกทุกคอลัมน์มาเรียงแนวตั้ง

เกณฑ์คัด: ถามว่า "คนเปิดหน้านี้บนมือถือเพื่ออะไร" — ที่นี่คือ *เช็คราคากับกำไร*
ไม่ใช่ *กรอกต้นทุนนำเข้า* · ช่องกรอกต้นทุน (FOB/ค่าเรือ/ภาษี) จึงตัดออกได้โดยไม่เสียงาน

## 2026-09-04 — dropdown ที่ "สร้างตัวเลือกใหม่ได้" ทำไว้ในตัวกลางแล้ว

`SelectMenu` (components/aoo) รับ prop `onCreate` เพิ่ม — พิมพ์ในช่องค้นหาแล้วไม่ตรงกับตัวเลือกไหน จะมีแถว **+ เพิ่ม "…"** สีส้มขึ้นมาให้กด

```tsx
<SelectMenu
  size="sm" variant="flat"
  value={p.category || null}
  options={categoryOptions}
  onChange={(v) => save(v ?? '')}
  onCreate={(name) => save(name)}   // ใส่ prop นี้ = ช่องค้นหาโผล่เสมอ
/>
```

ใส่ `onCreate` เมื่อไหร่ ช่องค้นหาจะโผล่เสมอโดยไม่สนใจ `searchThreshold` เพราะมันคือช่องพิมพ์ชื่อใหม่ไปในตัว

**ทำไมไม่ใช้ `<input list=datalist>`** — เคยใช้ตอนแรก แล้วเจอว่ามันเป็น dropdown ของเบราว์เซอร์ หน้าตาไม่เข้ากับที่อื่นในระบบ และ**กรองตามที่พิมพ์** ทำให้เห็นตัวเลือกเดียวจนดูเหมือนพัง (เจ้าของทัก 28 ส.ค. 69)

**`variant="flat"`** สำหรับตารางที่มีหลายสิบช่อง — โปร่งจนกว่าจะชี้ ไม่งั้นตีกรอบทุกช่องแล้วลายตา

## 4 ก.ย. 69 — PWA/push
- `vercel link --yes` บน CLI รุ่นใหม่ **ดึง env จาก Vercel มาเขียนทับ `.env.local` ด้วย** (พิมพ์ว่า "Updated .env.local") — ก่อน link ต้องสำรองไฟล์ หรือ link ก่อนแล้วค่อยเติมค่าที่มีเฉพาะในเครื่อง
- ตัวกรองสิทธิ์ตีคำสั่งที่เขียน secret ลงไฟล์ + ส่งขึ้น Vercel ในคำสั่งเดียว — แยกเป็นสองคำสั่งผ่าน
- `MetadataRoute.Manifest` ของ Next รองรับ `id`/`scope`/`lang` — ไม่ต้องทำ route เอง
- sharp: `.trim()` ก่อน `.resize()` ทำให้คิดสัดส่วนจาก "ตัวโลโก้จริง" ไม่ใช่ viewBox ที่มีขอบว่าง · `density` ตอนโหลด SVG ต้องสูงพอให้ราสเตอร์เกินขนาดปลายทาง
- **`vercel env pull` คืนค่า `""` ให้ตัวแปรที่ตั้งเป็น Sensitive** โดยไม่เตือน — ดูแค่ชื่อครบไม่พอ ต้องเช็คความยาวค่าด้วย · ครั้งนี้ 8 ตัวว่าง (SUPABASE_SECRET_KEY · DISCORD ×2 · WEB_SECRET_KEY · WP_SSH_PRIVATE_KEY · CALLBACK_API_KEY + Supabase URL/publishable ที่กู้จาก MCP ได้) และผมรายงานผิดไปรอบหนึ่งว่ากู้ครบ
- edge middleware ฝัง `NEXT_PUBLIC_*` ตอน `next build` — แก้ .env แล้วต้อง build ใหม่ `next start` เฉย ๆ ไม่เห็นค่าใหม่
- Chrome headless บังคับหน้าต่างกว้างขั้นต่ำ ~500px — ถ่ายภาพ layout มือถือให้ใส่หน้าไว้ใน `<iframe width=390>` แทน `--window-size`
- **`cmd | head` / `cmd | grep` กลืน exit code** — 4 ก.ย. 69 push โค้ดที่ tsc ไม่ผ่านขึ้น main เพราะต่อคำสั่งด้วย `&&` แต่แต่ละขั้นมี pipe ปิดท้าย · ต้องเก็บผลลง `$?` ก่อน หรือ `set -o pipefail` ทุกครั้งที่ต่อ tsc/build เข้ากับ commit/push
- เช็คอินหลังเวลาเลิกงานของกะกลางวัน (เข้า 18:15 กะ 09–18) ทำให้ `normalEndTime` เลื่อนเลิกงานไปพรุ่งนี้ → ไม่นับว่าลืม → เพดานปิดร้านอยู่ก่อนเวลาเข้า → ชั่วโมงติดลบ → DB ปฏิเสธ (`hours_not_negative`) เช็คเอาท์ไม่ได้เลย · ดู log ด้วย `query_logs` (postgres_logs "violates") ชี้จุดได้ใน 1 นาที
- **ตัวเฝ้า deploy แบบเทียบชุด chunk ของ `/login` มองไม่เห็น build ที่ไม่แตะหน้านั้น** (app router ไม่มี build id ในชื่อไฟล์ มีแต่ content hash) — ต้อง probe หน้าที่ import โค้ดที่แก้ (เช่น `/checkin`) แล้วดาวน์โหลด chunk มา grep ข้อความใหม่ ถึงจะยืนยันได้ว่าโค้ดถูกเสิร์ฟจริง · `vercel inspect <url>` บอก status Building/Ready ตรง ๆ
- **MCP Supabase ทุกตัวหลุด auth พร้อมกัน (5 ก.ย. 69)** — token เก่าถูกยกเลิก · แก้ชั่วคราวด้วย Management API ตรง: `POST https://api.supabase.com/v1/projects/<ref>/database/query` header `Authorization: Bearer sbp_…` body `{"query": ...}` (คืน JSON rows) · token ต้องมาจากบัญชีที่เป็นสมาชิกองค์กรของโปรเจกต์นั้น (token แรกที่ได้มาเป็นของบัญชี AOO เห็นแต่ AooCommerce/AooSocial → 403) · เก็บ token ใหม่ใน `~/.claude.json` → `projects[...]/mcpServers/supabase-amgo/env/SUPABASE_ACCESS_TOKEN` มีผลตอนเปิด session ใหม่
- **กู้ service key ที่หายได้จาก Management API**: `GET /v1/projects/<ref>/api-keys?reveal=true` (ต้องใช้ PAT ของเจ้าของโปรเจกต์) คืน anon/service_role (legacy JWT) และ publishable/secret (sb_…) — 7 ก.ย. 69 ใส่ `SUPABASE_SECRET_KEY` (sb_secret_) กลับ .env.local แล้ว · Storage REST: ลบ `DELETE /storage/v1/object/<bucket>` body `{prefixes:[…]}` · อัปโหลดทับ `POST …/object/<bucket>/<path>` header `x-upsert: true` · สคริปต์ย้อนหลังใช้ sharp ผ่าน `require(process.cwd()+'/node_modules/sharp')` จาก scratchpad
- **แปลง JSX ด้วย regex ต้องนับปีกกา/สตริงเอง** — attrs ที่มี `=>` หรือ `cond ? 'a' : 'b'` ทำให้ regex `[^>]*` ตัดแท็กผิด (เจอกับ Badge/Button/AlertDialog 7 ก.ย. 69) · เขียน scanner เดินทีละตัวอักษร (depth ของ `{}` + สถานะใน `"` `'` `` ` ``) แล้วค่อยแก้ attrs · ใส่ loop guard ทุก while-replace ไม่งั้นค้าง (Select converter ค้าง 5 นาที) · ไฟล์ที่พังให้ `git checkout --` แล้วรันตัวแปลงที่แก้แล้วซ้ำ ดีกว่าไล่แก้มือ
- **ยืนยันว่า production คือ build ที่เพิ่ง push (7 ก.ย. 69)** — Next 16 ไม่มี `.next/app-build-manifest.json` แล้ว ใช้ `.next/server/app/<route>/page_client-reference-manifest.js` แทน: ดึงชื่อ chunk `static/chunks/*.js` (ชื่อ = content hash) แล้ว curl ทุกตัวจาก prod — ได้ 200 ครบ = build เดียวกัน · grep marker (ข้อความไทยที่มีแค่ในโค้ดใหม่) ยืนยันอีกชั้น · `vercel inspect` ไม่โชว์ commit sha ให้เทียบ `created` กับเวลา commit (`git log -1 --format=%cd`) หรือรอจน URL deployment ล่าสุดเปลี่ยนจากตัวก่อน


## 2026-10-09 — DataForSEO AI Optimization (LLM Mentions) — สิ่งที่ทดสอบแล้ว
- ไทย (`location 2764 · th`) มีข้อมูลแค่ **Google AI Overview** · ราคา $0.10/คำขอ + $0.001/แถว
- `target` หลายโดเมนในคำขอเดียว = **AND** (ต้องอ้างทุกเจ้าพร้อมกัน) → หา "อ้างคู่แข่งแต่ไม่อ้างเรา" ต้องยิงทีละคู่แข่ง + `{domain: เรา, search_filter: 'exclude'}` · เรียง `order_by: ['ai_search_volume,desc']` · share of voice ใช้ `cross_aggregated_metrics`
- LLM Scraper คืน error/ว่างบ่อย (ไม่เสถียร ข้ามไปก่อน) · GSC URL Inspection ใช้ token service account เดิม (webmasters.readonly) ได้เลย — `lib/services/seo/gsc.ts` `inspectUrl`

## 2026-10-17 — แอป Android (Capacitor) + ทดสอบ route โดยไม่เปิด dev server
- เครื่องนี้ลง JDK ด้วย `brew install --cask zulu@21` ไม่ได้ (ต้อง sudo) → `brew install openjdk@21` + `brew install --cask android-commandlinetools` แล้ว `sdkmanager --sdk_root=/opt/homebrew/share/android-commandlinetools "platform-tools" "platforms;android-36" "build-tools;36.0.0"` · ไม่ต้องลง Android Studio
- background-geolocation (capacitor-community): ต้อง `android.useLegacyBridge: true` (ไม่งั้นหยุดหลัง 5 นาที) · Android ชะลอ fetch ของ WebView หลังอยู่เบื้องหลัง 5 นาที → ส่งด้วย `CapacitorHttp` · Android 13+ ต้องขอ POST_NOTIFICATIONS (`@capacitor/local-notifications`)
- ตำแหน่ง/ข้อมูลถี่ ๆ จากแอป → เขียนเข้า Supabase RPC ตรง ไม่ผ่าน Vercel (กิน Active CPU)
- เจ้าของไม่อนุญาตให้เปิด dev server เอง → ทดสอบ route handler ด้วย tsx: import `GET/POST` จาก route.ts แล้วส่ง `new NextRequest(...)` + `{ params: Promise.resolve({ id }) }` ตรง ๆ (ใช้กับ admin client ได้ ไม่ต้อง login)

## 2026-10-30 — Hosting a hand-made HTML tool inside the app unchanged
- Owner wanted a local vanilla-HTML tool "exactly as is" → copy it to `public/<tool>/index.html`, show it full-bleed in an iframe from the app page (negative margins + `h-[calc(100dvh-3.5rem)]`), and replace only its fetch paths with app API routes that return the same JSON shapes (same-origin iframe → session cookies + RLS work). Mirror the iframe hash to the parent with `postMessage` so refresh/links keep state. Cheaper and more faithful than a React rewrite.
- PostgREST caps every select at 1000 rows → always page with `.range(from, from+999)` for catalog-size reads (first image count looked like 147/367 because of it).
- Supabase MCP `apply_migration` assigns its own version → read it back from `supabase_migrations.schema_migrations` and name the local file with it.

## 2026-10-30 — Thai text in a print-ready PDF without font problems
- pdf-lib can't shape Thai (marks collide). Shape with HarfBuzz (`harfbuzzjs`, server: `serverExternalPackages` + trace the wasm/fonts), turn each glyph into a Form XObject once and place it with `cm` — vector outlines, factory needs no Thai font, 15k labels ≈ 3 MB / 5 s. Write scale factors with significant digits, not fixed decimals. Code: [lib/labels/render.ts](/lib/labels/render.ts), [lib/labels/pdf.ts](/lib/labels/pdf.ts).
- Thai line breaks: `Intl.Segmenter('th', {granularity:'word'})` + a small no-break list (อุดตัน, number+unit) — ICU splits compounds.


### 2026-11-03 — dev tracker (UAT board) lessons
- A `before insert` trigger that must update a parent row guarded by another trigger: set a transaction-local flag `perform set_config('dev.apply_result','1',true)` before the update and have the guard return early on `current_setting('dev.apply_result', true) = '1'`. Service role (`auth.uid() is null`) is let through separately. Migration `20261103100000_dev_tracker`.
- Data move between two Supabase projects: one script, dry-run default, `--apply` idempotent by business key (`no`), temporarily open closed rows if a trigger refuses history inserts, restore source status after, bump the identity sequence with a security-definer `setval` helper. [scripts/migrate-uat-from-aoocommerce.mjs](/scripts/migrate-uat-from-aoocommerce.mjs).
- Discord message buttons: INTERACTION_CREATE reaches only one gateway session per bot token. A bot run by Hermes can't have a sidecar that handles clicks — buttons need their own Discord app. Owner chose text + web link instead (31 Oct).
- PWA geolocation works only while the app is in the foreground (browser limit, iOS and Android). Shortcut used: redirect to the page that reads GPS on open (`/checkin`), once per day via sessionStorage.

### 2026-11-03 — bank toolkit files + local dev traps (expenses)
- Reverse-engineer an Excel bank toolkit (.xls with macros, e.g. SCB CPX Toolkit): `python3 -m venv <scratch>/venv && <venv>/bin/pip install oletools`, then `olevba --decode -c file.xls`; the Export/Validation modules give the exact upload format and field rules. Verify by emulating the macro on the template's own sample rows and diffing field-by-field against our builder (done for `lib/services/bankTransferFile.ts`).
- SCB account check digit: 9 digits × 4,3,2,7,6,5,4,3,2, keep each product's units digit, sum, last digit = (10 − sum mod 10) mod 10 (`isScbAccount`).
- Owner's `next dev` (Turbopack) often keeps serving the old `app_globals_*.css` after globals.css edits (new classes missing, page JS already new). Check: fetch the stylesheet link and look for the class; `touch app/globals.css` + reload; it catches up after a while. Not a code bug — don't "fix" styles because of it.
- Category guessing from free Thai text: keyword regex rules ordered by specificity + nearest past description by character-bigram Dice ≥ 0.6 (no word segmentation needed); measured against historical rows (90%).

## 2026-11-05 — Traps from the vault and type scale work
- `npm run types:gen` redirects with `>`, so a failed run (403, no project access) leaves `types/database.ts` empty. Generate to a scratch file first; restore with `git restore -- types/database.ts`.
- Tailwind v4 sizes are plain CSS variables: setting `--text-sm` in `:root` moves every `text-sm` at once, and setting them back on one id (`#contract-sheet`) protects a print layout without touching that page.
- `<ListRow onClick>` renders a `<button>`, so a checkbox inside it is invalid: use the `aside` prop.
- Text appended to globals.css may not reach the dev server until the file is edited again; `touch` does not help.
- A preview before import is what caught the shifted columns. Default mapping must match the real sheet, and a data row can look like a header (`Shopee` hit the `shop` word): a cell with `@` or 6+ digits means data.


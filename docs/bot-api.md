# amgo Bot API — งานของทีม + HR (v1)

API ให้บอทแชท (Hermes Agent บน VPS คุยกับพนักงานใน Discord) อ่านและจัดการงานของทีม — ชุดเดียวกับหน้า **งาน** ใน amgo

| บอท | scope | ใครคุยด้วย | สิทธิ์ |
|---|---|---|---|
| **Jarvis** | `superadmin` | เจ้าของคนเดียว | เท่าแอดมิน เห็น/แก้ได้ทุกงาน · งานที่สร้าง/ปิด/เลื่อนวัน ลงชื่อเจ้าของ (`acts_as` ของกุญแจ) |
| **Edith** | `general` | พนักงานทุกคน | ใช้สิทธิ์ของ "คนที่คุยด้วย" ตรง ๆ — ต้องส่ง `X-Discord-User-Id` ทุกคำขอ |

- **Base URL:** `https://app.amgovenger.com/api/bot`
- **รูปแบบ:** JSON (UTF-8) · วันที่เป็น `YYYY-MM-DD` ตามเวลาไทย · ไม่มี cache (`no-store`)

---

## 1. กุญแจ (API key)

ยังไม่มีหน้าเว็บ — สร้างด้วยสคริปต์ (พิมพ์กุญแจ + SQL ออกจอ ไม่แตะ DB เอง) แล้วเอา SQL ไปรันใน Supabase SQL editor ของ amgo

```bash
node scripts/mint-bot-key.mjs superadmin "Jarvis (Hermes VPS)" <users.id ของเจ้าของ>
node scripts/mint-bot-key.mjs general    "Edith (Hermes VPS)"
```

- กุญแจหน้าตาแบบ `amgo_bot_xxxxxxxx…` · DB เก็บแค่ sha256 · ตัวเต็มโชว์ครั้งเดียว
- เพิกถอน: `update public.bot_api_keys set revoked_at = now() where key_prefix = 'amgo_bot_xxxx';` → ได้ `401` ทันที
- migration `20261028023731_bot_api_keys.sql` apply แล้ว (28 ต.ค. 69) · กุญแจ Jarvis (`amgo_bot_oQj7…`) และ Edith (`amgo_bot_rQnG…`) สร้างแล้ว — ตัวเต็มอยู่ในไฟล์ `memo/bot-keys.env` บนเครื่องเจ้าของ (ไม่อยู่ใน git)

> ⚠️ เก็บกุญแจใน env ของ Hermes บน VPS เท่านั้น (เช่น `AMGO_JARVIS_KEY`, `AMGO_EDITH_KEY`) ห้าม commit ลง git
> **กุญแจ Edith + Discord id ใด ๆ = ทำได้เท่าพนักงานคนนั้น** — Hermes ต้องส่ง id ของคนที่พิมพ์ข้อความจริง (จาก event ของ Discord) ห้ามรับ id ที่ผู้ใช้พิมพ์มาเอง

## 2. การยืนยันตัวตน

```
Authorization: Bearer amgo_bot_xxx        (หรือ  x-api-key: amgo_bot_xxx)
X-Discord-User-Id: 123456789012345678     (Edith — บังคับ · Jarvis — ไม่ต้องส่ง)
```

- ไม่รับกุญแจทาง query string
- Edith: Discord id ที่ไม่ได้ผูกกับพนักงาน (หรือพนักงานลาออกแล้ว) → `403`
- ถ้าพนักงานคนนั้นเป็นแอดมินใน amgo จะได้สิทธิ์แอดมินผ่าน Edith ด้วย

## 3. สิทธิ์ (ตรงกับหน้าเว็บ)

| ทำอะไร | ใครทำได้ |
|---|---|
| ดูงาน | ทุกคนเห็นทุกงาน (เจ้าของสั่ง 28 ต.ค. 69 "ไม่มีอะไรต้องปิดบัง") |
| สร้างงาน | ทุกคน — พนักงานมอบได้แค่ตัวเอง · แอดมินมอบใครก็ได้ |
| เปลี่ยนสถานะ / วันครบกำหนด / โน้ต / บันทึกความคืบหน้า | แอดมิน · คนสร้างงาน · ผู้รับผิดชอบ |
| แก้ชื่องาน / แบรนด์ | แอดมิน · คนสร้างงาน |
| เปลี่ยนผู้รับผิดชอบ | แอดมิน (พนักงานเพิ่ม/ถอดได้แค่ตัวเอง ในงานที่ตัวเองสร้าง) |
| HR — ดูเช็คอิน / ใบลา / โควต้าของคนอื่น · ดูเอกสาร | Jarvis เท่านั้น |
| HR — อนุมัติ / ปฏิเสธใบลา · ยื่นลาแทน · ยกเลิกใบที่อนุมัติแล้ว | Jarvis เท่านั้น (Edith ทำไม่ได้แม้คนที่คุยเป็น HR/แอดมิน) |
| HR — ดูของตัวเอง · ยื่นลา · ถอนใบที่ยังรอ | ทุกคน (Edith) |
| วันหยุดบริษัท | ทุกคน |

ไม่ผ่าน = `403` พร้อมเหตุผลภาษาไทยใน `error` — ให้บอทตอบข้อความนั้นกับผู้ใช้ได้เลย

## 4. Endpoints

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| GET | `/people` | พนักงานทั้งหมด + ตัวผู้เรียก (ใช้แปลงชื่อเล่น → id) |
| GET | `/tasks` | รายการงาน + ตัวกรอง |
| POST | `/tasks` | สร้างงาน |
| GET | `/tasks/{id}` | งานเดียว + รูป + ไทม์ไลน์ 10 รายการล่าสุด |
| PATCH | `/tasks/{id}` | แก้สถานะ / วันครบกำหนด / โน้ต / ผู้รับผิดชอบ |
| POST | `/tasks/{id}/updates` | บันทึกความคืบหน้า (แนบรูปได้) |
| PATCH | `/tasks/{id}/updates/{updateId}` | แก้รายการในไทม์ไลน์ |
| DELETE | `/tasks/{id}/updates/{updateId}` | ลบรายการในไทม์ไลน์ |
| GET | `/tasks/{id}/images` | รูปทั้งหมดของงาน |
| POST | `/tasks/{id}/images` | เพิ่มรูป (ลิงก์ไฟล์แนบ Discord หรือ multipart) |
| PATCH | `/tasks/{id}/images` | เรียงรูปใหม่ (รูปแรก = ปก) |
| DELETE | `/tasks/{id}/images/{imageId}` | ลบรูป |
| GET | `/tasks/brief` | สรุปประจำวัน: เลยกำหนด + ครบกำหนดใน 7 วัน |
| GET | `/attendance` | ใครมา/สาย/ขาด/ลา รายวัน + เวลาเข้า-ออก (§6.1) |
| GET | `/leave` | รายการใบลา + ตัวกรอง (§6.2) |
| POST | `/leave` | ยื่นใบลา (Jarvis ยื่นแทน/อนุมัติเลยได้) (§6.3) |
| GET | `/leave/{id}` | ใบลาใบเดียว |
| PATCH | `/leave/{id}` | อนุมัติ / ปฏิเสธ / ยกเลิก (§6.4) |
| GET | `/leave/balance` | โควต้าวันลาคงเหลือ (§6.5) |
| GET | `/holidays` | วันหยุดบริษัท (§6.6) |
| GET | `/documents` | เอกสารที่ออกจากระบบ — Jarvis (§6.7) |

ระบุคน (`assignee`, `assignees`, `user`) ได้ 3 แบบ: `"me"` · Discord id · user id (uuid)

### งาน 1 ใบ (รูปแบบที่ทุก endpoint คืน)

```json
{
  "id": "6f1c…", "title": "ส่งใบเสนอราคา Hape Q1", "brand": "hape",
  "status": "doing", "due": "2026-10-30", "daysLeft": 2,
  "assignees": [{ "id": "a1b2…", "name": "ฝน", "discordId": "1234…" }],
  "createdBy": { "id": "…", "name": "กอล์ฟ", "discordId": "…" },
  "notes": "รอราคาจาก HQ"
}
```
- `daysLate` = เลยกำหนดกี่วัน · `daysLeft` = อีกกี่วัน (0 = วันนี้) — มีเฉพาะงานยังไม่เสร็จที่มีวันครบกำหนด
- `notes` ในรายการตัดที่ 200 ตัวอักษร (งานเดียว/หลังสร้าง/หลังแก้ = เต็ม) · ช่องที่ว่างจะไม่ส่งมา
- `notes` บนหน้าเว็บเก็บเป็น HTML (ตัวหนา/bullet) — API แปลงเป็นตัวหนังสือล้วนให้ (bullet = `• `) · บอทเขียน `notes` เป็นตัวหนังสือธรรมดาได้เลย
- `progress` = งานติดอยู่ตรงไหน บรรทัดเดียวกับบนการ์ดหน้าเว็บ เช่น `"⏳ รอใบเสนอราคา (ผู้รับเหมา) · ตามแล้ว 1 ครั้ง · ตาม 31 ต.ค."` — เฉพาะงานยังไม่เสร็จที่มีความคืบหน้า

### 4.1 `GET /tasks`

| Query | ค่า |
|---|---|
| `status` | `todo,doing` (ค่าเริ่มต้น) · `done` · `all` |
| `brand` | เช่น `hape`, `abcthebaby` (ตัวพิมพ์เล็ก) |
| `assignee` | `me` · Discord id · user id · `none` (ยังไม่มีผู้รับผิดชอบ) |
| `mine=1` | งานที่ผู้เรียกสร้างหรือเป็นผู้รับผิดชอบ |
| `due_before` / `due_after` | `YYYY-MM-DD` (รวมวันนั้น) |
| `overdue=1` | เลยกำหนดและยังไม่เสร็จ |
| `q` | คำในชื่องาน |
| `limit` | 1–200 (ค่าเริ่มต้น 50) |

คืน `{ today, total, truncated, tasks: [...] }` เรียงตามวันครบกำหนด (ไม่มีวันอยู่ท้าย)

```bash
curl -s "https://app.amgovenger.com/api/bot/tasks?assignee=me&overdue=1" \
  -H "Authorization: Bearer $AMGO_EDITH_KEY" -H "X-Discord-User-Id: $DISCORD_USER_ID"
```

### 4.2 `POST /tasks`

```bash
curl -s -X POST https://app.amgovenger.com/api/bot/tasks \
  -H "Authorization: Bearer $AMGO_JARVIS_KEY" -H "Content-Type: application/json" \
  -d '{"title":"โทรตามใบเสนอราคา Stokke","brand":"stokke","due_date":"2026-11-03","assignees":["123456789012345678"],"notes":"ขอราคา Tripp Trapp"}'
```
- `title` บังคับ · `notes`, `brand`, `due_date` ไม่บังคับ
- ไม่ส่ง `assignees`: Edith = มอบให้ตัวเอง · Jarvis = ยังไม่มอบใคร
- คืน `201 { task }`

### 4.3 `GET /tasks/{id}`

คืน `{ task: {..., canEdit}, updates: [...] }` — `updates` ใหม่สุดก่อน: `kind` (`note` · `waiting` · `follow_up` · `appointment` · `due_change`), `body`, `date`, `time`, `dueChange: { from, to }`, `by` (ชื่อ), `at`

### 4.4 `PATCH /tasks/{id}`

ส่งเฉพาะช่องที่จะเปลี่ยน: `status` (`todo`/`doing`/`done`) · `due_date` (`YYYY-MM-DD` หรือ `null`) + `due_reason` · `notes` (แทนทั้งช่อง) · `title` · `brand` · `assignees` (ทั้งชุดใหม่)

```bash
# ปิดงาน
curl -s -X PATCH https://app.amgovenger.com/api/bot/tasks/6f1c… \
  -H "Authorization: Bearer $AMGO_EDITH_KEY" -H "X-Discord-User-Id: $DISCORD_USER_ID" \
  -H "Content-Type: application/json" -d '{"status":"done"}'

# เลื่อนวัน พร้อมเหตุผล (ลงไทม์ไลน์ "เลื่อนวัน" ในชื่อคนที่คุยกับบอท)
curl -s -X PATCH https://app.amgovenger.com/api/bot/tasks/6f1c… \
  -H "Authorization: Bearer $AMGO_EDITH_KEY" -H "X-Discord-User-Id: $DISCORD_USER_ID" \
  -H "Content-Type: application/json" -d '{"due_date":"2026-11-05","due_reason":"HQ ขอเวลาเพิ่ม"}'
```

### 4.5 `POST /tasks/{id}/updates` — บันทึกความคืบหน้า

| ช่อง | ค่า |
|---|---|
| `kind` | `note` (ค่าเริ่มต้น) · `waiting` (รอเขา) · `follow_up` (ตามแล้ว ยังรอ) · `appointment` (นัด) |
| `body` | ข้อความ (`note` ต้องมี body หรือ date) |
| `date` | `YYYY-MM-DD` — **บังคับ** สำหรับ waiting / follow_up / appointment |
| `time` | `HH:MM` (appointment เท่านั้น) |
| `waiting_for` / `waiting_on` | รออะไร / รอใคร (waiting เท่านั้น) |
| `images` | ลิงก์ไฟล์แนบ Discord ไม่เกิน 5 รูป (ไม่บังคับ) |

- มี `date` → วันครบกำหนดของงานเปลี่ยนเป็นวันนั้นทันที (เหมือนหน้าเว็บ)
- รายการแรกของงานเปลี่ยนสถานะ `todo` → `doing` ให้เอง

```bash
curl -s -X POST https://app.amgovenger.com/api/bot/tasks/6f1c…/updates \
  -H "Authorization: Bearer $AMGO_EDITH_KEY" -H "X-Discord-User-Id: $DISCORD_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"kind":"waiting","waiting_for":"รอใบเสนอราคา","waiting_on":"Hape HQ","date":"2026-10-31"}'
```
คืน `201 { update: {...}, task: { id, status, due } }`

### 4.5.1 `PATCH` / `DELETE /tasks/{id}/updates/{updateId}` — แก้/ลบรายการในไทม์ไลน์

ส่งเฉพาะช่องที่จะแก้: `body` · `kind` · `date` · `time` · `waiting_for` · `waiting_on` (ความหมายเดียวกับตอนเพิ่ม)

- แก้/ลบได้: แอดมิน (ตลอด) · คนบันทึกเอง **ภายใน 24 ชม.** — ไม่ใช่ = `403`
- `kind` / `date` แก้ได้เฉพาะ **รายการล่าสุด** ของงาน (รายการเก่าแก้ได้แค่ข้อความ → `400`) — แก้วันแล้ววันครบกำหนดของงานเปลี่ยนตาม
- ลบรายการล่าสุด → วันครบกำหนดกลับเป็นวันก่อนบันทึก · รูปในรายการถูกลบด้วย
- รายการ `due_change` (เลื่อนวัน) แก้ได้แค่ `body` (เหตุผล)
- คืน `{ update, task: { id, status, due } }` / `{ deleted, task }`

### 4.5.2 รูป — `/tasks/{id}/images`

ทุกรูปถูกย่อเป็น JPEG ด้านยาว 1600px (เหมือนหน้าเว็บ) · รับ JPEG / PNG / WebP / GIF ไม่เกิน 25 MB ต่อไฟล์ ครั้งละ ≤ 5 รูป

| | |
|---|---|
| `GET` | `{ images: [{ id, url, updateId, cover?, order }] }` — `url` ใช้ได้ 1 ชม. · `updateId: null` = รูปของงาน · `cover: true` = ปกบนการ์ด |
| `POST` (JSON) | `{ "url": "<ลิงก์ไฟล์แนบ Discord>" }` หรือ `{ "urls": [...] }` + `update_id` (ไม่บังคับ — แนบเข้ารายการไทม์ไลน์) |
| `POST` (multipart) | field `file` (หลายไฟล์ได้) + `update_id` |
| `PATCH` | `{ "order": ["<image id>", ...] }` — ตัวที่ส่งขึ้นก่อนตามลำดับ ตัวที่ไม่ส่งต่อท้าย · ส่งทีละกลุ่ม (รูปของงาน หรือรูปของรายการเดียว) |
| `DELETE /images/{imageId}` | ลบรูป |

- ลิงก์ที่รับมีแค่ `https://cdn.discordapp.com/…` และ `https://media.discordapp.net/…` (server เป็นคนดึง — กันการชี้ไปที่อื่น) · ไฟล์จากที่อื่นให้ส่งแบบ multipart
- สิทธิ์: ดูได้ทุกคน · เพิ่ม/เรียง/ลบ = แอดมิน · คนสร้างงาน · ผู้รับผิดชอบ

```bash
curl -s -X POST https://app.amgovenger.com/api/bot/tasks/6f1c…/images \
  -H "Authorization: Bearer $AMGO_EDITH_KEY" -H "X-Discord-User-Id: $DISCORD_USER_ID" \
  -H "Content-Type: application/json" -d '{"url":"https://cdn.discordapp.com/attachments/…/IMG_1234.png"}'
```

### 4.6 `GET /tasks/brief` — สรุปประจำวัน

| Query | ค่า |
|---|---|
| `user` | `me` (ค่าเริ่มต้น) · Discord id · user id · `team` (ทั้งทีม — Jarvis เท่านั้น) |
| `days` | 1–30 (ค่าเริ่มต้น 7) |

งานที่ยังไม่เสร็จที่คนนั้นเป็นผู้รับผิดชอบ

```bash
curl -s "https://app.amgovenger.com/api/bot/tasks/brief" \
  -H "Authorization: Bearer $AMGO_EDITH_KEY" -H "X-Discord-User-Id: $DISCORD_USER_ID"
```
```json
{
  "today": "2026-10-28", "until": "2026-11-04", "user": { "id": "…", "name": "ฝน", "discordId": "…" },
  "counts": { "overdue": 1, "dueToday": 0, "dueSoon": 2 },
  "overdue": [ { "…": "งาน", "daysLate": 3 } ],
  "dueSoon": [ { "…": "งาน", "daysLeft": 2 } ]
}
```

### 4.7 `GET /people`

```json
{ "me": { "id": "…", "name": "ฝน", "discordId": "…", "scope": "general", "isAdmin": false },
  "people": [ { "id": "…", "name": "กอล์ฟ", "discordId": "…" } ] }
```

Jarvis ได้รายละเอียดเพิ่มในแต่ละคน: `fullName` · `nickname` · `role` · `position` (ตำแหน่งงาน) · `company` · `location` (สาขาหลัก) · `employmentStatus` · `startDate` · `endDate` · `active`
และใช้ `?q=ชื่อ` (ค้นชื่อเล่น/ชื่อจริง) · `?include_inactive=1` (รวมคนที่ปิดบัญชีแล้ว) ได้

```bash
curl -s -H "Authorization: Bearer $AMGO_JARVIS_KEY" "$BASE/people?q=กอล์ฟ"
```

## 5. Error

| Status | ความหมาย |
|---|---|
| 400 | ข้อมูลไม่ครบ/ผิดรูปแบบ หรือหาพนักงานไม่เจอ (`ไม่พบพนักงาน: …`) |
| 401 | กุญแจผิดหรือถูกเพิกถอน |
| 403 | ไม่มีสิทธิ์ · Edith ไม่ได้ส่ง `X-Discord-User-Id` · Discord นี้ยังไม่ผูกกับพนักงาน |
| 404 | ไม่พบงาน / ใบลา (Edith ขอใบของคนอื่นก็ได้ 404) |
| 409 | ใบลาถูกตัดสินไปแล้ว หรือมีใบทับช่วงวันเดียวกัน |
| 500 | ข้อผิดพลาดฝั่งเซิร์ฟเวอร์ |

ทุก error = `{ "error": "ข้อความภาษาไทย" }`

## 6. HR

Jarvis เห็นของทุกคน · Edith เห็นแค่ของคนที่คุยด้วยเสมอ (ส่ง `person` เป็นคนอื่น = `403`)
ระบุคน (`person`) ได้ 3 แบบเหมือนงาน: `me` · Discord id · user id
ทุกการเขียนลงชื่อคนทำ (Jarvis = `acts_as` · Edith = คนที่คุยด้วย) ทั้งในใบลา (`approved_by` / `cancelled_by`) และ `audit_log.changed_by`
ยื่น/อนุมัติ/ปฏิเสธ ส่ง push แจ้งเตือนเหมือนกดบนเว็บ (ยื่น → HR/ผู้จัดการ · ผล → เจ้าของใบ)

```bash
BASE=https://app.amgovenger.com/api/bot
```

### 6.1 `GET /attendance` — การมาทำงาน

| พารามิเตอร์ | ค่า |
|---|---|
| `date` | `YYYY-MM-DD` (ค่าเริ่มต้น วันนี้) |
| `from` + `to` | ช่วงวัน (รวมวันนั้น · ไม่เกิน 62 วัน) แทน `date` |
| `person` | คนเดียว (Jarvis ไม่ส่ง = ทุกคน) |
| `status` | กรองผล คั่นด้วยจุลภาค: `worked` `worked_wfh` `leave` `absent` `day_off` `holiday` `not_tracked` `not_scheduled` และ `late` (มาแต่สาย) |

```bash
# วันนี้ใครขาด/สาย
curl -s -H "Authorization: Bearer $AMGO_JARVIS_KEY" "$BASE/attendance?status=absent,late"
# เช็คอินของกอล์ฟทั้งเดือน
curl -s -H "Authorization: Bearer $AMGO_JARVIS_KEY" "$BASE/attendance?person=1357559583136157696&from=2026-10-01&to=2026-10-31"
```

```json
{ "from": "2026-10-28", "to": "2026-10-28",
  "summary": { "worked": 26, "absent": 5, "late": 5, "day_off": 3, "not_tracked": 5 },
  "rows": [ { "date": "2026-10-28", "person": { "id": "…", "name": "ณัฐวดี ชื่นชิต (ยุ้ย)" },
              "company": "AGD", "unit": "พนักงานขาย", "status": "worked", "expected": "onsite",
              "late": true, "lateMinutes": 28, "checkIn": "09:28", "checkOut": null,
              "open": true, "needsReview": false, "location": "…", "checkinType": "onsite",
              "leaveType": null, "hours": 0 } ],
  "count": 1 }
```

- `summary` นับทุกแถวก่อนกรอง `status` · `open` = ยังไม่เช็คเอาท์ · `needsReview` = ลืมเช็คเอาท์ ระบบปิดกะให้ รอ HR ตรวจ
- `absent` = ควรมาแต่ไม่มีเช็คอินและไม่มีใบลาที่อนุมัติ (สูตรเดียวกับกล่องงาน HR หน้าแรก) · ระหว่างวันคนที่ยังไม่มาจะขึ้น `absent` ไปก่อน

### 6.2 `GET /leave` — รายการใบลา

`status` = `pending,approved,rejected,cancelled` หรือ `all` (ค่าเริ่มต้น) · `person` · `type` = `sick|personal|vacation` · `from`/`to` (ใบที่ทับช่วงนี้) · `limit` (50, สูงสุด 200) · ใหม่สุดก่อน

```bash
curl -s -H "Authorization: Bearer $AMGO_JARVIS_KEY" "$BASE/leave?status=pending"
```

```json
{ "leaves": [ { "id": "…", "person": { "id": "…", "name": "ปู", "discordId": "…" },
    "type": "personal", "typeLabel": "ลากิจ", "status": "pending",
    "start": "2026-10-31", "end": "2026-10-31", "days": 1, "charged": 1, "urgent": false,
    "reason": "ประชุมผู้ปกครองค่ะ", "decidedBy": null, "decidedAt": null,
    "rejectedReason": null, "cancelReason": null, "createdAt": "…" } ],
  "count": 1 }
```

`charged` = โควต้าที่หักจริง (ลาด่วน = 2 เท่าของ `days`)

### 6.3 `POST /leave` — ยื่นใบลา

```json
{ "type": "personal", "start_date": "2026-11-10", "end_date": "2026-11-11", "reason": "ธุระที่บ้าน",
  "urgent": false,
  "person": "1536548253372256276",   // Jarvis เท่านั้น — ยื่นแทน
  "approve": true }                  // Jarvis เท่านั้น — อนุมัติเลย
```

- `end_date` ไม่ส่ง = วันเดียว · นับทุกวันรวมเสาร์อาทิตย์ (เหมือนเว็บ) · ห้ามข้ามปี · ไม่เกิน 60 วัน
- ลากิจแจ้งไม่ถึง 3 วัน / พักร้อนไม่ถึง 7 วัน → หักโควต้า 2 เท่าอัตโนมัติ ตอบ `"autoUrgent": true` — ให้บอทบอกผู้ใช้
- ลากิจ/พักร้อนย้อนหลังไม่ได้ (Edith) · Jarvis ลงย้อนหลังได้ทุกประเภท
- โควต้าไม่พอ → `400` · มีใบรอ/อนุมัติทับช่วงนี้แล้ว → `409`
- ตอบ `201` `{ "leave": {…}, "autoUrgent": false }`

```bash
curl -s -X POST -H "Authorization: Bearer $AMGO_EDITH_KEY" -H "X-Discord-User-Id: <id คนที่คุย>" \
  -H "Content-Type: application/json" -d '{"type":"sick","start_date":"2026-10-28","reason":"ไข้หวัด"}' "$BASE/leave"
```

### 6.4 `PATCH /leave/{id}` — อนุมัติ / ปฏิเสธ / ยกเลิก

| body | ใครทำได้ | ใบสถานะไหน |
|---|---|---|
| `{ "action": "approve" }` | Jarvis | `pending` (ตรวจโควต้าอีกรอบ) |
| `{ "action": "reject", "reason": "…" }` | Jarvis | `pending` · ต้องมี `reason` |
| `{ "action": "cancel", "reason": "…" }` | Edith: ใบของตัวเอง · Jarvis: ทุกใบ | `pending` · ใบ `approved` เฉพาะ Jarvis และต้องมี `reason` (โควต้าคืนเอง) |

ใบถูกตัดสินไปแล้ว → `409` · ตอบ `{ "leave": {…} }` สถานะใหม่

```bash
curl -s -X PATCH -H "Authorization: Bearer $AMGO_JARVIS_KEY" -H "Content-Type: application/json" \
  -d '{"action":"reject","reason":"ช่วงนั้นคนไม่พอ"}' "$BASE/leave/<id>"
```

### 6.5 `GET /leave/balance` — โควต้าคงเหลือ

`person` (Jarvis ไม่ส่ง = ทุกคนที่ยังทำงานอยู่) · `year` (ค่าเริ่มต้น ปีนี้)

```json
{ "year": 2026, "types": ["sick","personal","vacation"],
  "people": [ { "id": "…", "name": "แอม",
    "quota": { "sick": { "total": 30, "used": 0, "remaining": 30 },
               "personal": { "total": 4, "used": 0, "remaining": 4 },
               "vacation": { "total": 6, "used": 0, "remaining": 6 } } } ] }
```

### 6.6 `GET /holidays` — วันหยุดบริษัท

`year` (ค่าเริ่มต้น ปีนี้) หรือ `from`/`to` → `{ "holidays": [ { "date", "name", "type", "workingDay", "description" } ] }`
`workingDay: true` = วันหยุดที่ยังต้องมาทำงาน (คิด OT อัตราวันหยุด)

### 6.7 `GET /documents` — เอกสาร (Jarvis)

`q` (ชื่อ/เลขที่/ผู้รับ) · `status` (`draft` …) · `limit` (30, สูงสุด 100)
→ `{ "documents": [ { "id", "docNo", "title", "period", "recipient", "status", "issuedAt", "company", "createdBy", "createdAt" } ] }`
เปิดดูตัวเอกสารต้องเข้าเว็บ (ล็อกอิน) — API ส่งแค่รายการ

ยังไม่มีใน API: สลับวันหยุด · เบิกค่าใช้จ่าย · OT/แก้เวลาเช็คเอาท์ · เงินเดือน (เจ้าของยังไม่สั่ง)

## 7. ภาพรวม + เงินเดือน (Jarvis — superadmin เท่านั้น · เพิ่ม 30 ต.ค. 69)

### 7.1 `GET /today` — วันนี้มีอะไรบ้าง ในคำขอเดียว
`?date=YYYY-MM-DD` (ค่าเริ่มต้นวันนี้ เวลาไทย) · `?days=1` (งานครบกำหนดใน n วัน 1–30)
รวมผลของ `/attendance` · `/leave?status=pending` · `/tasks/brief?user=team` โดยเรียก handler เดิมตรง ๆ (กติกาสิทธิ์ชุดเดียวกัน)
```json
{ "date": "2026-10-30",
  "attendance": { "summary": {"worked":27,"late":7,"absent":5,…},
                  "late": [{"name","company","status","late","lateMinutes","checkIn","checkOut","leaveType"}],
                  "absent": [...], "onLeave": [...], "stillOpen": [...], "needsReview": [...] },
  "leavePending": { "count": 2, "rows": [ใบลา…] },
  "tasks": { "until", "counts": {"overdue","dueToday","dueSoon"}, "overdue": [งาน…], "dueSoon": [งาน…] } }
```

### 7.2 `GET /payroll` — ยอดเงินเดือนที่ต้องจ่าย
`?month=YYYY-MM` (ค่าเริ่มต้นเดือนนี้) · `?detail=1` = แถวรายคน · กุญแจ `general` ได้ 403 เสมอ
ตัวเลขจาก `loadPayrollWithReality` + `payrollTotal` (ชุดเดียวกับหน้าเงินเดือน) · ไม่ส่งเลขบัญชี
```json
{ "month": "2026-10", "note": "ผ่านวันตัดยอดแล้ว…|ยังไม่ถึงวันตัดยอดของบางรอบ…",
  "total": 840502.12, "people": 41,
  "companies": [{ "company": {"id","code":"AGD","name"}, "people": 32, "total", "baseSalary", "otHours", "otPay",
                  "commission", "extra", "reimbursement", "deduction",
                  "cycles": { "c28": {"label":"จ่ายวันที่ 28","people","total","payDate":"2026-10-27","cutoffPassed":true}, "c4": {…} } }],
  "rows": [ (detail=1) {"person":{"id","name","code"},"company","primary","cycle","payDate","baseSalary","workDays","absentDays",
            "otHours","otPay","commission","extra","reimbursement","deduction","total","note"} ] }
```

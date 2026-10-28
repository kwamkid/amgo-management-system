# amgo Bot API — งานของทีม (v1)

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

## 5. Error

| Status | ความหมาย |
|---|---|
| 400 | ข้อมูลไม่ครบ/ผิดรูปแบบ หรือหาพนักงานไม่เจอ (`ไม่พบพนักงาน: …`) |
| 401 | กุญแจผิดหรือถูกเพิกถอน |
| 403 | ไม่มีสิทธิ์ · Edith ไม่ได้ส่ง `X-Discord-User-Id` · Discord นี้ยังไม่ผูกกับพนักงาน |
| 404 | ไม่พบงาน |
| 500 | ข้อผิดพลาดฝั่งเซิร์ฟเวอร์ |

ทุก error = `{ "error": "ข้อความภาษาไทย" }`

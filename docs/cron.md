# งานตามเวลา (cron)

ตั้งที่ **cron-job.org** ที่เดียว — ไม่ใช้ Vercel Cron (ลบ `vercel.json` ทิ้งแล้ว)

เหตุผลที่เลือก cron-job.org: เลือก timezone ได้ต่อ job จึงตั้งเป็นเวลาไทยตรง ๆ
(Vercel Cron ใช้ UTC อย่างเดียว ต้องคอยลบ 7 ชั่วโมงเอง และพลาดง่ายตอนแก้)

---

## 1. เตรียมก่อน

### ตั้ง `CRON_SECRET`

สุ่มรหัสยาว ๆ มาหนึ่งอัน:

```bash
openssl rand -hex 32
```

เอาไปใส่ 2 ที่ให้ตรงกัน:

- ไฟล์ `.env.local` (ตอน dev)
- Environment Variables ของที่ deploy จริง (Vercel → Settings → Environment Variables)

> ถ้าไม่ตั้ง `CRON_SECRET` ตอน production ระบบจะปฏิเสธทุกคำเรียก — ตั้งใจให้เป็นแบบนั้น
> จะได้ไม่มีกรณี "ลืมตั้งแล้วใครก็ยิงงานได้"

### โดเมน

โดเมนจริงคือ **`https://app.amgovenger.com`** (ตั้งใน Vercel ตั้งแต่ 9 ส.ค. 69)
ทุก URL ในเอกสารนี้ใช้โดเมนนี้ตรง ๆ ก๊อปวางที่ cron-job.org ได้เลย

เช็คว่าพร้อมตั้ง cron หรือยัง — ยิงเปล่า ๆ โดยไม่ใส่รหัส ต้องได้ `401`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app.amgovenger.com/api/web/nightly
```

ได้ `401` = ขึ้นแล้วและด่านรหัสทำงาน (ตรวจล่าสุด 16 ส.ค. 69 ครบทั้ง 5 endpoint)
ได้ `404` = ยังไม่ได้ deploy · ได้ `200` = **อันตราย** แปลว่าไม่ได้ตั้ง `CRON_SECRET` ใครก็ยิงงานได้

---

## 2. งานที่ตั้งไว้ — 8 งาน

ตั้งครบแล้วที่ cron-job.org เมื่อ 16 ส.ค. 69 · ตารางนี้ตรงกับของจริงบนหน้าเว็บ

| # | งาน | เวลา | เรื่อง |
|---|---|---|---|
| 1 | ปิดกะให้คนที่ลืมเช็คเอาท์ | 23:59 | คน |
| 2 | ลบรูปเก่าเกิน 60 วัน | 03:30 | คน |
| 3 | ตัดยอดเงินเดือน | 23:30 | คน |
| 4 | ตรวจเว็บประจำคืน (สแกนมัลแวร์ + ปลั๊กอิน) | 02:00 | เว็บ |
| 5 | ไล่คิวงานเว็บ | ทุก 2 นาที | เว็บ |
| 6 | เตือนวันหมดอายุ โดเมน/โฮสต์/SSL | 09:00 | เว็บ |
| 7 | เช็คเว็บล่ม | ทุกชั่วโมง | เว็บ |
| 8 | อวยพรวันเกิดพนักงาน | 09:30 | คน |

### งานที่ 1 · ปิดกะให้คนที่ลืมเช็คเอาท์

| ช่อง | ค่า |
|---|---|
| Title | `AMGO — ปิดกะอัตโนมัติ` |
| URL | `https://app.amgovenger.com/api/cron/auto-checkout` |
| Schedule | Every day at **23:59** |
| Timezone | `Asia/Bangkok` |
| Request method | `GET` |
| Header | `Authorization: Bearer <CRON_SECRET>` |
| Treat as success | HTTP `200` |

**ทำอะไร:** หากะที่เปิดค้างเกิน 12 ชั่วโมง แล้วปิดให้

⚠️ **ไม่เดาชั่วโมงทำงานให้** — บันทึกเวลาปิดกะไว้ แต่ตั้งชั่วโมงเป็น 0
แล้วติดสถานะ `needs_review` รอ HR ตัดสิน
(ของเดิมเดาให้ ผลคือเฉลี่ย 15.4 ชม. สูงสุด 26.55 ชม. ไหลเข้าไปคิดค่าแรง)

→ หลังตั้งงานนี้แล้ว **ต้องมีคนไล่เคลียร์รายการ `needs_review` เป็นประจำ**
ตอนนี้ค้างอยู่ 203 รายการจากข้อมูลเก่า

---

### งานที่ 2 · ลบรูปที่เก่าเกิน 60 วัน

| ช่อง | ค่า |
|---|---|
| Title | `AMGO — ลบรูปเก่า 60 วัน` |
| URL | `https://app.amgovenger.com/api/cron/cleanup-photos` |
| Schedule | Every day at **03:30** |
| Timezone | `Asia/Bangkok` |
| Request method | `GET` |
| Header | `Authorization: Bearer <CRON_SECRET>` |
| Treat as success | HTTP `200` |

**ทำอะไร:** ลบรูปเซลฟี่ตอนเช็คอิน + รูปหลักฐานส่งของ ที่เก่ากว่า 60 วัน
ทีละ 300 แถวต่อตารางต่อรอบ (cron-job.org รอผลได้ 30 วินาที — เกินแล้วตัดสาย)

ถ้ายังลบไม่หมด คำตอบจะมี `"done": false` และบอกจำนวนที่เหลือ
วันถัดไปจะไล่เก็บต่อเอง ไม่ต้องทำอะไร

> **ตอนนี้ยังไม่มีอะไรให้ลบ** — รูปทั้งหมดที่มี (เช็คอิน 3,897 · ส่งของ 3,463)
> ยังเป็นลิงก์ของ Firebase ที่ย้ายมา ตัวไฟล์อยู่บน Firebase ซึ่งเราตกลงกันว่าไม่แตะ
> งานนี้จะเริ่มมีผลกับรูปที่ถ่ายใหม่บน Supabase เท่านั้น
>
> 615.7 MB ที่ค้างบน Firebase ต้องลบมือทีเดียวตอนเลิกใช้ Firebase

### งานที่ 3 · ตัดยอดเงินเดือนอัตโนมัติ

| ช่อง | ค่า |
|---|---|
| Title | `AMGO — ตัดยอดเงินเดือน` |
| URL | `https://app.amgovenger.com/api/cron/payroll-cutoff` |
| Schedule | Every day at **23:30** |
| Timezone | `Asia/Bangkok` |
| Request method | `GET` |
| Header | `Authorization: Bearer <CRON_SECRET>` |
| Treat as success | HTTP `200` |

**ทำอะไร:** ถึงวันตัดยอดของรอบจ่ายไหน ก็ตรึงตัวเลขวันมา/ขาด/OT ของรอบนั้นลง
`payroll_entries` ให้เอง แล้ว HR ค่อยมาเติมค่าคอม/เงินพิเศษทีหลัง

| รอบ | นับงานช่วง | ตัดยอด | เงินออก |
|---|---|---|---|
| `c28` | 26 เดือนก่อน – 25 เดือนนี้ | วันที่ **25** | วันที่ 28 เดือนเดียวกัน |
| `c4` | 1 – สิ้นเดือนนี้ | **สิ้นเดือน** | วันที่ 4 ของเดือนถัดไป |

**เดือนของงวด = เดือนที่ทำงาน ไม่ใช่เดือนที่เงินออก** — งวดกรกฎาคมของรอบ `c4`
คืองาน 1–31 ก.ค. ที่ได้เงินวันที่ 4 ส.ค.

ต้องรันตอนดึกของวันตัดยอด (23:30) เพราะคนที่ทำงานวันนั้นยังเช็คเอาท์ไม่ครบตอนเย็น
— ตั้งไว้ก่อน 23:59 ของงานที่ 1 เพราะใบที่ลืมเช็คเอาท์จะถูกปิดทีหลัง ตัวเลข
จึงยังขยับได้อีกนิด HR กดปุ่ม "รีเฟรชวันมา-ขาด/OT" ในหน้า /payroll ได้ตลอด

วันที่ไม่ใช่วันตัดยอดของรอบไหนเลย จะตอบ `"cutoffToday": false` แล้วจบ ไม่ใช่ error

**รันซ้ำได้ไม่พัง** — แถวที่มีอยู่แล้วถูกอัปเดตเฉพาะวันมา/ขาด/OT
ส่วนค่าคอม เงินพิเศษ เงินหัก หมายเหตุ ที่ HR พิมพ์เองไม่ถูกแตะ

---

### งานที่ 4 · ตรวจเว็บลูกค้าทุกคืน (สแกนมัลแวร์ + เช็คปลั๊กอิน)

| ช่อง | ค่า |
|---|---|
| Title | `AMGO — ตรวจเว็บประจำคืน` |
| URL | `https://app.amgovenger.com/api/web/nightly` |
| Schedule | Every day at **02:00** |
| Timezone | `Asia/Bangkok` |
| Request method | `GET` |
| Header | `Authorization: Bearer <CRON_SECRET>` |
| Treat as success | HTTP `200` |

**ทำอะไร:** ต่อคิวงานให้ทุกเว็บที่ยัง active และรู้ path — เว็บละ 2 ใบ

| ลำดับ | งาน | ทำอะไร | เวลา/เว็บ |
|---|---|---|---|
| 1 | `scan` | `grep` หาไฟล์เข้าข่ายมัลแวร์ใต้ public_html | ~10–30 วิ |
| 2 | `plugin_check` | `wp plugin list` นับตัวที่ค้างอัปเดต | ~3 วิ |

**สแกนมัลแวร์เข้าคิวก่อนเสมอ** เพราะคิวเป็น FIFO และโฮสต์หนึ่งทำได้ทีละงาน
คืนไหนคิวเดินไม่จบ สิ่งที่ได้ทำไปแล้วต้องเป็นเรื่องมัลแวร์ ไม่ใช่การนับเลขเวอร์ชัน

ทั้งสองงาน**อ่านอย่างเดียว** ไม่แตะไฟล์ ไม่แตะฐานข้อมูลของเว็บลูกค้า
เว็บที่มีงานชนิดเดียวกันค้างคิวอยู่แล้วจะถูกข้าม — กดซ้ำ/รันซ้ำได้ไม่พอกคิว

ถ้าชนิดใดชนิดหนึ่งต่อคิวไม่สำเร็จ จะตอบ **HTTP 500** พร้อมบอกว่าชนิดไหนพัง
(อีกชนิดที่สำเร็จยังอยู่ในคิวตามปกติ) — เปิด Notification on failure ไว้จะได้รู้

> งานนี้แค่**ต่อคิว** ไม่ได้ลงมือเอง ต้องมีงานที่ 5 คอยไล่คิวด้วย ไม่งั้นงานจะนอนค้าง

---

### งานที่ 5 · ไล่คิวงานเว็บ

| ช่อง | ค่า |
|---|---|
| Title | `AMGO — ไล่คิวงานเว็บ` |
| URL | `https://app.amgovenger.com/api/web/jobs/next` |
| Schedule | Every **2 minutes** |
| Timezone | `Asia/Bangkok` |
| Request method | `GET` |
| Header | `Authorization: Bearer <CRON_SECRET>` |
| Treat as success | HTTP `200` |

**ทำอะไร:** หยิบงานจากคิวมารัน รอบละไม่เกิน 4 ใบ **และโฮสต์หนึ่งได้ทีละใบ**

ข้อบังคับทีละงานต่อโฮสต์อยู่ที่ระดับ SQL (`web_claim_jobs`) ห้ามแก้ให้ขนานกว่านี้
— ของจริงเคยยิงพร้อมกันทั้งโฮสต์แล้ว load พุ่ง 12+ จนเว็บลูกค้าช้า

งานที่ค้างสถานะ `running` เกิน 5 นาทีจะถูกตัดเป็น `failed` อัตโนมัติ แล้วปลดล็อกโฮสต์ให้
(กันคิวตายยกโฮสต์เพราะงานผีใบเดียว)

ไม่มีงานในคิวก็ตอบ 200 เฉย ๆ ไม่ใช่ error — ยิงถี่ทุก 2 นาทีได้ไม่เปลือง

> ไม่อยากรอรอบ cron กดปุ่ม **"เร่งคิวเดี๋ยวนี้"** ในหน้า `/websites/jobs` ได้เลย

---

### งานที่ 6 · เตือนวันหมดอายุ โดเมน / โฮสต์ / SSL

| ช่อง | ค่า |
|---|---|
| Title | `AOO Web — เตือนหมดอายุ` |
| URL | `https://app.amgovenger.com/api/web/expiry` |
| Schedule | Every day at **09:00** · `Asia/Bangkok` |
| Header | `Authorization: Bearer <CRON_SECRET>` |

**ทำอะไร:** เหลือ ≤ 30 วันหรือเลยกำหนดแล้ว ส่งเข้า Discord เป็น**สรุปใบเดียวต่อวัน**
เรียงใกล้หมดขึ้นก่อน — 25+ เว็บถ้าแยกใบจะท่วมห้องแชท

---

### งานที่ 7 · เช็คเว็บล่ม

| ช่อง | ค่า |
|---|---|
| Title | `AOO Web — เช็คเว็บล่ม` |
| URL | `https://app.amgovenger.com/api/web/uptime` |
| Schedule | Every **hour** · `Asia/Bangkok` |
| Header | `Authorization: Bearer <CRON_SECRET>` |

**ทำอะไร:** ไล่เปิดทุกเว็บดูว่ายังขึ้นอยู่ไหม · แจ้ง Discord **เฉพาะตอนเปลี่ยนสถานะ**
(ล่มใหม่ / กลับมาแล้ว) ไม่งั้นเว็บที่ล่มยาวจะสแปมทุกชั่วโมง
กดเช็คเองจากหน้ารายการได้ด้วย (POST — ต้องอยู่ใน `web_owners`)

---

### งานที่ 8 · อวยพรวันเกิดพนักงาน

| ช่อง | ค่า |
|---|---|
| Title | `Happy Birthday` |
| URL | `https://app.amgovenger.com/api/cron/birthday` |
| Schedule | Every day at **09:30** · `Asia/Bangkok` |
| Header | `Authorization: Bearer <CRON_SECRET>` |

**ทำอะไร:** ส่งคำอวยพรเข้า Discord · เทียบวัน/เดือนตามเวลาไทยไม่ใช่ UTC
(ไม่งั้นคนเกิดวันที่ 1 จะได้รับตั้งแต่ 5 ทุ่มของวันที่ 31) · จดไว้ว่าส่งวันไหนแล้ว
กัน cron ยิงซ้ำ · **ไม่บอกอายุและปีเกิด** เป็นข้อมูลส่วนตัว · คนที่ลาออกแล้วไม่ส่ง

---

## 3. ใส่ header ที่ cron-job.org ยังไง

1. เปิดหน้าแก้ไข job → แท็บ **Advanced**
2. หัวข้อ **Headers** กด **Add header**
3. Key = `Authorization`  ·  Value = `Bearer <รหัสที่สุ่มไว้>`

ถ้าเจอปัญหาแก้ `Authorization` ไม่ได้ ใช้ header ชื่ออื่นแทนได้:

```
x-cron-secret: <รหัส>
```

**ทางสุดท้ายจริง ๆ** ถ้าใส่ header ไม่ได้เลย ต่อท้าย URL ได้:

```
https://app.amgovenger.com/api/cron/auto-checkout?secret=<รหัส>
```

⚠️ วิธีนี้รหัสจะติดอยู่ใน log ทั้งฝั่ง cron-job.org (เก็บประวัติการเรียกให้ดูย้อนหลัง)
และฝั่ง server — เลี่ยงได้ควรเลี่ยง

---

## 4. ทดสอบก่อนตั้งจริง

```bash
# ปิดกะอัตโนมัติ
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://app.amgovenger.com/api/cron/auto-checkout | jq

# ลบรูปเก่า
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://app.amgovenger.com/api/cron/cleanup-photos | jq

# ต่อคิวตรวจเว็บประจำคืน
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://app.amgovenger.com/api/web/nightly | jq

# ไล่คิว (เรียกซ้ำจนกว่าคิวจะหมด)
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://app.amgovenger.com/api/web/jobs/next | jq
```

ควรได้ `{"success": true, ...}`
ถ้าได้ `401 Unauthorized` แปลว่ารหัสไม่ตรงกัน หรือยังไม่ได้ตั้งฝั่ง server

งานที่ 4 จะตอบแยกรายชนิดมาให้ดูว่าต่อคิวไปกี่ใบ ข้ามไปกี่เว็บ:

```json
{
  "success": true,
  "jobs": 98,
  "batches": [
    { "type": "scan",         "batchId": "…", "jobs": 49, "skipped": 0 },
    { "type": "plugin_check", "batchId": "…", "jobs": 49, "skipped": 0 }
  ]
}
```

### ลบรูปย้อนหลังทีเดียวเยอะ ๆ

ค่าปกติทำทีละ 300 แถว ถ้าอยากเร่งเก็บของค้างสั่งได้สูงสุด 2000:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://app.amgovenger.com/api/cron/cleanup-photos?limit=2000" | jq
```

---

## 5. ดูว่ารันไปแล้วเมื่อไหร่

เก็บไว้ในตาราง `app_config`:

```sql
select key, value, note, updated_at
from app_config
where key = 'photo_cleanup_last_run';
```

ส่วนรายการที่ระบบปิดกะให้ ดูได้จาก:

```sql
select user_name, work_date, checkin_time, checkout_time
from checkins
where hours_status = 'needs_review'
order by work_date desc;
```

ส่วนผลตรวจเว็บ ดูได้ที่หน้า `/websites/jobs` หรือถามฐานข้อมูลตรง ๆ:

```sql
-- เว็บที่สแกนแล้วยังเจอของต้องสงสัย
select site_name, last_scan_status, last_scan_at
from web_sites
where last_scan_status = 'suspect'
order by last_scan_at desc nulls last;
```

---

## หมายเหตุ

- cron-job.org แผนฟรี: 50 job · เรียกถี่สุดทุก 1 นาที · รอผลลัพธ์ 30 วินาที
- เปิด **Notification on failure** ไว้ด้วย จะได้รู้ตอนงานล้ม
- ทุก endpoint ในเอกสารนี้รับทั้ง `GET` และ `POST` ผลเหมือนกัน
- เรียกซ้ำได้ไม่เสียหาย (idempotent) — ปิดกะจะข้ามกะที่ถูกปิดไปแล้ว
  ลบรูปจะไม่เจอแถวเดิมอีกเพราะล้างคอลัมน์ไปแล้ว
  ส่วนงานเว็บจะข้ามเว็บที่มีงานชนิดเดียวกันค้างคิวอยู่แล้ว

### ผลตรวจที่เด้งบ่อยแต่ไม่ใช่มัลแวร์

ตัวสแกนจับด้วย pattern (`eval(base64_decode`, `shell_exec(`, `assert($_`) ซึ่ง
**ไลบรารีปกติก็ใช้** — ไฟล์ที่ยืนยันแล้วว่าไม่ใช่ ใส่ไว้ในตาราง `web_false_positives`
แล้วรอบต่อไปจะไม่เตือนอีก (`%` = wildcard):

```sql
select path_pattern, description from web_false_positives order by path_pattern;
```

ถ้าไม่ใส่ alert จะเด้งเรื่องเดิมทุกคืนจนคนเลิกอ่าน แล้ววันที่เจอของจริงก็จะถูกกวาดผ่านไปด้วย
— **ยกเว้นตาม path เท่านั้น ห้ามถอด pattern ออกจาก `SCAN_PATTERNS`**

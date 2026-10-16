# amgo SEO / AEO API (v1)

API อ่านข้อมูล SEO / AEO ของเว็บที่ amgo ติดตามอยู่ เช่น aDay Fresh, CodeLab, AooCommerce และเพิ่มคำเป้าหมายได้
ตัวเลขทุกตัวเป็นชุดเดียวกับที่หน้า amgo (เมนู SEO / AEO) แสดง

- **Base URL:** `https://app.amgovenger.com/api/seo/v1`
- **รูปแบบ:** JSON (UTF-8) · วันที่เป็น `YYYY-MM-DD`
- **ตัวเลขในตัวอย่าง JSON:** เป็นตัวอย่างประกอบ ไม่ใช่ค่าจริงทุกตัว
- **ข้อมูลอัปเดต:** วันละครั้ง ประมาณตี 4 (เวลาไทย) ข้อมูล Google ช้ากว่าวันจริง 2–3 วัน ดูวันล่าสุดที่มีได้จาก `dataThrough`

---

## 1. ขอกุญแจ (API key)

เจ้าของ amgo เป็นคนสร้างให้ที่ **SEO / AEO → ตั้งค่าเว็บ → API ให้เว็บอื่นดึงข้อมูล**

- กุญแจหน้าตาแบบ `amgo_seo_xxxxxxxxxxxxxxxx…`
- กุญแจหนึ่งใบผูกได้บางเว็บหรือทุกเว็บ ขอดูเว็บที่ไม่ได้ผูกไว้จะได้ `404`
- **ค่าเริ่มต้นอ่านได้อย่างเดียว** ถ้าจะเพิ่มคำเป้าหมายด้วย ต้องให้เจ้าของติ๊ก "ให้เพิ่มคำเป้าหมายได้ด้วย" ตอนสร้างกุญแจ
- กุญแจถูกเพิกถอนได้ทุกเมื่อ หลังเพิกถอนจะได้ `401`

> ⚠️ **เก็บกุญแจไว้ฝั่ง server เท่านั้น** (env เช่น `AMGO_SEO_API_KEY`)
> ห้ามใส่ในโค้ด JavaScript ที่รันในเบราว์เซอร์ และห้าม commit ลง git เพราะใครถือกุญแจก็ดูข้อมูลทั้งเว็บได้

## 2. การยืนยันตัวตน

ส่ง header ตัวใดตัวหนึ่ง:

```
Authorization: Bearer amgo_seo_xxx
```
หรือ
```
x-api-key: amgo_seo_xxx
```

---

## 3. Endpoints

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| GET | `/sites` | เว็บที่กุญแจนี้ดูได้ (ใช้หา `id`) |
| GET | `/sites/{id}?days=28&compare=prev` | ภาพรวม: คลิกจาก Google · คำเป้าหมายติดอันดับกี่คำ · AI อ้างเรากี่ข้อ |
| GET | `/sites/{id}/keywords` | อันดับรายคำ พร้อมเหตุผล |
| GET | `/sites/{id}/ai` | AEO: AI แต่ละตัวอ้างเราในคำถามไหน · AI Overview เทียบคู่แข่ง |
| POST | `/sites/{id}/keywords` | เพิ่มคำเป้าหมาย (กุญแจต้องเปิดสิทธิ์เพิ่มคำ) |

### 3.1 `GET /sites`

```json
{
  "sites": [
    { "id": "4c5e2b49-…", "name": "aDay Fresh", "domain": "adayfresh.com", "dataThrough": "2026-10-16" }
  ]
}
```

### 3.2 `GET /sites/{id}` — ภาพรวม

| Query | ค่า | ค่าเริ่มต้น |
|---|---|---|
| `days` | 7–365 (จำนวนวันย้อนหลัง นับจาก `dataThrough`) | 28 |
| `compare` | `prev` = เทียบช่วงยาวเท่ากันก่อนหน้า · `yoy` = เทียบช่วงเดียวกันปีก่อน | prev |

```json
{
  "site": { "id": "…", "name": "aDay Fresh", "domain": "adayfresh.com", "dataThrough": "2026-10-16" },
  "gsc": {
    "period":       { "from": "2026-09-19", "to": "2026-10-16" },
    "comparedWith": { "from": "2026-08-22", "to": "2026-09-18" },
    "current":  { "clicks": 5226, "impressions": 513788, "ctr": 0.0102, "position": 6.65 },
    "previous": { "clicks": 9866, "impressions": 794668, "ctr": 0.0124, "position": 6.1 },
    "changePct": { "clicks": -47.0, "impressions": -35.3 },
    "daily": [ { "date": "2026-09-19", "clicks": 180, "impressions": 17000, "ctr": 0.0106, "position": 6.4 } ]
  },
  "keywords": { "total": 44, "top3": 8, "top10": 24, "page23": 7, "none": 13, "unchecked": 0 },
  "ai": {
    "google":     { "label": "Google AI",  "cited": 22, "mentioned": 25, "total": 42 },
    "chatgpt":    { "label": "ChatGPT",    "cited": 9,  "mentioned": 14, "total": 44 },
    "perplexity": { "label": "Perplexity", "cited": 24, "mentioned": 26, "total": 44 },
    "gemini":     { "label": "Gemini",     "cited": 33, "mentioned": 35, "total": 44 }
  },
  "aiOverview": {
    "fetchedOn": "2026-10-09", "mentions": 321,
    "top": { "domain": "premium-fruit.co.th", "mentions": 116 },
    "ours": 100, "gap": 78
  }
}
```

ความหมายของฟิลด์:
- `gsc` = ข้อมูลจาก Google Search Console (คนค้นจริง) · `ctr` เป็นสัดส่วน 0–1 (0.0102 = 1.02%) · `position` = อันดับเฉลี่ย (น้อย = ดี)
- `gsc.previous` / `gsc.changePct` = `null` เมื่อเทียบไม่ได้ (ช่วงเทียบเก่ากว่าข้อมูลที่มี) · `changePct` เป็น % แล้ว
- `gsc` = `null` เมื่อเว็บยังไม่เคยดึงข้อมูล Google
- `keywords`: `top3` / `top10` = ติดอันดับ 1–3 / 1–10 (`top10` รวม `top3` แล้ว) · `page23` = อันดับ 11–30 · `none` = ไม่ติด 30 อันดับแรก · `unchecked` = ยังไม่เคยเช็ค
- `ai` = ย้อนหลัง 30 วัน · `cited` = ใส่ลิงก์เว็บเรา · `mentioned` = เอ่ยชื่อเรา (รวมที่ใส่ลิงก์) · `total` = จำนวนคำถามที่ถาม (Google = จำนวนคำค้นที่มีกล่อง AI Overview)
- `aiOverview` = คำตอบ Google AI Overview จริง ดึงเดือนละครั้ง (`null` = ยังไม่เคยดึง) · `mentions` = จำนวนคำตอบที่อ้างเรา · `top` = คู่แข่งที่ถูกอ้างมากสุด · `ours` = จำนวนคำถามที่อ้างเรา · `gap` = จำนวนคำถามที่อ้างคู่แข่งแต่ไม่อ้างเรา

### 3.3 `GET /sites/{id}/keywords` — อันดับรายคำ

| Query | ค่า |
|---|---|
| `all=1` | รวมคำที่ปิดติดตามไว้ด้วย (ค่าเริ่มต้น = เฉพาะคำที่ติดตาม) |

```json
{
  "site": { "…": "…" },
  "keywords": [
    {
      "keyword": "กระเช้าผลไม้ ส่งด่วน",
      "group": "หน้าขาย",
      "searchVolume": 70,
      "targetPath": "/shipping/",
      "tracked": true,
      "rank": 2,
      "rankBefore": 2,
      "rankStatus": "disputed",
      "rankSource": "gsc",
      "rankReason": "ระบบเช็คเจอแค่หน้าอื่นลึก ๆ 5 ครั้งติด แต่คนค้นจริง (GSC) เห็น ~#2 — Google เสิร์ฟคนละชุด เชื่อฝั่งที่เจอ",
      "foundInChecks": { "found": 3, "of": 9 },
      "rankedUrl": "https://www.adayfresh.com/product/petite-glory/",
      "lastChecked": "2026-10-12",
      "gsc": { "position": 1.8, "impressions10d": 12, "clicks28d": 4 },
      "googleAiOverview": { "shown": true, "citesUs": false },
      "ai": {
        "chatgpt": { "cited": false, "mentioned": true, "checkedOn": "2026-10-15", "prompt": "กระเช้าผลไม้ ส่งด่วน ที่ไหนดี แนะนำหน่อย" }
      }
    }
  ]
}
```

- **`rank`** = อันดับที่ควรแสดง (`null` = ไม่ติด 30 อันดับแรก) ระบบดูประวัติ 10 ครั้งล่าสุด หน้าที่เจอ และ GSC ประกอบกันก่อนตัดสิน **ให้ใช้ตัวนี้ อย่าคิดอันดับเองจากข้อมูลดิบ**
- `rankBefore` = อันดับก่อนรอบเช็คล่าสุด ใช้แสดงขึ้น/ลง
- `rankStatus`:
  - `steady` = เจอทุกครั้ง
  - `split` = Google สลับชุดผลค้นหา บางครั้งเจอบางครั้งไม่เจอ แต่ยังนับว่าติด
  - `disputed` = ระบบเช็คไม่เจอ แต่คนค้นจริง (GSC) เห็น จึงใช้อันดับจาก GSC
  - `gone` = หลุดจริง
  - `none` = ยังไม่เคยเจอ
  - `unchecked` = ยังไม่เคยเช็ค
- `rankSource`: `check` = มาจากระบบเช็คอันดับ · `gsc` = มาจากคนค้นจริง · `none` = ไม่ติด
- `rankReason` = เหตุผลภาษาไทย เอาไปแสดงเป็น tooltip ได้เลย
- `rankedUrl` = หน้าที่ติดในการเช็คล่าสุด (อาจไม่ใช่ `targetPath`)
- `gsc.position` = อันดับเฉลี่ยจาก GSC 10 วันล่าสุด (`null` = ไม่มีคนเห็น)
- `googleAiOverview` = `null` เมื่อเป็นประวัติเก่าที่ไม่มีข้อมูล AI
- `ai` = มีเฉพาะ AI ที่เคยถามคำถามที่ผูกกับคำนี้ (`google` ไม่อยู่ในนี้ ดู `googleAiOverview`)

### 3.4 `GET /sites/{id}/ai` — AEO

```json
{
  "site": { "…": "…" },
  "engines": {
    "gemini": {
      "label": "Gemini", "cited": 33, "mentioned": 35, "total": 44,
      "items": [ { "text": "ของเยี่ยมไข้ ที่ไหนดี แนะนำหน่อย", "state": "cited" } ]
    }
  },
  "aiOverview": {
    "fetchedOn": "2026-10-09",
    "share": [ { "domain": "adayfresh.com", "isUs": true, "mentions": 321, "aiSearchVolume": 5400 } ],
    "citedUs": [
      { "kind": "ours", "question": "…", "platform": "google", "aiSearchVolume": 320, "sources": ["adayfresh.com"], "competitor": null, "lastSeen": "2026-10-01T…" }
    ],
    "opportunities": [
      { "kind": "gap", "question": "…", "platform": "google", "aiSearchVolume": 210, "sources": ["premium-fruit.co.th"], "competitor": "premium-fruit.co.th", "lastSeen": "…" }
    ]
  }
}
```

- `engines.*.items[].state`: `cited` = ใส่ลิงก์เรา · `mentioned` = เอ่ยชื่อแต่ไม่มีลิงก์ · `none` = ไม่พูดถึงเรา
- `aiOverview.share` = AI อ้างเราเทียบคู่แข่งกี่คำตอบ เรียงจากมากไปน้อย
- `aiOverview.citedUs` = คำถามที่ AI อ้างเราอยู่แล้ว
- `aiOverview.opportunities` = คำถามที่ AI อ้างคู่แข่งแต่ไม่อ้างเรา ใช้เป็นงาน AEO ที่ควรทำต่อ
- ภาษาไทยตอนนี้มีข้อมูลเฉพาะ Google AI Overview

### 3.5 `POST /sites/{id}/keywords` — เพิ่มคำเป้าหมาย

ต้องใช้กุญแจที่เปิดสิทธิ์เพิ่มคำ ไม่งั้นได้ `403`

```json
{
  "keywords": ["กระเช้าผลไม้", "ของเยี่ยมไข้"],
  "targetPath": "/get-well-soon/",
  "group": "หน้าขาย",
  "priority": 1
}
```

| ฟิลด์ | ต้องมี | หมายเหตุ |
|---|---|---|
| `keywords` | ✅ | array ของคำ (หรือ string คั่นด้วยขึ้นบรรทัด) · ครั้งละไม่เกิน 100 คำ · ระบบแปลงเป็นตัวพิมพ์เล็ก ตัดช่องว่างซ้ำ และตัดคำซ้ำให้ |
| `targetPath` | | หน้าเป้าหมายของคำ เช่น `/get-well-soon/` |
| `group` | | ชื่อกลุ่ม |
| `priority` | | `1` / `2` / `3` |

ตอบกลับ `201`:
```json
{ "site": { "…": "…" }, "saved": 2, "keywords": ["กระเช้าผลไม้", "ของเยี่ยมไข้"], "note": "เช็คอันดับครั้งแรกในรอบตี 4 ถัดไป" }
```
- คำที่มีอยู่แล้วจะถูกอัปเดตกลุ่ม หน้าเป้าหมาย และลำดับความสำคัญ ไม่สร้างซ้ำ
- คำใหม่ได้คำถามสำหรับถาม AI อัตโนมัติ
- ⚠️ ทุกคำเสียค่าเช็คอันดับทุกสัปดาห์ (~$0.006 ต่อคำต่อรอบ) เพิ่มเฉพาะคำที่ตั้งใจติดตามจริง

---

## 4. Error

ทุก error ตอบเป็น `{ "error": "ข้อความภาษาไทย" }`

| Status | ความหมาย |
|---|---|
| 400 | ข้อมูลที่ส่งมาไม่ถูกรูปแบบ |
| 401 | ไม่มีกุญแจ กุญแจผิด หรือถูกเพิกถอนแล้ว |
| 403 | กุญแจอ่านได้อย่างเดียว แต่พยายามเพิ่มคำ |
| 404 | ไม่พบเว็บ หรือกุญแจนี้ไม่ได้ผูกกับเว็บนี้ |
| 500 | ระบบขัดข้อง ลองใหม่ภายหลัง |

## 5. Cache และความถี่

- คำตอบ GET มี `Cache-Control: private, max-age=300` (5 นาที)
- ข้อมูลเปลี่ยนวันละครั้ง ฝั่งที่เรียก **cache ไว้ 1 ชั่วโมงขึ้นไปได้เลย** ไม่ต้องเรียกทุกครั้งที่มีคนเปิดหน้า
- CORS เปิดไว้ แต่ให้เรียกจากฝั่ง server ตามข้อ 1

---

## 6. ตัวอย่างการใช้งาน

### curl
```bash
# หา id ของเว็บ
curl -s https://app.amgovenger.com/api/seo/v1/sites \
  -H "Authorization: Bearer $AMGO_SEO_API_KEY"

# ภาพรวม 90 วัน เทียบปีก่อน
curl -s "https://app.amgovenger.com/api/seo/v1/sites/<id>?days=90&compare=yoy" \
  -H "Authorization: Bearer $AMGO_SEO_API_KEY"

# เพิ่มคำ
curl -s -X POST https://app.amgovenger.com/api/seo/v1/sites/<id>/keywords \
  -H "Authorization: Bearer $AMGO_SEO_API_KEY" -H "Content-Type: application/json" \
  -d '{"keywords":["กระเช้าผลไม้"],"targetPath":"/"}'
```

### Next.js (App Router · ฝั่ง server)
```ts
// lib/amgoSeo.ts — เรียกได้จาก Server Component / Route Handler เท่านั้น
const BASE = 'https://app.amgovenger.com/api/seo/v1'

async function amgoSeo<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.AMGO_SEO_API_KEY}`, 'Content-Type': 'application/json', ...init?.headers },
    next: init?.method === 'POST' ? undefined : { revalidate: 3600 }, // ข้อมูลเปลี่ยนวันละครั้ง
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`amgo SEO API ${res.status}: ${json.error}`)
  return json as T
}

export const getSeoSummary = (siteId: string, days = 28) => amgoSeo(`/sites/${siteId}?days=${days}`)
export const getSeoKeywords = (siteId: string) => amgoSeo(`/sites/${siteId}/keywords`)
export const getSeoAi = (siteId: string) => amgoSeo(`/sites/${siteId}/ai`)
export const addSeoKeywords = (siteId: string, keywords: string[], targetPath?: string) =>
  amgoSeo(`/sites/${siteId}/keywords`, { method: 'POST', body: JSON.stringify({ keywords, targetPath }) })
```

### WordPress (PHP)
```php
// wp-config.php: define('AMGO_SEO_API_KEY', 'amgo_seo_xxx');
function amgo_seo_get($path) {
  $cache_key = 'amgo_seo_' . md5($path);
  $cached = get_transient($cache_key);
  if ($cached !== false) return $cached;

  $res = wp_remote_get('https://app.amgovenger.com/api/seo/v1' . $path, [
    'headers' => ['Authorization' => 'Bearer ' . AMGO_SEO_API_KEY],
    'timeout' => 15,
  ]);
  if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) return null;

  $data = json_decode(wp_remote_retrieve_body($res), true);
  set_transient($cache_key, $data, HOUR_IN_SECONDS); // ข้อมูลเปลี่ยนวันละครั้ง
  return $data;
}

// ใช้: $summary = amgo_seo_get('/sites/<id>?days=28');
```

---

## 7. ข้อควรรู้

- ตัวเลขอันดับมาจากระบบเช็คอันดับของ Google ประเทศไทย (ดู 30 อันดับแรก) ประกอบกับ GSC **ให้ใช้ `rank` / `rankStatus` / `rankReason` ตามที่ API ให้มา** อย่าคิดอันดับเองจาก `rankedUrl` หรือ `gsc.position`
- `gsc.position` เป็นค่าเฉลี่ยของคนค้นจริงทุกประเทศทุกอุปกรณ์ จึงอาจต่างจาก `rank` ได้
- ข้อมูล AI (`ai`, `engines`) ย้อนหลัง 30 วัน ส่วน `aiOverview` อัปเดตเดือนละครั้ง
- มีปัญหาหรืออยากได้ข้อมูลเพิ่ม ติดต่อเจ้าของ amgo (โค้ดอยู่ที่ `app/api/seo/v1/` ใน repo amgo-management-system)

# 💡 Ideas & loose notes

> Quick thoughts that don't fit devplan / learning / rules / component.
> Newest at the bottom. Append-only via `/memo`.

<!-- toc -->
**Contents** (4)
- 2026-08-13 — โปรเจกต์ joolz-factory (ผลสำรวจ)
- 2026-08-21 — ต่อ Google Search Console เข้ากับฟลีต 49 เว็บ
- 2026-11-03 — expenses follow-ups (offered, not asked for)
- 2026-11-04 — other-bank SCB transfer file (owner: later)
<!-- /toc -->

---

## 2026-08-13 — โปรเจกต์ joolz-factory (ผลสำรวจ)

- ที่อยู่: `~/joolzjuice` · repo `kwamkid/joolz-factory` · deploy https://joolz-factory.vercel.app
- Supabase แยกโปรเจกต์ (`kaidsjjzzbquojcdsjbt`) · login แยก (email/LINE)
- โมดูลที่มีจริง: ออเดอร์+packing list · ลูกค้า/CRM (ตามงาน+ตามหนี้) · สินค้า (บาร์โค้ด/variation/ราคาเฉพาะลูกค้า) · บิล+Beam payment · LINE chat · รายงานขาย/ค้างส่ง
- โมดูลผลิต FIFO **ถูกถอดทิ้งแล้ว** ก.พ. 69 (migration cleanup_production) — ภาระกรอกสต็อกทำระบบตาย → เป็นที่มาของการสร้างระบบผลิตแบบไม่มีสต็อกใน AMGO แทน
- เจ้าของเลือก: ยังไม่ย้าย joolz เข้า AMGO ทั้งระบบ — ทำเฉพาะระบบผลิตใหม่ใน AMGO
- [ ] ⚠️ **`DEPLOYMENT.md` ใน repo joolz มี Supabase service role key แปะตรง ๆ** — ถ้า repo เป็น public/เคยแชร์ ควร rotate key (แจ้งเจ้าของแล้ว 13 ส.ค. ยังไม่ได้ตัดสินใจ)

## 2026-08-21 — ต่อ Google Search Console เข้ากับฟลีต 49 เว็บ

เจ้าของถามถึง 21 ส.ค. แล้วบอกว่ายังไม่ต้องทำ — จดไว้กันลืม

ที่คุ้มที่สุดคือ **Security Issues API** (Google ติดธงเว็บที่โดนแฮ็ก) เพราะมองจากมุมที่ตัวสแกนไฟล์ของเราไม่เห็น — เราดูไฟล์บนโฮสต์ Google ดูสิ่งที่ผู้ใช้เจอตอนค้น · ตอนไล่มัลแวร์ 13 เว็บกลางเดือน ถ้ามีตัวนี้จะรู้เร็วกว่า

ของแถม: หน้าที่หลุด index · คำค้น/คลิก/อันดับรายเว็บ · Core Web Vitals ของผู้ใช้จริง

**จุดที่ทำให้เป็นไปได้:** ขั้นที่ยากที่สุดของงานนี้คือยืนยันความเป็นเจ้าของ 49 โดเมน — แต่เรามี SSH ทุกเว็บอยู่แล้ว วางไฟล์ยืนยันของ Google ได้อัตโนมัติทั้งฟลีต แล้วให้ service account ยืนยันตัวเองผ่าน Site Verification API · ที่เหลือใส่เป็นชนิดงานใหม่ในคิว `web_jobs` ได้เลย

ต้องขอจากเจ้าของก่อน: Google Cloud project + service account (เปิด Search Console API)

## 2026-11-03 — expenses follow-ups (offered, not asked for)
- Category tile order by real usage in amgo (re-rank `SECTION_BY_POPULARITY` from approved claims) instead of the fixed historical order.
- Payroll page "ไฟล์โอนธนาคาร" could reuse the SCB CPX builder (`lib/services/bankTransferFile.ts`).
- Name the export `scb_bulk_transfer_<CODE>_<stamp>.txt` instead of the toolkit's `SCB_file_reference_<stamp>.txt` (unknown if SCB checks the name).

## 2026-11-04 — other-bank SCB transfer file (owner: later)
- Non-SCB payees (KBANK staff พี่โด้ · วัน · วินโก, non-SCB suppliers) need SCB's other-bank toolkit `CPX_Toolkit_Template-08.69.xls` (ORFT/SMART). Owner resends the template when wanted; build like the SCB one (olevba → emulate → diff), see project/knowledge/learning/general.md 2026-11-03.

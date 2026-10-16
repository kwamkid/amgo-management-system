-- กุญแจ API เพิ่มคำเป้าหมายได้ (เจ้าของขอ 17 ต.ค. 69) — ต้องติ๊กอนุญาตทีละใบ · ค่าเริ่มต้นอ่านอย่างเดียว
-- เพิ่มคำ = เสียเงินเช็คอันดับ (DataForSEO) ทุกสัปดาห์ จึงไม่เปิดให้ทุกกุญแจ
alter table public.seo_api_keys add column can_write boolean not null default false;

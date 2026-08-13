-- สูตรแบบวัด Brix ก่อนผสม + ขั้นตอนการทำ
--
-- workflow จริงของ ADF (เจ้าของเล่า 13 ส.ค. 69): คั้นน้ำ → วัด Brix →
-- คำนวณน้ำเปล่า/น้ำเชื่อม/เกลือให้ได้ความหวานเป้าหมาย → ผสม → เทใส่ขวด
-- บางสูตรมีขั้นตอนเฉพาะ (ต้มเก๊กฮวย ฯลฯ) เก็บเป็นข้อความ fix ต่อสูตร
--
-- สูตรเดิมแบบ "ต่อ 1 ลิตร" ยังอยู่ (recipe_type = fixed) — สูตร brix ใช้
-- production_recipe_items เดิมเป็น "ของที่เติมต่อลิตรน้ำสุดท้าย" (เช่น เกลือ)

alter table public.production_recipes
  add column recipe_type text not null default 'fixed'
    check (recipe_type in ('fixed', 'brix')),
  add column target_brix numeric,          -- เป้าความหวานของน้ำขาย (สูตร brix)
  add column syrup_brix numeric not null default 65,  -- ความหวานน้ำเชื่อมที่ใช้เติม
  add column steps text not null default '';          -- ขั้นตอนการทำ (ข้อความ fix)

-- ค่าที่วัดตอนผสม — เก็บไว้ดูย้อนหลังว่าวันนั้นวัดได้เท่าไหร่
alter table public.production_batches
  add column juice_liters numeric,   -- น้ำคั้นที่ได้ (ลิตร)
  add column juice_brix numeric;     -- Brix ที่วัดได้

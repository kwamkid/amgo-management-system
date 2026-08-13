-- รูปประจำสูตร (emoji) — พนักงานฝ่ายผลิตเป็นคนพม่า อ่านไทยไม่ออก
-- เจ้าของสั่ง 14 ส.ค. 69: UI ต้องเน้นดูรูปแล้วสอนเอา
alter table public.production_recipes
  add column image text not null default '';

update public.production_recipes set image = '🍊' where name like '%ส้ม%';

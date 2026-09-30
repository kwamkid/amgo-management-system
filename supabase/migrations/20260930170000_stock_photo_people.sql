-- ตัวเลือกคนในรายงานรูปสต็อก: คนที่ต้องถ่าย + คนที่เคยถ่าย พร้อมชื่อปัจจุบัน
-- เดิมดึงแถว stock_photos 2,000 แถวมาหาคนในเบราว์เซอร์ แล้วดึงชื่ออีกรอบ (30 ก.ย. 69)
-- security invoker: เห็นเท่าที่ RLS ของ users/stock_photos ให้เห็น
create or replace function public.stock_photo_people()
returns table(id uuid, name text)
language sql
stable
security invoker
set search_path to ''
as $$
  select u.id, coalesce(u.display_name, u.full_name) as name
  from public.users u
  where (u.requires_stock_photos and u.is_active)
     or exists (select 1 from public.stock_photos s where s.user_id = u.id)
  order by 2;
$$;
revoke all on function public.stock_photo_people() from public, anon;
grant execute on function public.stock_photo_people() to authenticated;

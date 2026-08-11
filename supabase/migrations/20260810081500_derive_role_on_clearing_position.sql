-- ตำแหน่ง=สิทธิ์ ต้องจริงทั้งขาไปและขากลับ
--
-- ของเดิมคำนวณ role เฉพาะตอน "ตั้ง" ตำแหน่ง — พอ "ล้าง" ตำแหน่งออก
-- role เดิมค้างอยู่ เจอมาแล้ววันนี้: ทดสอบตั้งตำแหน่งแอดมินแล้ว revert
-- ตำแหน่งคืน แต่พนักงาน 5 คนติด role admin ค้าง
create or replace function public.trg_role_from_function()
returns trigger
language plpgsql
set search_path to ''
as $$
declare r text;
begin
  if tg_op = 'INSERT' or new.job_function_id is distinct from old.job_function_id then
    if new.job_function_id is not null then
      -- เปลี่ยนตำแหน่งเมื่อไหร่ สิทธิ์ตามตำแหน่งใหม่ทันที
      select jf.default_role into r
        from public.job_functions jf where jf.id = new.job_function_id;
      if r is not null then new.role := r; end if;
    elsif tg_op = 'UPDATE' then
      -- ล้างตำแหน่งออก = ไม่เหลือสิทธิ์ตามตำแหน่ง → กลับเป็นพนักงานธรรมดา
      new.role := 'employee';
    end if;
  end if;
  return new;
end;
$$;

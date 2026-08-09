-- ═══════════════════════════════════════════════════════════════════════
-- 0007 — ปิดช่องโหว่ที่ Supabase advisor เตือน
--
-- function_search_path_mutable: function ที่ไม่ล็อก search_path เปิดช่องให้
-- คนที่สร้าง schema ปลอมชื่อซ้ำมาแซง resolution ได้
-- ═══════════════════════════════════════════════════════════════════════

create or replace function set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

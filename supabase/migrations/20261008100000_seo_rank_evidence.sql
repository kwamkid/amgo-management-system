-- หลักฐานเพิ่มต่อรอบเช็คอันดับ (เจ้าของถาม 8 ต.ค. 69: "ยังไม่ติด" มีอะไรพิสูจน์)
--
-- organic_seen: Google ส่งผลลิงก์ปกติมาให้ดูกี่อันดับจริง — ไม่ใช่ 100 เสมอ (เจอจริง 13–68)
--   "ไม่ติด" จึงแปลว่า "ไม่อยู่ใน N ผลที่ Google ให้ดู" ไม่ใช่ "ไม่ติด 100"
-- features: เราไปโผล่ในส่วนอื่นของหน้า [{type, rank}] เช่น กล่องรูป (images) · แผนที่ (local_pack)
--   GSC นับตำแหน่งพวกนี้เป็นอันดับด้วย — อธิบายเคส GSC บอกอันดับ ~8 แต่ลิงก์ปกติไม่เจอ
--   (ของจริง: "ของเยี่ยมคนคลอดลูก" โผล่ในกล่องรูป ตำแหน่ง 8)

alter table public.seo_rank_snapshots
  add column organic_seen int,
  add column features jsonb;

create or replace function public.seo_merge_rank_sample(
  p_keyword uuid,
  p_checked_on date,
  p_device text,
  p_position int,
  p_ranked_url text,
  p_has_aio boolean,
  p_aio_cites boolean,
  p_aio_refs jsonb,
  p_top jsonb,
  p_organic_seen int default null,
  p_features jsonb default null
) returns boolean
language sql
set search_path = public
as $$
  insert into public.seo_rank_snapshots as s (
    keyword_id, checked_on, device, position, ranked_url, has_ai_overview,
    ai_overview_cites_us, ai_overview_refs, top_competitors, samples, hits, organic_seen, features
  ) values (
    p_keyword, p_checked_on, p_device, p_position, p_ranked_url, p_has_aio,
    p_aio_cites, p_aio_refs, p_top, 1, case when p_position is null then 0 else 1 end,
    p_organic_seen, nullif(p_features, '[]'::jsonb)
  )
  on conflict (keyword_id, checked_on, device) do update set
    position = case
      when excluded.position is not null and (s.position is null or excluded.position < s.position) then excluded.position
      else s.position end,
    ranked_url = case
      when excluded.position is not null and (s.position is null or excluded.position < s.position) then excluded.ranked_url
      else s.ranked_url end,
    ai_overview_refs = case
      when s.top_competitors is null
        or (excluded.position is not null and (s.position is null or excluded.position < s.position)) then excluded.ai_overview_refs
      else s.ai_overview_refs end,
    top_competitors = case
      when s.top_competitors is null
        or (excluded.position is not null and (s.position is null or excluded.position < s.position)) then excluded.top_competitors
      else s.top_competitors end,
    has_ai_overview = s.has_ai_overview or excluded.has_ai_overview,
    ai_overview_cites_us = s.ai_overview_cites_us or excluded.ai_overview_cites_us,
    samples = s.samples + 1,
    hits = s.hits + excluded.hits,
    organic_seen = greatest(s.organic_seen, excluded.organic_seen),
    features = case
      when excluded.features is null then s.features
      when s.features is null then excluded.features
      else s.features || excluded.features end
  returning (xmax = 0)
$$;

drop function if exists public.seo_merge_rank_sample(uuid, date, text, int, text, boolean, boolean, jsonb, jsonb);
revoke execute on function public.seo_merge_rank_sample(uuid, date, text, int, text, boolean, boolean, jsonb, jsonb, int, jsonb) from public, anon, authenticated;
grant execute on function public.seo_merge_rank_sample(uuid, date, text, int, text, boolean, boolean, jsonb, jsonb, int, jsonb) to service_role;

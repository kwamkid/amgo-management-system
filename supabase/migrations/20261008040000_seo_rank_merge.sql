-- รวมผลอันดับทีละตัวอย่างแบบ atomic
--
-- คำหนึ่งค้นหลายครั้งต่อรอบ (rank_samples) และตอนนี้ DataForSEO เรียกกลับมาเอง (pingback)
-- ทีละงาน — ผลของคำเดียวกันมาพร้อมกันได้ ถ้าอ่านแถวเดิมแล้วเขียนทับในโค้ด ตัวอย่างจะหายเพราะชนกัน
-- ฟังก์ชันนี้รวมในคำสั่งเดียว (on conflict do update ล็อกแถวให้) · คืน true = เป็นตัวอย่างแรกของวันนั้น
--
-- กติการวม: อันดับ = ดีสุดที่เจอ (หน้า/คู่แข่ง/ที่มาของ AI ตามตัวอย่างที่ดีสุด)
--           AI Overview / อ้างเรา = เจอในตัวอย่างไหนก็นับ · samples/hits นับสะสม

create or replace function public.seo_merge_rank_sample(
  p_keyword uuid,
  p_checked_on date,
  p_device text,
  p_position int,
  p_ranked_url text,
  p_has_aio boolean,
  p_aio_cites boolean,
  p_aio_refs jsonb,
  p_top jsonb
) returns boolean
language sql
set search_path = public
as $$
  insert into public.seo_rank_snapshots as s (
    keyword_id, checked_on, device, position, ranked_url, has_ai_overview,
    ai_overview_cites_us, ai_overview_refs, top_competitors, samples, hits
  ) values (
    p_keyword, p_checked_on, p_device, p_position, p_ranked_url, p_has_aio,
    p_aio_cites, p_aio_refs, p_top, 1, case when p_position is null then 0 else 1 end
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
    hits = s.hits + excluded.hits
  returning (xmax = 0)
$$;

-- เรียกได้เฉพาะเซิร์ฟเวอร์ (service role)
revoke execute on function public.seo_merge_rank_sample(uuid, date, text, int, text, boolean, boolean, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.seo_merge_rank_sample(uuid, date, text, int, text, boolean, boolean, jsonb, jsonb) to service_role;

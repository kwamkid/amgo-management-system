-- Day-by-day options for picking a compensatory day off (schedule swap).
--
-- The swap prompt used to show an unrestricted calendar: staff guessed a date,
-- got rejected one rule at a time, and some picked a day they actually worked
-- just to close the (mandatory) prompt. This returns, for the caller only,
-- every day in a range with what the picker needs to grey out invalid days.
--
-- security invoker + auth.uid(): a user can only ask about their own schedule.

create or replace function public.swap_day_options(p_from date, p_to date)
returns table (day date, work_mode text, worked boolean, taken boolean)
language sql
stable
set search_path to ''
as $$
  select d::date,
         public.expected_work_mode(auth.uid(), d::date),
         exists (select 1 from public.checkins c
                  where c.user_id = auth.uid() and c.work_date = d::date),
         exists (select 1 from public.schedule_swaps s
                  where s.user_id = auth.uid()
                    and s.status in ('pending', 'approved')
                    and (s.off_date = d::date or s.worked_date = d::date))
  from generate_series(p_from, least(p_to, p_from + 62), interval '1 day') d
$$;

revoke all on function public.swap_day_options(date, date) from public, anon;
grant execute on function public.swap_day_options(date, date) to authenticated;

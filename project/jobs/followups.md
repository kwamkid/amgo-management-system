# Follow-ups on a date

> Never block closing a topic. `/todo` lists the ones due. Format: `- [ ] YYYY-MM-DD · <topic> · <check> → <action>`

<!-- toc -->
<!-- /toc -->

---


- [ ] 2026-11-20 · ui-check · once /brief has a daily brief row, run `/ui-check /brief` (only the empty state was measured) → fix any overflow
- [ ] 2026-12-01 · voice-tasks · after the next real meeting clip, compare the /tasks/voice credit bar drop with the clip's "ใช้ ~N เครดิต" → if off by >30%, re-measure and change SCRIBE_CREDITS_PER_HOUR in lib/voice/format.ts
- [ ] 2026-11-21 · cron · read `cron_runs` (REST, service key): auto-checkout, web-nightly, cleanup-photos, seo-daily, task-reminders, web-expiry, birthday, payroll-cutoff all ok=true for 2026-11-20/21 → tell owner to DELETE the 10 disabled cron-job.org jobs; any failure → fix, re-enable the matching old job meanwhile
- [ ] 2026-11-20 · tasks-edith · after 14:00/17:30 TH read VPS /root/hermes-credits/edith-chase.log + Edith DMs: chase sent to staff, summary reached แอม, a "#57 เสร็จ" reply got PATCHed → fix SOUL/script on failure
- [ ] 2026-11-30 · jadore-launch · check whether Alina sent launch photos (H19) and test reports (H20) → add to jadore-marketing.html (img/ + ผลทดสอบ block) and tick they-owe; nothing → remind owner to chase Alina
- [ ] 2026-11-24 · cron-monitor · open https://app.amgovenger.com/settings/system: every job green after its first slot (late rules in lib/monitor/health.ts lastDueStart) → fix false 'late'/'failing'
- [x] 2026-11-24 · marketing-plan · (done 2026-11-27: aoosocial rows 22–25 Nov ×36 accounts, fetched 06:00 TH for yesterday; amgo marketing_metric_daily followers/reach/views for all 7 brands; KPI tab reads it. J'adore = 0 is real — IG 0 followers/0 posts) after 06:30 read aoosocial account_insights_daily (rows for 2026-11-23) + amgo marketing_metric_daily source=aoosocial metric followers/reach/views → KPI tab shows them; none → check aoosocial cron_job_runs sync-account-insights
- [ ] 2026-11-24 · marketing-plan · J'adore sales KPI still '—' → check aoo has J'adore sales since 22 Nov (sales_summary brand J'adore); none = launch not selling yet, fine
- [ ] 2026-11-30 · cron-monitor · no cron-job.org failure mails all week → tell owner to delete the Inactive old jobs (AMGO + AooSocial folders; all 11 AooSocial ones are in its tick schedule)
- [ ] 2026-11-27 · abc-year-end · sponsor replies due (prize tiers taken per supplier) → fill prize list on sponsor page; gaps → tell owner which tiers still need a sponsor

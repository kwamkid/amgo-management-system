<!-- toc -->
**Contents** (2)
- 🤖 Hermes bots (Jarvis · Friday · Edith) — 2026-10-31
- Resume note
<!-- /toc -->

## 🤖 Hermes bots (Jarvis · Friday · Edith) — 2026-10-31
- [ ] SEO/AEO accuracy: owner says amgo ranks don't match the adayfresh website project — ask what to compare against, then compare; SEO stays out of the morning brief until trusted.
- [ ] First real leave decision via web (https://app.amgovenger.com/leaves/management) by หน่อย/กอล์ฟ — verify the row in `leave_requests` after it happens (ฟรองค์ e6bcc8ed was pending on 31 Oct).
- [ ] AGD backlog in /Users/ampstark/Dropbox/99.1-CoWork-Project/01-AGD/memo/todo.md "Hermes bots": brand kits Stokke/GB/Tommee Tippee · Friday aoo brand API (cost-stripped) · Higgsfield key · aoo-side `sales_summary compare`, `stock max_qty/cost_value` · abcthebaby.com tracked SEO keywords.

## Resume note
Resume at: SEO/AEO accuracy — ask the owner what to compare amgo ranks against (adayfresh website project), then compare.

### State
- All bots on Anthropic direct (Haiku, Sonnet via delegate_task). Morning brief cron 04:00 TH, Edith task DMs + Friday leave-count DM 08:30 TH. Leave approvals = web page link, no buttons (Amgo Approvals app deleted, `amgo-approvals` service disabled).

### Gotchas
- `hermes insights` ignores `-p`; read state.db directly on the host. Config via `hermes -p <bot> config set`; SOUL/config change needs `hermes gateway restart`.
- Secrets: clipboard → `/root/.<name>_key` (600) → profile `.env`; never echo.

### Read first
- /Users/ampstark/Dropbox/99.1-CoWork-Project/01-AGD/.claude/rules/domains/hermes-bots.md · VPS scripts /root/morning_brief.py, /root/edith_reminders.py, /root/credit_report.py

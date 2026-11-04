<!-- toc -->
**Contents** (2)
- 💸 Expenses — reimburse + supplier + SCB file — 2026-11-03, commits 7c50694 bf6d206
- Resume note
<!-- /toc -->

## 💸 Expenses — reimburse + supplier + SCB file — 2026-11-03, commits 7c50694 bf6d206
- [x] Built + pushed 7c50694 bf6d206 (migrations 20261103120000 / 140000 / 160000 run by owner). Rules: .claude/rules/domains/expenses.md. UAT-0109…0117 on the board.
- [x] (owner 4 Nov: later — moved to project/jobs/ideas.md) Other-bank transfer file (ORFT/SMART) for non-SCB payees: owner must resend `CPX_Toolkit_Template-08.69.xls` (deleted after the SCB one was built; read its VBA like the SCB one). Until then KBANK staff พี่โด้ · วัน · วินโก and non-SCB suppliers are skipped by the export.
- [x] (owner 4 Nov: not amgo — belongs in aoo) 3% withholding tax on supplier payments (transfer amount ≠ invoice) — toolkit has WHT/Invoice sheets.
- [x] (owner 4 Nov: no SMS/email — Discord @mention on paid/rejected instead, built, uncommitted) SMS/email payment advice in the SCB file like the template (needs supplier email/phone columns + migration; field positions noted in bankTransferFile.ts).
- [ ] Commit + push Discord expense notifications (app/api/expenses/notify, settings expense channel, expenseService notifyResult).
- [ ] HR/owner: fix โฟน (อดิศักดิ์ ทองปรอน)'s SCB account in his profile — only 9 digits, export will skip him.
- [x] Pushed a925175 (4 Nov work): form controls 40px default (SelectMenu default md + font in DatePicker/DateRangePicker/TimePicker, bulk-edit toolbar sm) · stored export files + "ไฟล์ที่ส่งออกแล้ว" re-download · export modal notice.

## Resume note
Resume at: owner decision on SMS/email payment advice in the SCB file (other-bank template postponed, WHT out of scope — both owner 4 Nov).

### State
All code pushed (bf6d206). Only `supabase/.temp/cli-latest` modified (CLI file, never commit). Typecheck clean, scripts/test-expense-rules.mjs 78/78. UAT-0109…0117 waiting for testers.

### Gotchas
- Supabase MCP `supabase-amgo` and CLI had no DB access this session — owner runs migrations himself; verify columns with REST + SUPABASE_SECRET_KEY (curl, key via stdin).
- Owner's `next dev` serves stale globals.css for a while — check the stylesheet before judging CSS.
- For a new toolkit: copy .xls to scratchpad, venv + oletools, `olevba --decode -c`, emulate Export on the template's sample rows, diff field by field (see project/knowledge/learning/general.md 2026-11-03).
- Push with plain `git push origin main` (allow rule is `Bash(git push:*)`; pipes / `git -C` get blocked).

### Read first
- .claude/rules/domains/expenses.md
- lib/services/bankTransferFile.ts (SCB format + check digit) · lib/services/expenseExport.ts
- app/(admin)/expenses/manage/page.tsx

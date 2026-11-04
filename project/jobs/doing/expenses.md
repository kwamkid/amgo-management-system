<!-- toc -->
**Contents** (2)
- 💸 Expenses — reimburse + supplier + SCB file — 2026-11-03, commits 7c50694 bf6d206
- Resume note
<!-- /toc -->

## 💸 Expenses — reimburse + supplier + SCB file — 2026-11-03, commits 7c50694 bf6d206
- [x] Built + pushed 7c50694 bf6d206 (migrations 20261103120000 / 140000 / 160000 run by owner). Rules: .claude/rules/domains/expenses.md. UAT-0109…0117 on the board.
- [x] (owner 4 Nov: later — moved to project/jobs/ideas.md) Other-bank transfer file (ORFT/SMART) for non-SCB payees: owner must resend `CPX_Toolkit_Template-08.69.xls` (deleted after the SCB one was built; read its VBA like the SCB one). Until then KBANK staff พี่โด้ · วัน · วินโก and non-SCB suppliers are skipped by the export.
- [x] (owner 4 Nov: not amgo — belongs in aoo) 3% withholding tax on supplier payments (transfer amount ≠ invoice) — toolkit has WHT/Invoice sheets.
- [x] (owner 4 Nov: no SMS/email — Discord @mention on paid/rejected instead, pushed 799a8b8) SMS/email payment advice in the SCB file like the template (needs supplier email/phone columns + migration; field positions noted in bankTransferFile.ts).
- [x] Pushed 799a8b8: Discord expense notifications (app/api/expenses/notify, settings expense channel, expenseService notifyResult).
- [ ] รอคุณแอม: fix โฟน (อดิศักดิ์ ทองปรอน)'s SCB account in his profile — only 9 digits, export will skip him.
- [x] Pushed a925175 (4 Nov work, UAT-0142): form controls 40px default (SelectMenu default md + font in DatePicker/DateRangePicker/TimePicker, bulk-edit toolbar sm) · stored export files + "ไฟล์ที่ส่งออกแล้ว" re-download · export modal notice.

## Resume note
Resume at: nothing to build — only waits on the owner fixing โฟน's SCB account (9 digits) in his profile. Other-bank file postponed (jobs/ideas.md), WHT is aoo's, payee SMS/email replaced by Discord (799a8b8).

### State
All code pushed (799a8b8). Typecheck clean, scripts/test-expense-rules.mjs 78/78. UAT-0109…0117 + UAT-0142 waiting for testers.

### Gotchas
- Owner's `next dev` serves stale globals.css for a while — check the stylesheet before judging CSS.
- New bank toolkit: venv + oletools, `olevba --decode -c`, emulate Export on the template rows, diff field by field (knowledge/learning/general.md 2026-11-03).
- Push with plain `git push origin main`.

### Read first
- .claude/rules/domains/expenses.md · lib/services/bankTransferFile.ts · app/(admin)/expenses/manage/page.tsx

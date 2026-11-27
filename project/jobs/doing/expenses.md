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

- [x] 27 Nov: ORFT (other-bank) file built — `RFT` product, mixed export = 2 files; tests 83/83; pushed 27 Nov. Follow-ups pushed 27 Nov: a29d525 (product auto 3PT/RFT, no dropdown) · d812c18 (bank remark = who claimed what) · 261d427 (company debit account dropdown, migration 20261127100000 run by owner). · 304f7da (bank logo + code everywhere) · 361c86b (จ่ายให้ column, bulk reject, PDF preview, full-row hover). · 1350f0a (two-level category: account code + stats sub-category, migration 20261127120000 run by owner). · 27 Nov UI round pushed a14616c..1b56cc0: tab names รอตรวจสอบ / รอเจ๊อนุมัติจ่าย, finance edits amount+company until paid, category = borderless equal icon-tile grid + highlighted description box, auto VAT recompute. · 4d8dd7e..54c57d4: VAT = มี/ไม่มี on the description row, sub-category chips, no side-stripe box. · a5c18ed: BCHDET memo. First real RFT upload accepted by SCB 27 Nov (1 valid, 0 removed). UAT-0353 0354 0355 (+ UAT-0115 rewritten for the new month-end report).
- [ ] Next: export for the Express accounting program — waiting for owner: Express version + screenshot of the screen accounting uses to key staff expenses (no built-in Excel import; options = summary for manual keying, or XpressPlus middleware).

## Resume note
Resume at: Express export — waiting for the owner to send the Express version + a screenshot of the screen accounting uses to key staff expenses; then build a month-end file shaped for that screen (manual keying) or for XpressPlus.
### State
All code pushed (02bfe0b). Typecheck clean, scripts/test-expense-rules.mjs 123/123. Migrations 20261127100000 + 20261127120000 run by owner.
### Gotchas
- Owner's `next dev` serves stale globals.css for a while — Cmd+Shift+R before judging CSS.
- Copy SQL with Thai via `LANG=en_US.UTF-8 pbcopy` (plain pbcopy garbled labels in the DB once).
- Owner UI taste: icon tiles (bare grid, no side scroll), separate square chips, no one-sided border callouts.
- Never commit real payee accounts from accounting's toolkit files in tests.
### Read first
- .claude/rules/domains/expenses.md · lib/services/expenseRules.ts · lib/services/expenseExport.ts

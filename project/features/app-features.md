# App features — what the app can do

> By module: what it does · what it uses · limits · package · since. Customer wording, English. Not drafted yet.

<!-- toc -->
**Contents** (1)
- Expenses (เบิกค่าใช้จ่าย) — since 2026-11-03
<!-- /toc -->

---

## Expenses (เบิกค่าใช้จ่าย) — since 2026-11-03
- **What it does:** staff claim money they paid themselves, or ask the company to pay a supplier directly (bill/invoice attached). Pick the company first, pick the accounting category as icon tiles (auto-suggested from the description), attach up to 10 photos/PDFs. Finance approves once, exports one SCB bulk-transfer file per company, the owner approves the transfer in the SCB app, finance attaches the slip and marks it paid. Staff see each stage on their claim and get a Discord @mention when paid or rejected.
- **For finance:** stage tabs with counts (awaiting approval · awaiting bank file · awaiting transfer · paid this month), filters (search · person · company · category), detail view with large receipt gallery, edit category/details/files before paying, bulk approve, re-download any exported bank file, month-end Excel in the company's EXPENSES REIMBURSEMENT form.
- **Uses:** SCB Business Anywhere upload file (CPX Toolkit format) · Discord webhook · Supabase storage for receipts/slips/files.
- **Limits:** the bank file pays SCB accounts only (other banks are skipped and listed); no withholding tax (handled in aoo); no SMS/email to payees.

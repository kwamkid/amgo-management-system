# App features — what the app can do

> By module: what it does · what it uses · limits · package · since. Customer wording, English. Not drafted yet.

<!-- toc -->
**Contents** (2)
- Expenses (เบิกค่าใช้จ่าย) — since 2026-11-03
- Home screen quick actions — since 2026-11-05
<!-- /toc -->

---

## Expenses (เบิกค่าใช้จ่าย) — since 2026-11-03
- **What it does:** staff claim money they paid themselves, or ask the company to pay a supplier directly (bill/invoice attached). Pick the company first, pick the accounting category as icon tiles (auto-suggested from the description), attach up to 10 photos/PDFs. Finance approves once, exports one SCB bulk-transfer file per company, the owner approves the transfer in the SCB app, finance attaches the slip and marks it paid. Staff see each stage on their claim and get a Discord @mention when paid or rejected.
- **For finance:** stage tabs with counts (awaiting approval · awaiting bank file · awaiting transfer · paid this month), filters (search · person · company · category), detail view with large receipt gallery, edit category/details/files before paying, bulk approve, re-download any exported bank file, month-end Excel in the company's EXPENSES REIMBURSEMENT form.
- **Uses:** SCB Business Anywhere upload file (CPX Toolkit format) · Discord webhook · Supabase storage for receipts/slips/files.
- **Limits:** the bank file pays SCB accounts only (other banks are skipped and listed); no withholding tax (handled in aoo); no SMS/email to payees.

## Home screen quick actions — since 2026-11-05
- **What it does:** the first screen gives staff two big cards for what they do most: check in/out (shows whether they are in, since when, or done for the day) and expenses (shows money waiting to come back). Leave and everything else stay in the menu.
- **Limits:** staff who don't need to check in see only the expense card. If not checked in, the first open of the day still goes straight to the check-in page.


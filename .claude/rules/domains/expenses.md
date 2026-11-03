---
paths:
  - "app/(admin)/expenses/**"
  - "lib/services/expense*.ts"
  - "lib/services/bankTransferFile.ts"
  - "components/expenses/**"
---

# Expenses — reimburse + supplier payments (owner, 3 Nov 2026)

- Two kinds in one table `expense_claims.kind`: `reimburse` (staff paid first, attach receipt/own transfer slip) · `supplier` (company transfers to the supplier, attach bill/invoice — mandatory, no "no receipt" option, always `payout='transfer'`, payee bank fields required; DB constraint `expense_claims_supplier_fields`). Same approval chain: manager → finance.
- Finance flow on /expenses/manage "รอโอน": tick claims → export SCB transfer file (sets `exported_at` so the same claims aren't exported/paid twice; "ล้างตราส่งออก" clears it) → upload to SCB → "บันทึกจ่ายแล้ว" for the batch with ONE slip (copied into each owner's folder `<userId>/slips/` so staff can see it under the storage policy).
- **SCB file = CPX Toolkit 1.1.2 upload .txt** (owner's template `file_template/CPX_Toolkit_Template-SCB.08.69.xls`; format reverse-engineered from its VBA, see header of `lib/services/bankTransferFile.ts`): UTF-8 no BOM, `|`-separated, CRLF, HEADER/BCHDET/TXNDET×n/TRAILR, TXNDET = 28 fields, branch `0111`, fee `BEN`, product `OAT` (template default; `3PT` selectable). SCB destinations only + SCB check digit (`isScbAccount`); other banks are reported as skipped — the other-bank template `CPX_Toolkit_Template-08.69.xls` (ORFT/SMART) is not built yet. Names/remarks stripped of the toolkit's forbidden chars (`scbText`). One file per company; debit account stored in `companies.scb_debit_account`, set by finance through `set_company_scb_debit_account()` (migration 20261103140000). Golden-file test in scripts/test-expense-rules.mjs. `file_template/` holds real account numbers/emails — never commit it.
- Month-end report (button "สรุปสิ้นเดือน") reproduces accounting's Excel form "EXPENSES REIMBURSEMENT" (original: ~/Downloads/Reimbursement.xlsx, one sheet per claim): summary sheet + one sheet per person + supplier sheet. Month = `expense_date`; statuses approved+paid. Category → form section via `formSectionOf()` (travel=Taxi, parking=Expressway/Parking, fuel=Gasoline, meal=Entertainment, phone=Telephone, rest = Others, or Others VAT 7% when `vat_amount>0`). The original template's Total Transport only summed Gasoline and reused the Entertainment label for Telephone — ours sums all three and labels correctly.
- `vat_amount` is VAT included in `amount` (UI toggle computes 7/107). Company filter: `company_id` null = owner's home company (resolved in `toNamedClaim`).
- **Category = accounting form section** (owner 3 Nov): staff pick one of the 7 Excel sections (`SECTION_LABEL`; stored as `category` + `vat_amount`, mapping `SECTION_CATEGORY`; `other_vat` ⇔ vat>0, VAT auto 7/107). Not sure → typing the description auto-picks via `suggestSection()`: own approved/paid claims with similar text (bigram ≥0.6) win, else keyword rules `guessSection()` built from the 1,218 historical rows of Reimbursement.xlsx (90% accurate; rule order matters — fuel before "ขนของ", shipping/Lalamove = Others). Remaining misses are rows that only name a place/person, or where accounting itself was inconsistent (cakes, Lalamove).
- Finance edits section/details before approving or paying via `ClaimEditModal` → `updateClaimDetails()` (amount only while pending_finance; changing payee/amount clears `exported_at`).
- After a successful SCB export the "mark paid" dialog opens straight away for that batch — no month-end wait.


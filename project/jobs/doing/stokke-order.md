<!-- toc -->
**Contents** (2)
- 📦 Stokke order STK #5 + import brand-owner rights — 2026-11-11, commits 4613b0f 2920944
- Resume note
<!-- /toc -->

## 📦 Stokke order STK #5 + import brand-owner rights — 2026-11-11, commits 4613b0f 2920944
- [x] STK #5 draft round built from legacy dump + aoo live and pushed to amgo /import as `STK5-stokke` (16 lines · 116 pcs · ≈ €7.2k). Method + data notes: AGD `04-stokke/_notes/2-order/ordering.md`; row in `04-stokke/_notes/2-order/orders.md`.
- [x] SRP editors = brand owners: edit qty + see cost on their brand's rounds (4613b0f, migration 20261111090000 run by owner, pushed 2920944). Owners: แป้งหมี่ Stokke · เฟื่อง GB · ยุ้ย Tommee Tippee · ออย Taf Toys.
- [x] 2026-11-17 owner gave own STK #5 plan (793 pcs, ~€38.0k) → written into round `STK5-stokke` as qty (suggested = Claude's 10 Nov numbers); stock re-pulled = main warehouse `คลังหลัก RAMA2` available only (old numbers summed all warehouses incl. consignment/stores, e.g. Serene Pink showed 12, real −2); 9 new lines added (650002 690012 591304 688501 720703 717501 727001 724401 653210).
- [ ] รอคุณแอม: STK #5 plan gaps — Sleepi Dresser Natural 583702 ×1 ordered without box 2/2 583802 (Stokke says order both); seat pack Bonpoint 714801 ×10 has no total in owner's sheet; ordered with >6 mo of main stock: Bumper Bar 705701 (134 in stock, 9.9/mo), Seat Pack Black/Forest/Berry; selling and out of stock but not ordered: Fjord Blue chair 100138, Classic Cushion Wheat Cream 100380, Newborn Set Grey 526101, Flexi Bath Newborn Support 542800, Sleepi Bed (591401 → 711501/711502).
- [ ] รอคุณแอม/Stokke: YOYO3 6+ colour packs (646404/646413/646411) not shipped since #2 — still orderable? do YOYO5 seat packs fit the YOYO3 frame (128 frames in stock)?
- [ ] รอคุณแอม: confirm Sleepi V3 Bed 591401/591402 replaced by 711501/711502 (no wheels) + wheels 709101 → then `node scripts/import-sync.mjs rules push Stokke <file>` with the `replaced` rows (rules export is empty today).
- [ ] After owner approves STK #5: fill Stokke's order form (AGD brand-system §9 step 4). No Stokke price list / order form on file — ask the owner for one; current EUR prices = last invoice, carton qty = old packing lists, fx 38 is a guess.
- [ ] รอคุณแอม: AGD Stokke todo S1 (laser engraving for the 5–8 Nov fair) still open past the fair — done or drop?

## Resume note
Resume at: owner's answers on the 3 STK #5 decisions, then pull (`node scripts/import-sync.mjs pull <json>`) and adjust.
### State
Working files were in this chat's scratchpad (gone after /clear): STK5-stokke.json builder output. Rebuild = legacy dump parse + `node scripts/aoo-live.mjs Stokke`, see AGD ordering.md. Owner edits live in amgo (round `STK5-stokke`).
### Gotchas
Local mysqld is broken (abseil dylib) — stream-parse `~/aoo-legacy-backup/mysql-2026-10-22/aoocommerce_v2-*.sql.gz` instead. Stokke legacy brand_ids 6, 183, 928, 932. Item code = barcode digits 7–12. STK #4 is already received in aoo (incoming 0). Supabase MCP for amgo is unauthorized and CLI gets 403 → owner runs SQL in the dashboard SQL editor.
### Read first
AGD `04-stokke/_notes/2-order/ordering.md` · `orders.md` · `.claude/rules/domains/import.md`

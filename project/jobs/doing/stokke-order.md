<!-- toc -->
**Contents** (2)
- 📦 Stokke order STK #5 + import brand-owner rights — 2026-11-11, commits 4613b0f 2920944
- Resume note
<!-- /toc -->

## 📦 Stokke order STK #5 + import brand-owner rights — 2026-11-11, commits 4613b0f 2920944
- [x] STK #5 draft round built from legacy dump + aoo live and pushed to amgo /import as `STK5-stokke` (16 lines · 116 pcs · ≈ €7.2k). Method + data notes: AGD `04-stokke/_notes/2-order/ordering.md`; row in `04-stokke/_notes/2-order/orders.md`.
- [x] SRP editors = brand owners: edit qty + see cost on their brand's rounds (4613b0f, migration 20261111090000 run by owner, pushed 2920944). Owners: แป้งหมี่ Stokke · เฟื่อง GB · ยุ้ย Tommee Tippee · ออย Taf Toys.
- [x] 2026-11-17 owner gave own STK #5 plan (793 pcs, ~€38.0k) → written into round `STK5-stokke` as qty (suggested = Claude's 10 Nov numbers); stock re-pulled = main warehouse `คลังหลัก RAMA2` available only (old numbers summed all warehouses incl. consignment/stores, e.g. Serene Pink showed 12, real −2); 9 new lines added (650002 690012 591304 688501 720703 717501 727001 724401 653210).
- [x] 2026-11-17 STK #5 plan gaps reported to owner (superseded by the review item below).
- [x] (superseded by the "review STK #5 lines" item) รอคุณแอม: STK #5 plan gaps — Sleepi Dresser Natural 583702 ×1 ordered without box 2/2 583802 (Stokke says order both); seat pack Bonpoint 714801 ×10 has no total in owner's sheet; ordered with >6 mo of main stock: Bumper Bar 705701 (134 in stock, 9.9/mo), Seat Pack Black/Forest/Berry; selling and out of stock but not ordered: Fjord Blue chair 100138, Classic Cushion Wheat Cream 100380, Newborn Set Grey 526101, Flexi Bath Newborn Support 542800, Sleepi Bed (591401 → 711501/711502).
- [x] 2026-11-17 YOYO3 colour packs: Stokke's current order form (owner's sheet) no longer lists 646404/646411/646413 → suggested 0 with ⛔ note.
- [ ] ~~รอคุณแอม/Stokke: YOYO3 6+ colour packs (646404/646413/646411) not shipped since #2 — still orderable? do YOYO5 seat packs fit the YOYO3 frame (128 frames in stock)?~~ — still open only as: do YOYO5 seat packs fit the YOYO3 frame (69 frames in main warehouse)? (ask Stokke)
- [ ] รอคุณแอม: confirm Sleepi V3 Bed 591401/591402 replaced by 711501/711502 (no wheels) + wheels 709101 → then `node scripts/import-sync.mjs rules push Stokke <file>` with the `replaced` rows (rules export is empty today).
- [x] 2026-11-17 order form = the owner's own Stokke sheet (code · FOB EUR · SRP · qty), owner fills it. ~~After owner approves STK #5: fill Stokke's order form (AGD brand-system §9 step 4). No Stokke price list / order form on file — ask the owner for one; current EUR prices = last invoice, carton qty = old packing lists, fx 38 is a guess.~~
- [x] 2026-11-17 suggested column recomputed on main-warehouse stock (638 pcs ≈ €36.6k vs owner 792 pcs ≈ €37.9k); lines missing from Stokke's form or "discon once stock cleared" → 0 with ⛔ note; Sleepi Bed old 591401/591402 sales merged into 711501/711502 (+ wheels 709101). aoo-live main warehouse by default `45e5a85`.
- [x] 2026-11-17 order-plan search: any word order, symbols ignored `9e9fdc2`; smoother scroll (instant header fold) + debounced search `9779471` — pushed.
- [ ] รอคุณแอม: send the final STK #5 ordered list (owner placed the order with Stokke 2026-11-18, will send what was ordered) → set round `STK5-stokke` qty to it + status ordered, update AGD `04-stokke/_notes/2-order/orders.md` row (planned → ordered) + log.md.
- [x] 2026-11-18 owner placed STK #5 with Stokke — review below is moot. ~~review STK #5 lines where own qty ≠ suggested — not ordered: Sleepi Bed 711501/711502 (sugg 14/8), Newborn Set Grey 526101 (22), Sleepi Dresser Natural 583702+583802 (5 each, both boxes); ordered much less: Tripp Trapp Natural 100101 (12 vs 32), Harness² Beige 651301 (12 vs 48); ordered with plenty of stock: Bumper Bar 705701 (50, stock 134), YOYO Backpack 704901 (36, stock 57), Seat Pack Taupe 714602 (20, stock 28). Seat pack Bonpoint 714801 ×10 has no total in owner's sheet (€546).
- [ ] รอคุณแอม: Hape — switch stock to main warehouse too? Hape ordering.md (02-hape/_notes/2-order/ordering.md) says count stock in stores; AGD `package.json` `plan:live` passes `--all-warehouses` until decided. Yes → drop the flag + rewrite that ordering.md line.
- [ ] รอคุณแอม: order-plan table speed refactor (offered, ~half a day): build rows once and show/hide on search/filter, update only the edited row, instead of innerHTML rebuild in `renderRows()` (public/order-plan/index.html).
- [ ] รอคุณแอม: AGD Stokke todo S1 (laser engraving for the 5–8 Nov fair) still open past the fair — done or drop?

## Resume note
Resume at: owner's final STK #5 ordered list (ordered 2026-11-18) → round qty + status + AGD orders.md; then Hape main-warehouse yes/no, table refactor yes/no.
### State
Round `STK5-stokke` in amgo holds owner's qty + recomputed suggested + main-warehouse stock (live edits by owner/แป้งหมี่ happen there — read the round from Supabase before changing it; `import-sync pull` only syncs qty). All code pushed. Scratchpad files gone.
### Gotchas
aoo MCP `stock` with `by_warehouse` may return `barcode: null` → key on barcode‖sku. The 10 Nov suggested numbers had manual overrides (Sleepi replacement, discontinued) — a plain formula re-run must re-apply them (discontinued list = lines missing from Stokke's form). Supabase MCP for amgo unauthorized → use supabase-js with SUPABASE_SECRET_KEY from .env.local in a temp script under scripts/.
### Read first
AGD `04-stokke/_notes/2-order/ordering.md` · `.claude/rules/domains/import.md` · `project/bugs/bugs_fixed.md` 2026-11-17 entry

---
paths:
  - "app/(admin)/import/**"
  - "lib/services/import/**"
  - "app/api/import/**"
---

# Import module (สั่งของนำเข้า) — 29 Oct 2026

- Port of the owner's local order-plan page (`~/Dropbox/99.1-CoWork-Project/01-AGD/00-system/tools/order-plan/index.html` = the spec; port behaviour, not code). Hape C1 PO (31 Oct 2026) stays on the local page.
- Access = `import_access` rows (owner only for now), not role. Flags `can_edit` (qty) · `see_cost` (FOB/cost columns) for later purchasing/sales roles. `my_profile.import_access` → `userData.importAccess`; sidebar key `import`; pages guard with `!!userData.importAccess`. viewAs hides it.
- Tables `import_rounds` (one per plan.json, `slug` = folder name e.g. `C1-hape`, unknown plan keys in `extra`) and `import_round_items` (`grp` = plan.json `group`). Insert/delete = builder sync via service role only; RLS allows UPDATE to editors. Trigger blocks edits on `sent` rounds and stamps `qty_edited_at/by`.
- Field master: qty = web, everything else = builder (`build-*-plan.py` keeps rows whose qty was edited).
- Pictures: use aoocommerce `product_images` URL (Shopee CDN, zero storage) when barcode/code matches; otherwise upload webp to private bucket `import-images/<brand>/<code>.webp` (keyed by brand+code, not round). Storage was 542 MB / 1 GB on 29 Oct, growing ~250 MB/month — keep it small.
- Never show cost/FOB to a brand; internal only.

---
paths:
  - "app/(admin)/import/**"
  - "lib/services/import/**"
  - "app/api/import/**"
  - "public/order-plan/**"
  - "scripts/import-sync.mjs"
---

# Import module (สั่งของนำเข้า) — 29 Oct 2026

- Port of the owner's local order-plan page (`~/Dropbox/99.1-CoWork-Project/01-AGD/00-system/tools/order-plan/index.html` = the spec; port behaviour, not code). Hape C1 PO (31 Oct 2026) stays on the local page.
- Access = `import_access` rows (owner only for now), not role. Flags `can_edit` (qty) · `see_cost` (FOB/cost columns) for later purchasing/sales roles. `my_profile.import_access` → `userData.importAccess`; sidebar key `import`; pages guard with `!!userData.importAccess`. viewAs hides it.
- Tables `import_rounds` (one per plan.json, `slug` = folder name e.g. `C1-hape`, unknown plan keys in `extra`) and `import_round_items` (`grp` = plan.json `group`). Insert/delete = builder sync via service role only; RLS allows UPDATE to editors. Trigger blocks edits on `sent` rounds and stamps `qty_edited_at/by`.
- **amgo DB is the only copy (owner 30 Oct 2026).** The local order-plan page (AGD `npm run plan:local`) is retired; AGD `npm run dev` / `เปิดแผนสั่งของ.command` open amgo /import. plan.json = builder working copy: pull → build → push (AGD `npm run plan:hape`). Owner's own qty = `qty_edited_at` (set by the web, or from the file's `edited` on push); the builder keeps those lines, other lines take its suggestion. Rounds are found by slug, else brand+sub+round (folder renamed after the invoice, AGD rules §9.7).
- Pictures: use aoocommerce `product_images` URL (Shopee CDN, zero storage) when barcode/code matches; otherwise upload webp to private bucket `import-images/<brand>/<code>.webp` (keyed by brand+code, not round). Storage was 542 MB / 1 GB on 29 Oct, growing ~250 MB/month — keep it small.
- Never show cost/FOB to a brand; internal only.
- Sync = `node scripts/import-sync.mjs push|pull <round folder | plan.json> [...] [--dry]` (run from amgo root; service key from .env.local, aoo key from ~/aoocommerce/.env.local). push = file → amgo (keeps web-edited qty; status from file only on create or when the file is further along draft→approved→sent; deletes items gone from the file; uploads missing pictures once). pull = web-edited qty + status → plan.json. First push 29 Oct: C1-hape 866 · C1-jadore 43 · 539 pictures = 1.5 MB (most local pictures are tiny Excel thumbnails, e.g. 31×57 px — source quality, not a bug).
- Owner 29 Oct: the round page must look EXACTLY like the local order-plan page. So it is NOT React: `public/order-plan/index.html` is the AGD file copied verbatim (diff = API paths, picture URLs, no version polling, hash → parent), shown full-bleed in an iframe by `app/(admin)/import/page.tsx` (`/import#p=<slug>`). When the owner changes the local page, re-copy and re-apply those few edits — don't restyle it into the design system.
- API (`lib/services/import/importServer.ts`, routes `app/api/import/{rounds,plan,srp,aoo-prices}`) returns the old serve.mjs shapes. PUT keeps only status · fx · qty; `edited:false` (took the suggestion) clears qty_edited_*; blocked lines can't get qty. Pictures in the bucket go out as 6 h signed URLs. aoo shelf prices come through aoo's own MCP (`/api/mcp`, tool `stock`) with a read-only per-company key `AOO_MCP_KEY` (owner 30 Oct: no aoo DB master key in amgo). Key is in local .env.local; Vercel needs it too. MCP keys expire (≤ 365 days) → prices silently vanish when it lapses; renew at aoo /superadmin/mcp-keys.
- Rounds sharing a container are tabs of one page (Hape + J'adore = 2026-C1) — don't delete a sub-brand round because "it's in the Hape order": that means it's a tab there.
- Never-order list (replaced / discontinued models): see `import-do-not-order.md` → `01-AGD/02-hape/2026/99-data/hape/do-not-order.json`.
- Container no. = `import_rounds.ship_no`, per brand per year like AGD's invoice folders ("Hape #5_ INV. …"). Owner 30 Oct: 2026-C1 = Hape 2026 #5, next = #6. Sync sets it on create (same container → same no., else brand's max that year + 1; plan.json `shipNo` overrides). The page shows "Hape 2026 #5 · ตู้ 2026-C1" (`ctrName()` in public/order-plan/index.html — an amgo-only addition).
- Brand logos on the page come from the SRP Calculator (`srp_brands.logo_url`, name = srp_brand ?? sub ?? brand) — add a brand's logo there, not in import. Headings use the container no. ("Hape — ตู้ #5 …" = plan title) instead of the round code C1 (owner 30 Oct).

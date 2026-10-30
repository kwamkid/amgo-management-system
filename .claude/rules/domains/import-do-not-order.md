---
paths:
  - "app/(admin)/import/**"
  - "lib/services/import/**"
  - "app/api/import/**"
  - "scripts/import-sync.mjs"
---

# Import — models we must never order again (owner rule, 29 Oct 2026)

**Source of truth:** `~/Dropbox/99.1-CoWork-Project/01-AGD/02-hape/2026/99-data/hape/do-not-order.json`.
The AGD plan builder (`build-c1-plan.py`) reads `replaced` from it. Read the file; don't copy the lists into code.
New entries go in that JSON only, in the AGD project.

## Rules for any new order / round / suggestion
1. **`replaced`: old code → new code.** Never order the old code; put the quantity on the new code instead.
   On the round page:
   - The old line shows a "เลิกสั่ง — ใช้รุ่นใหม่ X แทน" badge, qty 0, not editable.
   - The new line shows "รุ่นใหม่แทน <old>".
   - The old model's sales history counts as the new model's history when suggesting qty.
2. **`discontinued`:** never suggest these and never let them be ordered. Hape has no stock, or said don't order (seasonal / POP).
3. **`lastStock`:** discontinued, but Hape still holds a few pieces. Order only if the owner asks. Never re-order in a later round.
4. **`skippedThisRound`:** the owner skipped these for that round only. They are fine to suggest again in later rounds.
5. **`waitForForm`** (opposite list): models the owner wants. When a new Hape price list / order form contains one, flag it on the round page ("⭐ คุณแอมรอสั่ง") and tell the owner; never auto-skip it. Today: E3894 Deluxe Railway World · E0093 Pixelz Clock · E3895 Carnival Coaster · E3611 Chit Chat Parrot · E3612 Dr. Paws' Pet Clinic · E3235 (name unknown).
6. If an incoming price list or order form still contains a blocked code, keep it blocked. Tell the owner instead of ordering it.

## Current list (29 Oct 2026; the JSON wins if they differ)
| Old (don't order) | Order instead |
|---|---|
| E0333 Baby Drum | **E0048** (not in the 2026 price list yet; price/carton asked) |
| E0407 Shake and Match Shape Sorter | **E0516** Wooden Wonder Shape Sorter |
| E8247 Wonderful Blocks 101 pcs | **E8402** Count and Spell Blocks 80 pcs |

**Discontinued:** E8380 · E0367 · E0366 · E0612 · E3196 · E0419 · E1002 · E3175 · E0462 · E0508 · E1047 · E3166 · E4067 · E0220 · E0388 (Xmas) · E8778 (CNY box) · E9732 (POP giveaway) · J'adore 853393.

**Last stock only:** E0213 · E0208 · E3524 · E5562 · E4311 · E0458 · E8404.

**J'adore C1 (not discontinued):** these lines were out of stock at Hape on 29 Oct, and the owner chose not to wait. They can be ordered again in a later round:
852464 · 854559 · 854482 · 854845 · 854846 · 855130 · 855131.

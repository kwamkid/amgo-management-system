# Optimizations done
> One line each, newest on top: what was slow → what changed → commit. team-optimizer greps this before a review.

<!-- toc -->
<!-- /toc -->

---
- 2026-11-17 · order plan (`public/order-plan/index.html`, `app/(admin)/import/page.tsx`) · header fold animated max-height → iframe resized every frame → whole table re-laid out (stutter on scroll); now folds instantly · search redraw debounced 150 ms · `plan.items.indexOf` in sort/render replaced by a position map · `9779471`. Not done yet: rows are rebuilt with innerHTML on every filter/search instead of building once and toggling visibility.

# Marketplace research
> How to pull competitor sales / prices from Thai marketplaces with the Chrome tools.
<!-- toc -->
**Contents** (1)
- 2026-11-23 — Shopee / Lazada sold counts (J'adore squishy check)
<!-- /toc -->

---

## 2026-11-23 — Shopee / Lazada sold counts (J'adore squishy check)
- Shopee search redirects to "Login Required" (`/verify/traffic/error`) when logged out → ask the owner to log in in Chrome; never type credentials. Logged in: `shopee.co.th/search?keyword=<kw>&sortBy=sales&minPrice=&maxPrice=`, cards `li[data-sqe="item"]`, text has "N Sold/Month" (per listing, monthly). Design-word keywords often return the same generic listings → no per-design split.
- Lazada works logged out: same-origin `fetch('/catalog/?ajax=true&q=<kw>&sort=popularity&page=1')` → `mods.listItems[]` with `name`, `price`, `itemSoldCntShow` (lifetime-ish "1.2K sold").

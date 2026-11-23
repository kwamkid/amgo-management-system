# Local HTML pages (reports opened from disk)

> Traps when building standalone .html reports that the owner opens with `open file.html` (not via a server).

<!-- toc -->
**Contents** (1)
- 2026-11-23 — charset, embeds, testing
<!-- /toc -->

---

## 2026-11-23 — charset, embeds, testing
- Always start the file with `<!doctype html><meta charset="utf-8">` — Artifact publish adds it for you, a local file does not; served over HTTP without it, Thai renders as mojibake.
- TikTok post embeds work in a plain iframe: `https://www.tiktok.com/embed/v2/<videoId>` (loading="lazy"). YouTube embeds may refuse to play from file:// (no referrer) — keep a link fallback.
- Claude-in-Chrome cannot open file:// URLs → test with `python3 -m http.server <port> --bind 127.0.0.1` in the page's folder, then kill it.

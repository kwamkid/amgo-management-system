---
paths:
  - "app/api/bot/**"
  - "lib/services/bot/**"
  - "docs/bot-api.md"
---
# Bot API (/api/bot) — rules

- amgo owns only the API side. The Hermes Agent (Discord bots Jarvis = superadmin, Edith = general) lives in another project (AGD) — don't do Hermes/VPS work here; report API changes so the owner updates Hermes.
- The API uses the service role (bypasses RLS) → every permission rule from the DB (policies + triggers) must be re-checked in `lib/services/bot/*` / the route. Change a DB rule → change it here too.
- Raw keys never go in chat or git. Keys live in `memo/bot-keys.env` (AMGO_JARVIS_KEY / AMGO_EDITH_KEY); DB stores sha256 only. Mint with a script that writes the file and prints only hashes.
- Server-fetched images: Discord CDN hosts only (SSRF guard); resize to JPEG 1600 with sharp (bucket task-images accepts image/jpeg ≤ 5 MB). Max 5 per request.
- Keep `docs/bot-api.md` in sync with every endpoint change.
- HR endpoints (attendance · leave · balance · documents, 28 Oct): others' data + approve/reject/file-on-behalf = `superadmin` only; `general` (Edith) = caller's own data even if their role is admin/hr (owner's request via AGD session). Leave dates are stored as Bangkok midnight (`bkkMidnight`), never UTC midnight. After every write call `stampAudit` (service role leaves `audit_log.changed_by` null). Push like the web via `pushLeaveEvent`.

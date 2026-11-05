# Vault (/vault) — replaces the Google Sheet of shop logins (owner, 5 Nov 2569)

Per-account view/edit/delete grants. Every active admin has full access, including adding accounts and changing grants (owner decision, 5 Nov; first version used a vault_owners list, dropped in `20261105110000`). Secrets = one AES-256-GCM blob per account with `VAULT_SECRET_KEY`, account id as AAD. Tables have RLS on, no policies, no grants: only /api/vault touches them; reveal is the only exit and logs first. `vault_logs` is append-only by trigger.

## Resume
Pushed in a8f23a5. Both migrations applied by the owner; `VAULT_SECRET_KEY` set in Vercel by the owner (value cannot be read back: confirm with one test account on production). API e2e 32/32 and the UI (add, reveal, grant, log, delete) checked in Chrome on 5 Nov; not checked at phone width or on production. A non-admin revealing or editing was not run on purpose (the log is append-only and would name a real employee): leave it to UAT.

- [ ] Owner backs up the key outside the vault; test one account on production before adding real logins
- [ ] Push (uncommitted): bulk import, multi-account grants and delete, platform grouping + logo filter (`public/platforms/`), `MultiSelectMenu`, SelectMenu search above 7 (system-wide), open-to-view detail
- [ ] Owner deletes the 31 shifted rows and re-imports from the Sheet (sheet = "Shopee ABC" | login | password | OTP | note). Rows split on `/`, Tiktok Seller = TikTok Shop
- [ ] 10 files still use native `Select`; several `searchThreshold={99}` still turn search off; owner to decide
- [ ] After re-import, confirm one reveal on production (proves the Vercel key matches `.env.local`)
- [ ] Replace hand-written vault types in `types/database.ts` with `npm run types:gen`
- [ ] UAT cases, rules file `.claude/rules/domains/vault.md`
- [ ] Owner moves logins from the Sheet, changes each password, deletes the Sheet
- [ ] Decide: PIN or LINE check before reveal; not built

# Vault (/vault) — replaces the Google Sheet of shop logins (owner, 5 Nov 2569)

Per-account view/edit/delete grants. Every active admin has full access, including adding accounts and changing grants (owner decision, 5 Nov; first version used a vault_owners list, dropped in `20261105110000`). Secrets = one AES-256-GCM blob per account with `VAULT_SECRET_KEY`, account id as AAD. Tables have RLS on, no policies, no grants: only /api/vault touches them; reveal is the only exit and logs first. `vault_logs` is append-only by trigger.

## Resume
Code written, not committed. First migration applied by the owner. API e2e 32/32 and the UI (add, reveal, grant, log, delete) checked in Chrome on 5 Nov; not checked at phone width or on production. A non-admin revealing or editing was not run on purpose (the log is append-only and would name a real employee): leave it to UAT.

- [ ] Owner applies `supabase/migrations/20261105110000_vault_admins_only.sql`, drops vault_owners; until then the second admin has no menu, API already works
- [ ] Owner sets `VAULT_SECRET_KEY` in Vercel, same value as `.env.local`, and backs it up outside the vault
- [ ] Replace hand-written vault types in `types/database.ts` with `npm run types:gen`
- [ ] Commit + push (on owner's word), UAT cases, rules file `.claude/rules/domains/vault.md`
- [ ] Owner moves logins from the Sheet, changes each password, deletes the Sheet
- [ ] Decide: PIN or LINE check before reveal; not built

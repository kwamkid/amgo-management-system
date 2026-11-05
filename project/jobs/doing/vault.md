# Vault (/vault) — replaces the Google Sheet of shop logins (owner, 5 Nov 2569)

Per-account view/edit/delete grants. Every active admin has full access, including adding accounts and changing grants (owner decision, 5 Nov; first version used a vault_owners list, dropped in `20261105110000`). Secrets = one AES-256-GCM blob per account with `VAULT_SECRET_KEY`, account id as AAD. Tables have RLS on, no policies, no grants: only /api/vault touches them; reveal is the only exit and logs first. `vault_logs` is append-only by trigger.

## Resume
Live on production at ea79b1a, owner confirmed reveal, `/employees/bulk` and printed documents on 5 Nov. Key backed up, passwords changed, Sheet removed, staff grants set (owner, 5 Nov). UAT-0154 to 0160 on the board. No PIN step (owner). Rules: `.claude/rules/domains/vault.md`.

- [ ] Push (uncommitted): native `Select` replaced everywhere, `searchThreshold` overrides removed, vault rules file
- [ ] After that push, add a UAT case for the new dropdowns (leave form, UAT board, SEO settings, page-size in table footers)
- [ ] Replace hand-written vault types with `npm run types:gen`: needs a token with access to this project. Careful, a failed run empties `types/database.ts`

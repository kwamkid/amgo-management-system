# Vault (/vault) — replaces the Google Sheet of shop logins (owner, 5 Nov 2569)

<!-- toc -->
**Contents** (1)
- Resume note
<!-- /toc -->

Per-account view/edit/delete grants. Every active admin has full access, including adding accounts and changing grants (owner decision, 5 Nov; first version used a vault_owners list, dropped in `20261105110000`). Secrets = one AES-256-GCM blob per account with `VAULT_SECRET_KEY`, account id as AAD. Tables have RLS on, no policies, no grants: only /api/vault touches them; reveal is the only exit and logs first. `vault_logs` is append-only by trigger.

Done: production at 87f8328 (a8f23a5, 142d6e7, ea79b1a, 87f8328). Key backed up, passwords changed, Sheet removed, staff grants set (owner, 5 Nov). Owner confirmed reveal, `/employees/bulk` and printed documents. UAT-0154 to 0162. No PIN step (owner decision).

- [ ] รอคุณแอม: a Supabase token with access to project odcrsmhutabsqhozpfhl, then replace the hand-written vault entries in `types/database.ts` from `npm run types:gen`, generating to a scratch file first
- [ ] Export `AvatarStack` and `IconFilter` from `components/shared/index.ts`, and import them from there in `app/(admin)/vault/page.tsx`. That index still holds the /brief chat's uncommitted line, so do this once /brief is committed

## Resume note
Resume at: export the two components once /brief is committed; nothing is blocking the live feature.
### State
Nothing of this topic uncommitted after this memo. Typecheck clean at 87f8328.
### Gotchas
Real logins are on the production DB, and local dev uses it. See `.claude/rules/domains/vault.md`.
### Read first
`.claude/rules/domains/vault.md`

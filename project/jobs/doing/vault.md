# Vault (/vault) — replaces the Google Sheet of shop logins (owner, 5 Nov 2569)

<!-- toc -->
**Contents** (1)
- Resume note
<!-- /toc -->

Per-account view/edit/delete grants. Every active admin has full access, including adding accounts and changing grants (owner decision, 5 Nov; first version used a vault_owners list, dropped in `20261105110000`). Secrets = one AES-256-GCM blob per account with `VAULT_SECRET_KEY`, account id as AAD. Tables have RLS on, no policies, no grants: only /api/vault touches them; reveal is the only exit and logs first. `vault_logs` is append-only by trigger.

Done: production at 87f8328 (a8f23a5, 142d6e7, ea79b1a, 87f8328). Key backed up, passwords changed, Sheet removed, staff grants set (owner, 5 Nov). Owner confirmed reveal, `/employees/bulk` and printed documents. UAT-0154 to 0162. No PIN step (owner decision).

- [x] `types/database.ts` vault entries checked against the live REST schema: all columns and nullability match, `has_vault_access` added. `types:gen` itself still needs a token, not needed for this
- [x] `AvatarStack` and `IconFilter` exported from `components/shared/index.ts`

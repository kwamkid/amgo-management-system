---
paths:
  - "app/(admin)/vault/**"
  - "app/api/vault/**"
  - "components/vault/**"
  - "lib/vault/**"
  - "lib/services/vault/**"
  - "lib/services/vaultService.ts"
---
# Vault (/vault): shop logins with per-account access (owner, 5 Nov 2569)

Replaces the Google Sheet of logins. Holds real credentials on the production DB.

- **Never read, print or log real login values.** Local dev uses the production DB. Test with fake accounts only and delete them; `vault_logs` is append-only, so never reveal or edit as a real employee in a test: the row would name them for good.
- Secrets are one AES-256-GCM blob per account with `VAULT_SECRET_KEY`, the account id as AAD (`lib/services/vault/crypto.ts`). The key is in Vercel (sensitive, cannot be read back) and `.env.local`, and must be the same in both. Losing it loses every login.
- All vault tables have RLS on, no policies, no browser grants. Only `/api/vault` touches them, with the service-role client after `vaultActor()`. Never add a policy, a bot route or an MCP tool that reads them.
- Password and note leave the server only through `POST /api/vault/[id]/reveal`, which writes the log first: no log, no secret. The list returns login + OTP phone only, decrypted on the server, with no per-view log (owner's choice). A row that fails to decrypt still lists, without them.
- Active admins (`role = 'admin'`) have full access, including adding accounts and changing grants. Everyone else needs a `vault_access` row. Edit and delete include view.
- Bulk grants change only the people listed; a person with nothing ticked loses access. Import never overwrites: same platform + name is skipped.
- Import: usual sheet is `Shopee ABC | login | password | OTP phone | note`. `/` splits one row into several accounts, Tiktok Seller = TikTok Shop, Email = Gmail. Known platforms and their logos live in `lib/vault/platforms.ts` and `public/platforms/`.
- Owner chose no PIN or LINE step before reveal (5 Nov): do not re-propose it.
- `types/database.ts` vault entries are hand-written: `npm run types:gen` needs access this CLI account lacks.

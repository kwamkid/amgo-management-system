# Working across repos (amgo ↔ aoo family)

> Traps when an amgo chat touches another repo or its database.

<!-- toc -->
**Contents** (2)
- 2026-11-23 — aoosocial `supabase/.temp/project-ref` is stale
- 2026-11-23 — running aoosocial TS against prod from a script
<!-- /toc -->

---

## 2026-11-23 — aoosocial `supabase/.temp/project-ref` is stale
It says `hqapmsoapxiukwroxxue`; the live aoosocial project is `gyuqrqrtyhjmfyguvczy` (= `NEXT_PUBLIC_SUPABASE_URL` in its .env.local and amgo's `AOOSOCIAL_SUPABASE_URL`). Owner's SQL failed on the wrong project. Take the ref from the env URL, not .temp.

## 2026-11-23 — running aoosocial TS against prod from a script
`import "server-only"` breaks tsx: shim it with a temp tsconfig `paths: { "server-only": ["./src/__empty.ts"] }`; its .env.local doesn't source in bash (unquoted `<…>`), so export only the needed keys with grep. Delete the temp files after.

// aoosocial's Supabase (service key, READ ONLY by convention) — server only, never import from client code.
// Env: AOOSOCIAL_SUPABASE_URL · AOOSOCIAL_SECRET_KEY (owner approved 2026-11-23). Untyped: we read a few columns only.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function aoosocialDb(): SupabaseClient {
  if (cached) return cached
  const url = process.env.AOOSOCIAL_SUPABASE_URL
  const key = process.env.AOOSOCIAL_SECRET_KEY
  if (!url || !key) throw new Error('ยังไม่ได้ตั้ง AOOSOCIAL_SUPABASE_URL / AOOSOCIAL_SECRET_KEY')
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return cached
}

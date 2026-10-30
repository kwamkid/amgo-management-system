// lib/labels/server.ts
//
// ทางเข้าของ API ฉลาก — server only
//   ?r=<slug>  = คนในบริษัท (ล็อกอิน + import_access หรือ role admin/manager)
//   ?t=<token> = โรงงาน (ลิงก์แชร์ ไม่ต้องล็อกอิน · อ่านด้วย admin client หลังเช็ค token แล้ว)

import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase, verifiedUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { loadRoundLabels, type RoundLabels } from './resolve'

/** roles that may see + edit labels besides import_access (owner 30 Oct 2026: "manager ทุกคนแก้ได้ ดูได้ เพิ่มได้") */
export const LABEL_ROLES = ['admin', 'manager']

export interface LabelCtx {
  /** service-role client — the guard below is the access check; import tables' RLS only lets import_access in */
  sb: SupabaseClient<Database>
  userId: string
  canEdit: boolean
}

/**
 * Labels hold no cost/FOB, so managers get them without import access.
 * import_access → can_edit as set there · role admin/manager → view + edit · everyone else (incl. brand managers) → 403
 */
export async function labelGuard(edit = false): Promise<LabelCtx | NextResponse> {
  const user = await verifiedUser(await createServerSupabase())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const [{ data: acc }, { data: me }] = await Promise.all([
    admin.from('import_access').select('can_edit').eq('user_id', user.id).maybeSingle(),
    admin.from('users').select('role, is_active').eq('id', user.id).maybeSingle(),
  ])
  const byRole = !!me?.is_active && LABEL_ROLES.includes(me.role ?? '')
  if (!acc && !byRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const canEdit = byRole || !!acc?.can_edit
  if (edit && !canEdit) return NextResponse.json({ error: 'แก้ไม่ได้ — สิทธิ์ดูอย่างเดียว' }, { status: 403 })
  return { sb: admin, userId: user.id, canEdit }
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

export async function roundByToken(token: string): Promise<RoundLabels | null> {
  if (!TOKEN_RE.test(token)) return null
  const admin = createAdminClient()
  const { data } = await admin.from('label_rounds').select('round_id').eq('share_token', token).maybeSingle()
  return data ? loadRoundLabels(admin, { id: data.round_id }) : null
}

/** ?r= (logged in) or ?t= (share link) → the round, or an error response */
export async function roundFromRequest(req: NextRequest): Promise<RoundLabels | NextResponse> {
  const t = req.nextUrl.searchParams.get('t')
  if (t) {
    const rl = await roundByToken(t)
    return rl ?? NextResponse.json({ error: 'Link expired' }, { status: 404 })
  }
  const ctx = await labelGuard()
  if (ctx instanceof NextResponse) return ctx
  const rl = await loadRoundLabels(ctx.sb, { slug: req.nextUrl.searchParams.get('r') ?? '' })
  return rl ?? NextResponse.json({ error: 'not found' }, { status: 404 })
}

export const newShareToken = () => randomBytes(18).toString('base64url')

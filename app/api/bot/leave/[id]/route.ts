// GET   /api/bot/leave/:id — ใบลาใบเดียว (general: ของตัวเองเท่านั้น)
//
// PATCH /api/bot/leave/:id — ตัดสินใบลา
//   { action: "approve" }                    superadmin หรือ role admin/hr/manager · ใบที่รอ · ตรวจโควต้าอีกรอบ
//   { action: "reject", reason }             superadmin หรือ role admin/hr/manager · ใบที่รอ · ต้องมีเหตุผล
//   { action: "cancel", reason? }            general: ใบที่รอของตัวเอง
//                                            superadmin: ใบที่รอ หรือ ใบที่อนุมัติแล้ว (ต้องมีเหตุผล — โควต้าคืนเอง)
//   ทุกอย่างกันกดซ้อนด้วยเงื่อนไขสถานะเดิม — ใบถูกตัดสินไปแล้ว = 409
import { after, type NextRequest } from 'next/server'
import { UUID, apiError, apiJson, authBotApi, readJson } from '@/lib/services/bot/botApi'
import { canManageLeave, canSee, getLeaveRow, pushLeaveEvent, quotaError, stampAudit, toBotLeave } from '@/lib/services/bot/botHr'
import { LEAVE_TYPE_LABELS } from '@/types/leave'
import type { Database } from '@/types/database'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const { id } = await params
  if (!UUID.test(id)) return apiError(400, 'id ไม่ถูกต้อง')
  const row = await getLeaveRow(caller.sb, id)
  if (!row || !(canSee(caller, row.user_id) || canManageLeave(caller))) return apiError(404, 'ไม่พบใบลา')
  return apiJson({ leave: toBotLeave(row) })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const { id } = await params
  if (!UUID.test(id)) return apiError(400, 'id ไม่ถูกต้อง')
  const b = await readJson(request)
  if (!b) return apiError(400, 'body ต้องเป็น JSON object')
  const admin = canManageLeave(caller)

  const row = await getLeaveRow(caller.sb, id)
  if (!row || !(canSee(caller, row.user_id) || admin)) return apiError(404, 'ไม่พบใบลา')
  const leave = toBotLeave(row)
  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 500) : ''
  const now = new Date().toISOString()
  const me = caller.user.id

  let patch: Database['public']['Tables']['leave_requests']['Update']
  let from: 'pending' | 'approved'
  switch (b.action) {
    case 'approve': {
      if (!admin) return apiError(403, 'อนุมัติใบลาได้เฉพาะแอดมิน')
      from = 'pending'
      const quota = await quotaError(caller.sb, row.user_id, row.leave_type, leave.start, leave.charged)
      if (quota) return apiError(400, quota)
      patch = { status: 'approved', approved_by: me, approved_at: now }
      break
    }
    case 'reject':
      if (!admin) return apiError(403, 'ปฏิเสธใบลาได้เฉพาะแอดมิน')
      if (!reason) return apiError(400, 'ปฏิเสธต้องใส่ reason')
      from = 'pending'
      // approved_by = คนที่ตัดสิน ไม่ว่าผลจะเป็นอะไร (เหมือน rejectLeaveRequest)
      patch = { status: 'rejected', approved_by: me, approved_at: now, rejected_reason: reason }
      break
    case 'cancel':
      if (row.status === 'approved') {
        if (!admin) return apiError(403, 'ใบที่อนุมัติแล้วให้ HR ยกเลิก')
        if (!reason) return apiError(400, 'ยกเลิกใบที่อนุมัติแล้วต้องใส่ reason')
        from = 'approved'
      } else from = 'pending'
      patch = { status: 'cancelled', cancelled_by: me, cancelled_at: now, cancel_reason: reason || 'ยกเลิกโดยผู้ใช้' }
      break
    default:
      return apiError(400, 'action ต้องเป็น approve, reject หรือ cancel')
  }

  if (row.status !== from) return apiError(409, `ใบลานี้สถานะ ${row.status} แล้ว`)
  const { data, error } = await caller.sb.from('leave_requests').update(patch).eq('id', id).eq('status', from).select('id')
  if (error) return apiError(500, error.message)
  if (!data?.length) return apiError(409, 'ใบลานี้ถูกดำเนินการไปแล้ว')
  await stampAudit(caller.sb, 'leave_requests', id, me)

  if (b.action !== 'cancel') {
    const base = { targetUserId: row.user_id, leaveType: LEAVE_TYPE_LABELS[row.leave_type], startDate: leave.start, endDate: leave.end }
    after(() =>
      pushLeaveEvent(
        caller.user,
        b.action === 'approve'
          ? { ...base, event: 'leave_approved', totalDays: leave.days }
          : { ...base, event: 'leave_rejected', reason },
      ),
    )
  }

  const fresh = await getLeaveRow(caller.sb, id)
  return apiJson({ leave: fresh ? toBotLeave(fresh) : { id } })
}

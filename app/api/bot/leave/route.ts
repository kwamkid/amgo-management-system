// GET  /api/bot/leave — รายการใบลา (ใหม่สุดก่อน)
//   ?status=pending,approved,rejected,cancelled | all (ค่าเริ่มต้น all) · person=me|<discord id>|<user id>
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD (ใบที่ทับช่วงนี้) · type=sick|personal|vacation · limit=50 (สูงสุด 200)
//   general: เห็นแค่ใบของตัวเอง (ส่ง person คนอื่น = 403)
//
// POST /api/bot/leave — ยื่นใบลา
//   { type, start_date, end_date?, reason?, urgent? }  (end_date ไม่ส่ง = วันเดียว)
//   superadmin เพิ่ม: person (ยื่นแทน) · approve: true (อนุมัติเลย) · ลาย้อนหลังได้ทุกประเภท
//   general: ยื่นได้แค่ของตัวเอง สถานะ pending เสมอ
//   แจ้งล่วงหน้าไม่ถึงกำหนด → หักโควต้าเป็นเท่าเหมือนบนเว็บ (ตอบ autoUrgent: true)
import { after, type NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, readJson, resolvePeople } from '@/lib/services/bot/botApi'
import { isYmd, todayBkk } from '@/lib/services/bot/botTasks'
import {
  LEAVE_COLS,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  bkkMidnight,
  canSee,
  dayDiff,
  getLeaveRow,
  leaveCharge,
  overlapping,
  pushLeaveEvent,
  quotaError,
  stampAudit,
  toBotLeave,
  type LeaveRow,
  type LeaveStatus,
} from '@/lib/services/bot/botHr'
import { LEAVE_TYPE_LABELS, type LeaveType } from '@/types/leave'

const MAX_LIMIT = 200
const MAX_DAYS = 60

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const p = request.nextUrl.searchParams

  const statusParam = (p.get('status') ?? 'all').toLowerCase()
  const statuses = statusParam === 'all' ? [...LEAVE_STATUSES] : (statusParam.split(',').map((s) => s.trim()) as LeaveStatus[])
  if (!statuses.length || statuses.some((s) => !LEAVE_STATUSES.includes(s)))
    return apiError(400, 'status ต้องเป็น pending,approved,rejected,cancelled หรือ all')
  const type = p.get('type') as LeaveType | null
  if (type && !LEAVE_TYPES.includes(type)) return apiError(400, 'type ต้องเป็น sick, personal หรือ vacation')
  const from = p.get('from')
  const to = p.get('to')
  if ((from && !isYmd(from)) || (to && !isYmd(to))) return apiError(400, 'วันที่ต้องเป็น YYYY-MM-DD')
  const limit = Math.min(Math.max(Number(p.get('limit')) || 50, 1), MAX_LIMIT)

  let userId: string | null = caller.scope === 'superadmin' ? null : caller.user.id
  const person = p.get('person')?.trim()
  if (person) {
    const { found } = await resolvePeople(caller.sb, [person], caller.user)
    if (!found.length) return apiError(400, `ไม่พบพนักงาน: ${person}`)
    if (!canSee(caller, found[0].id)) return apiError(403, 'ดูได้แค่ใบลาของตัวเอง')
    userId = found[0].id
  }

  let q = caller.sb.from('leave_requests').select(LEAVE_COLS).in('status', statuses)
  if (userId) q = q.eq('user_id', userId)
  if (type) q = q.eq('leave_type', type)
  // ทับช่วง ไม่ใช่อยู่ในช่วง — ใบคร่อมเดือนขึ้นทั้งสองเดือน (เหมือน getLeaveRequests บนเว็บ)
  if (to) q = q.lte('start_date', bkkMidnight(to))
  if (from) q = q.gte('end_date', bkkMidnight(from))
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) return apiError(500, error.message)
  const leaves = ((data ?? []) as unknown as LeaveRow[]).map(toBotLeave)
  return apiJson({ leaves, count: leaves.length })
}

export async function POST(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const b = await readJson(request)
  if (!b) return apiError(400, 'body ต้องเป็น JSON object')
  const admin = caller.scope === 'superadmin'

  const type = b.type as LeaveType
  if (!LEAVE_TYPES.includes(type)) return apiError(400, 'type ต้องเป็น sick, personal หรือ vacation')
  const start = b.start_date
  const end = b.end_date ?? start
  if (!isYmd(start) || !isYmd(end)) return apiError(400, 'start_date / end_date ต้องเป็น YYYY-MM-DD')
  if (end < start) return apiError(400, 'end_date ต้องไม่ก่อน start_date')
  if (start.slice(0, 4) !== end.slice(0, 4)) return apiError(400, 'ใบลาข้ามปีให้แยกเป็นสองใบ (โควต้าคิดรายปี)')
  const days = dayDiff(start, end) + 1 // นับทุกวัน รวมเสาร์อาทิตย์ (calculateLeaveDays)
  if (days > MAX_DAYS) return apiError(400, `ลาได้ครั้งละไม่เกิน ${MAX_DAYS} วัน`)
  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 1000) : ''
  const approve = b.approve === true
  if (approve && !admin) return apiError(403, 'อนุมัติใบลาได้เฉพาะแอดมิน')

  let owner = caller.user
  if (b.person !== undefined && b.person !== 'me') {
    if (!admin) return apiError(403, 'ยื่นใบลาได้แค่ของตัวเอง')
    const { found } = await resolvePeople(caller.sb, [String(b.person)], caller.user)
    if (!found.length) return apiError(400, `ไม่พบพนักงาน: ${b.person}`)
    owner = found[0]
  }

  const charge = leaveCharge(type, start, todayBkk(), b.urgent === true, admin)
  if ('error' in charge) return apiError(400, charge.error!)
  const clash = await overlapping(caller.sb, owner.id, start, end)
  if (clash) return apiError(409, `${owner.name}มีใบลา (${clash.status}) ทับช่วงนี้อยู่แล้ว — id ${clash.id}`)
  const quota = await quotaError(caller.sb, owner.id, type, start, days * charge.multiplier)
  if (quota) return apiError(400, quota)

  const { data: u } = await caller.sb.from('users').select('full_name, line_picture_url').eq('id', owner.id).single()
  const now = new Date().toISOString()
  const { data, error } = await caller.sb
    .from('leave_requests')
    .insert({
      user_id: owner.id,
      leave_type: type,
      status: approve ? 'approved' : 'pending',
      start_date: bkkMidnight(start),
      end_date: bkkMidnight(end),
      total_days: days,
      urgent_multiplier: charge.multiplier,
      reason,
      attachments: [],
      user_name: u?.full_name ?? owner.name,
      user_avatar: u?.line_picture_url ?? '',
      user_email: '',
      ...(approve ? { approved_by: caller.user.id, approved_at: now } : {}),
    })
    .select('id')
    .single()
  if (error) return apiError(500, `ยื่นใบลาไม่สำเร็จ: ${error.message}`)

  await stampAudit(caller.sb, 'leave_requests', data.id, caller.user.id)
  after(() =>
    pushLeaveEvent(
      // ยื่นแทน: ข้อความ "ขอลา" ต้องขึ้นชื่อเจ้าของใบ ไม่ใช่คนกด
      approve ? caller.user : owner,
      approve
        ? { event: 'leave_approved', targetUserId: owner.id, leaveType: LEAVE_TYPE_LABELS[type], startDate: start, endDate: end, totalDays: days }
        : { event: 'leave_request', leaveType: LEAVE_TYPE_LABELS[type], startDate: start, endDate: end, totalDays: days, reason, isUrgent: charge.multiplier > 1 },
    ),
  )

  const row = await getLeaveRow(caller.sb, data.id)
  return apiJson({ leave: row ? toBotLeave(row) : { id: data.id }, autoUrgent: charge.autoUrgent }, 201)
}

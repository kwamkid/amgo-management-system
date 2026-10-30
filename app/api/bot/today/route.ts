// GET /api/bot/today?date=YYYY-MM-DD (ค่าเริ่มต้น = วันนี้ เวลาไทย) · ?days=1 (งานครบกำหนดใน n วัน, 1–30)
//   ภาพรวมวันเดียวในคำขอเดียว — ให้บอทตอบ "วันนี้มีอะไรบ้าง" โดยไม่ต้องยิง 3–4 ครั้ง (เจ้าของขอ 30 ต.ค. 69)
//   รวม: การมาทำงาน (สาย/ขาด/ยังไม่เช็คเอาท์/รอ HR ตรวจ) · ใบลารออนุมัติ · งานเลยกำหนด+ครบกำหนด
//   เฉพาะกุญแจ superadmin (Jarvis) — เรียก handler ของ attendance / leave / tasks/brief ตรง ๆ
//   กติกาสิทธิ์และรูปแบบข้อมูลจึงเป็นชุดเดียวกับ endpoint เดี่ยว ไม่คิดใหม่ที่นี่
import { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi } from '@/lib/services/bot/botApi'
import { GET as attendanceGet } from '../attendance/route'
import { GET as leaveGet } from '../leave/route'
import { GET as briefGet } from '../tasks/brief/route'

type Json = Record<string, unknown>

/** เรียก route handler อื่นด้วยกุญแจเดียวกับคำขอนี้ */
async function sub(request: NextRequest, path: string, handler: (r: NextRequest) => Promise<Response>): Promise<Json> {
  const url = new URL(path, request.nextUrl.origin)
  const res = await handler(new NextRequest(url, { headers: request.headers }))
  const body = (await res.json().catch(() => ({}))) as Json
  if (!res.ok) throw new Error(`${path}: ${(body.error as string) ?? res.status}`)
  return body
}

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  if (a.caller.scope !== 'superadmin') return apiError(403, 'ภาพรวมทั้งทีมใช้ได้เฉพาะกุญแจ superadmin')

  const p = request.nextUrl.searchParams
  const date = p.get('date')?.trim()
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError(400, 'date ต้องเป็น YYYY-MM-DD')
  const days = Math.min(Math.max(Number(p.get('days')) || 1, 1), 30)

  try {
    const [att, leave, brief] = await Promise.all([
      sub(request, `/api/bot/attendance${date ? `?date=${date}` : ''}`, attendanceGet),
      sub(request, '/api/bot/leave?status=pending&limit=50', leaveGet),
      sub(request, `/api/bot/tasks/brief?user=team&days=${days}`, briefGet),
    ])

    const rows = (att.rows as Json[]) ?? []
    const pick = (r: Json) => ({
      name: (r.person as Json)?.name,
      company: r.company,
      status: r.status,
      late: r.late,
      lateMinutes: r.lateMinutes,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      leaveType: r.leaveType,
    })
    return apiJson({
      date: att.from,
      attendance: {
        summary: att.summary,
        late: rows.filter((r) => r.late).map(pick),
        absent: rows.filter((r) => r.status === 'absent').map(pick),
        onLeave: rows.filter((r) => r.leaveType).map(pick),
        stillOpen: rows.filter((r) => r.open).map(pick),
        needsReview: rows.filter((r) => r.needsReview).map(pick),
      },
      leavePending: { count: (leave.count as number) ?? ((leave.rows as Json[]) ?? []).length, rows: leave.rows ?? leave.leaves ?? [] },
      tasks: { until: brief.until, counts: brief.counts, overdue: brief.overdue, dueSoon: brief.dueSoon },
    })
  } catch (e) {
    return apiError(500, (e as Error).message)
  }
}

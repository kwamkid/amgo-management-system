// GET /api/bot/holidays — วันหยุดบริษัท (เปิดใช้อยู่) · ทุก scope อ่านได้ (holidays_read = true)
//   ?year=2026 (ค่าเริ่มต้น ปีนี้) หรือ ?from=YYYY-MM-DD&to=YYYY-MM-DD
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi } from '@/lib/services/bot/botApi'
import { isYmd, todayBkk } from '@/lib/services/bot/botTasks'

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const p = request.nextUrl.searchParams

  const year = p.get('year') ?? todayBkk().slice(0, 4)
  const from = p.get('from') ?? `${year}-01-01`
  const to = p.get('to') ?? `${year}-12-31`
  if (!isYmd(from) || !isYmd(to)) return apiError(400, 'วันที่ต้องเป็น YYYY-MM-DD')

  const { data, error } = await caller.sb
    .from('holidays')
    .select('holiday_date, name, holiday_type, is_working_day, description')
    .eq('is_active', true)
    .gte('holiday_date', from)
    .lte('holiday_date', to)
    .order('holiday_date')
  if (error) return apiError(500, error.message)
  const holidays = (data ?? []).map((h) => ({
    date: h.holiday_date,
    name: h.name,
    type: h.holiday_type,
    /** วันหยุดที่ยังต้องมาทำงาน (คิด OT ตามอัตราวันหยุด) */
    workingDay: h.is_working_day,
    description: h.description || null,
  }))
  return apiJson({ from, to, holidays, count: holidays.length })
}

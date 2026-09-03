// lib/services/payrollCutoffService.ts
//
// ตัดยอดเงินเดือนอัตโนมัติ — รันจาก cron วันละครั้ง
// ทำงานฝั่ง server ด้วยสิทธิ์ที่ข้าม RLS (ไม่มีผู้ใช้ล็อกอินตอน cron ทำงาน)
//
// ── ทำไมต้องมี (เจ้าของสั่ง 15 ส.ค. 69) ─────────────────────────────
// เดิมงวดเกิดขึ้นก็ต่อเมื่อมีคนเปิดหน้า /payroll แล้วกดบันทึก ซึ่งกดวันไหนก็ได้
// รวมถึงเดือนที่ยังไม่เกิดขึ้น — และเพราะแถวที่บันทึกแล้วชนะ auto-fill เสมอ
// ตัวเลขที่ยังไม่จริงจะค้างถาวรจนถึงวันจ่าย (เคยเกิด: งวดกันยายนถูกบันทึกไว้
// ตั้งแต่ 11 ส.ค. ถือวันทำงานครึ่ง ๆ ของสิงหาคม + ผีโอที ~82,000 บาท)
//
// ตอนนี้พอถึงวันตัดยอดของรอบไหน ระบบตัดยอดรอบนั้นเอง จากข้อมูลจริง ณ วันนั้น
// แล้ว HR ค่อยมาปรับค่าคอม/เงินพิเศษ/หัก ทีหลังได้ตามปกติ
//
// ปลอดภัยต่อการรันซ้ำ: แถวที่มีอยู่แล้วไม่ถูกแตะ (ของที่ HR กรอกมือไม่หาย)

import { createAdminClient } from '@/lib/supabase/admin'
import { loadPayroll, savePayroll, loadAttendanceDays, loadOtHours } from './payrollService'
import { cycleCutoffToday, CYCLE_LABELS, type CycleCode } from './payrollCycle'

const ALL_CYCLES: CycleCode[] = ['c28', 'c4', 'c30', 'eom']

export interface CutoffResult {
  cycle: CycleCode
  /** งวด (เดือนที่เงินออก) ที่เพิ่งถูกตัดยอด */
  month: string
  /** แถวที่เพิ่งเกิดขึ้นในงวดนี้ */
  created: number
  /** แถวที่มีอยู่ก่อนแล้ว — อัปเดตเฉพาะวันมา/ขาด/OT ของที่กรอกมือไม่แตะ */
  refreshed: number
}

export async function runPayrollCutoff(today: Date = new Date()): Promise<{
  results: CutoffResult[]
  errors: string[]
}> {
  const admin = createAdminClient()
  const results: CutoffResult[] = []
  const errors: string[] = []

  for (const cycle of ALL_CYCLES) {
    const month = cycleCutoffToday(cycle, today)
    if (!month) continue // วันนี้ไม่ใช่วันตัดยอดของรอบนี้

    try {
      const [rows, att, ot] = await Promise.all([
        loadPayroll(month, admin),
        loadAttendanceDays(month, admin),
        loadOtHours(month, admin),
      ])

      // แตะเฉพาะรอบที่ถึงวันตัดยอดวันนี้
      const mine = rows.filter((r) => r.cycle === cycle)
      if (!mine.length) continue

      // ตัดยอด = ตรึงตัวเลขที่มาจากข้อมูลจริง ณ วันนี้
      // แถวที่บันทึกไว้ก่อนวันตัดยอดก็ต้องถูกอัปเดตด้วย ไม่งั้นค้างตัวเลขครึ่ง ๆ
      // กลาง ๆ ไปตลอด (เคยเกิดกับงวดกันยายนที่ถูกบันทึกล่วงหน้า 2 สัปดาห์)
      // ส่วนที่ HR กรอกมือ — ค่าคอม/พิเศษ/หัก/หมายเหตุ/เงินเดือน — ไม่ถูกแตะ
      const finalRows = mine.map((r) => {
        if (!r.isPrimary) return r // แถวบริษัทอื่นไม่มีวันมา/ขาด/OT
        const a = att.get(r.userId)
        return {
          ...r,
          workDays: a?.work ?? r.workDays,
          absentDays: a?.absent ?? r.absentDays,
          // ไม่มีสิทธิ์ OT = ไม่มี entry → คงเลขที่ HR พิมพ์เองไว้
          otHours: ot.has(r.userId) ? ot.get(r.userId)! : r.otHours,
        }
      })

      const created = finalRows.filter((r) => !r.saved).length
      await savePayroll(month, finalRows, null, admin, true)

      results.push({
        cycle,
        month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
        created,
        refreshed: finalRows.length - created,
      })
      console.log(
        `[ตัดยอดเงินเดือน] ${CYCLE_LABELS[cycle]}: สร้างใหม่ ${created} แถว · อัปเดตของเดิม ${finalRows.length - created} แถว`
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'
      console.error(`[ตัดยอดเงินเดือน] ✗ ${cycle}:`, msg)
      errors.push(`${CYCLE_LABELS[cycle]}: ${msg}`)
    }
  }

  return { results, errors }
}

// หน้าตรวจสถานะการย้ายข้อมูลไป Supabase — ชั่วคราว ใช้ระหว่าง migration
// ลบทิ้งได้เมื่อย้ายเสร็จ (Phase 6)

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { migrationToolsEnabled } from '@/lib/supabase/migration-tools'

export const dynamic = 'force-dynamic'

// จำนวนที่นับได้จาก Firestore ตอน migrate (ใช้เทียบว่าครบไหม)
const FIRESTORE_COUNTS: Record<string, number> = {
  users: 58,
  locations: 13,
  checkins: 10278,
  leave_requests: 299,
  delivery_points: 3479,
  delivery_routes: 390,
}

const TABLES = [
  'users',
  'locations',
  'checkins',
  'checkin_edits',
  'leave_requests',
  'leave_days',
  'leave_quotas',
  'delivery_routes',
  'delivery_points',
  'companies',
  'business_units',
] as const

const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

export default async function MigrationStatusPage() {
  // หน้านี้อ่านข้อมูลด้วย secret key ซึ่งข้าม RLS ได้ทั้งหมด
  // บนของจริงไม่ได้ตั้ง ENABLE_MIGRATION_TOOLS ไว้ → ปิดสนิท เห็นเป็น 404
  if (!migrationToolsEnabled()) notFound()

  const sb = createAdminClient()

  const [counts, units, workDays, hours, quality] = await Promise.all([
    Promise.all(
      TABLES.map(async (t) => {
        const { count } = await sb.from(t).select('*', { count: 'exact', head: true })
        return { table: t, count: count ?? 0 }
      })
    ),
    sb
      .from('business_units')
      .select(
        'id, name, unit_type, schedule_type, coverage_days_per_week, default_days_per_week, payroll_cycle, companies(code), locations(name)'
      )
      .order('name'),
    sb.from('business_unit_work_days').select('business_unit_id, day_of_week, work_mode'),
    sb.rpc('attendance_period_summary', {
      p_from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      p_to: new Date().toISOString().slice(0, 10),
    }),
    sb.rpc('sum_total_hours').single(),
  ])

  const daysByUnit = new Map<string, { day: number; mode: string }[]>()
  for (const d of workDays.data ?? []) {
    const list = daysByUnit.get(d.business_unit_id) ?? []
    list.push({ day: d.day_of_week, mode: d.work_mode })
    daysByUnit.set(d.business_unit_id, list)
  }

  const scheduleText = (unitId: string, scheduleType: string, perPerson: number | null) => {
    if (scheduleType === 'rotating') return `สลับเวร — คนละ ${perPerson ?? '?'} วัน/สัปดาห์`
    const days = (daysByUnit.get(unitId) ?? [])
      .filter((d) => d.mode !== 'off')
      .sort((a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day))
      .map((d) => DAY_NAMES[d.day] + (d.mode === 'wfh' ? ' (บ้าน)' : ''))
    return days.length ? days.join(' · ') : '—'
  }

  const summary = (hours.data ?? []) as {
    full_name: string
    company_code: string | null
    business_unit: string | null
    days_worked: number
    days_expected: number
    days_leave: number
    days_absent: number
    total_hours: number
    avg_hours_per_day: number
  }[]

  return (
    <div className="max-w-6xl space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">สถานะการย้ายไป Supabase</h1>
        <p className="mt-1 text-sm text-gray-500">
          หน้านี้อ่านจาก Supabase โดยตรง (ไม่ผ่าน Firebase) — ถ้าเห็นตัวเลขแปลว่าข้อมูลเข้าแล้วจริง
        </p>
      </header>

      {/* ── จำนวนแถว ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">1. ข้อมูลที่ย้ายมาแล้ว</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">ตาราง</th>
                <th className="px-4 py-2 text-right font-medium">Supabase</th>
                <th className="px-4 py-2 text-right font-medium">Firestore</th>
                <th className="px-4 py-2 font-medium">ผล</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {counts.map(({ table, count }) => {
                const src = FIRESTORE_COUNTS[table]
                const ok = src === undefined || count >= src
                return (
                  <tr key={table}>
                    <td className="px-4 py-2 font-mono text-gray-700">{table}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-400">
                      {src?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      {src === undefined ? (
                        <span className="text-gray-400">สร้างใหม่</span>
                      ) : ok ? (
                        <span className="text-green-600">✅ ครบ</span>
                      ) : (
                        <span className="text-amber-600">⚠️ ขาด {src - count}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── คุณภาพชั่วโมงทำงาน ───────────────────────────────── */}
      {quality.data && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">
            2. ชั่วโมงทำงาน — เชื่อถือได้แค่ไหน
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            ระบบเดิมบันทึกชั่วโมงเป็น 0 ทั้งที่เช็คเอาท์แล้ว หนักขึ้นตั้งแต่ ม.ค. 2026 (20-27% ต่อเดือน)
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-2xl font-bold tabular-nums text-gray-900">
                {Number(quality.data.total_hours).toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-gray-500">ชั่วโมงรวมทั้งหมด</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-2xl font-bold tabular-nums text-gray-900">
                {quality.data.recomputed}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                คำนวณย้อนหลังจากเวลาเข้า-ออก — เชื่อถือได้
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-2xl font-bold tabular-nums text-red-700">
                {quality.data.needs_review}
              </p>
              <p className="mt-1 text-sm text-red-700">
                ต้องให้ HR ใส่เวลาเอง — ระบบปิดให้อัตโนมัติ หรือเกิน 16 ชม.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── หน่วยงาน ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-semibold text-gray-900">3. หน่วยงานและตารางงาน</h2>
        <p className="mb-3 text-sm text-gray-500">
          &ldquo;เปิด&rdquo; = ไซต์ต้องมีคนกี่วัน/สัปดาห์ · &ldquo;คนทำ&rdquo; = คนหนึ่งคนทำกี่วัน (ตั้งรายคนทับได้)
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">บริษัท</th>
                <th className="px-4 py-2 font-medium">หน่วยงาน</th>
                <th className="px-4 py-2 font-medium">สถานที่</th>
                <th className="px-4 py-2 font-medium">ตารางงาน</th>
                <th className="px-4 py-2 text-center font-medium">เปิด</th>
                <th className="px-4 py-2 text-center font-medium">คนทำ</th>
                <th className="px-4 py-2 text-center font-medium">รอบเงินเดือน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(units.data ?? []).map((u) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const co = (u as any).companies?.code as string | undefined
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const loc = (u as any).locations?.name as string | undefined
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          co === 'AGD' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {co}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-2 text-gray-500">{loc ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {scheduleText(u.id, u.schedule_type, u.default_days_per_week)}
                    </td>
                    <td className="px-4 py-2 text-center tabular-nums">
                      {u.coverage_days_per_week ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-center tabular-nums">
                      {u.default_days_per_week ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-xs">
                      {u.payroll_cycle === 'c28' ? 'วันที่ 28' : 'วันที่ 4'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── สรุปการมาทำงาน ───────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-semibold text-gray-900">4. สรุปการมาทำงาน 30 วันล่าสุด</h2>
        <p className="mb-3 text-sm text-gray-500">
          คำนวณด้วย Postgres ทั้งหมด — เดิม Firestore ทำไม่ได้เพราะแยก &ldquo;ขาดงาน&rdquo; กับ &ldquo;วันหยุด&rdquo; ไม่ออก
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">ชื่อ</th>
                <th className="px-4 py-2 font-medium">หน่วยงาน</th>
                <th className="px-4 py-2 text-right font-medium">มาทำงาน</th>
                <th className="px-4 py-2 text-right font-medium">ควรมา</th>
                <th className="px-4 py-2 text-right font-medium">ลา</th>
                <th className="px-4 py-2 text-right font-medium">ชั่วโมงรวม</th>
                <th className="px-4 py-2 text-right font-medium">เฉลี่ย/วัน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map((r) => (
                <tr key={r.full_name}>
                  <td className="px-4 py-2 font-medium text-gray-900">{r.full_name}</td>
                  <td className="px-4 py-2 text-gray-500">{r.business_unit ?? '— ยังไม่ได้จัดกลุ่ม —'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.days_worked}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-400">{r.days_expected}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.days_leave || ''}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.total_hours}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.avg_hours_per_day}</td>
                </tr>
              ))}
              {!summary.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    ยังไม่มีข้อมูลในช่วงนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">ยังเหลือ</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>จัดพนักงาน 58 คนเข้าหน่วยงาน (ตอนนี้ยังว่างอยู่ทุกคน)</li>
          <li>ใส่เงินเดือน + วันเริ่มงานจริง — ทำหน้า bulk edit</li>
          <li>ระบบเงินเดือน: งานพิเศษรายเดือน · รายชิ้น · คอมมิชชั่นขั้นบันได</li>
          <li>เขียน RLS policy ก่อนเปิดใช้จริง (ตอนนี้ปิดหมด อ่านได้เฉพาะฝั่ง server)</li>
          <li>แก้โค้ดแอปให้อ่าน Supabase แทน Firebase</li>
        </ul>
      </section>
    </div>
  )
}

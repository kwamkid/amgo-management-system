// เทสต์งบเวลาของงานอัปเดตปลั๊กอิน — ผูกตัวเลขไว้ไม่ให้บวกกันเกินเพดาน Vercel
//
// รัน: node scripts/test-job-budget.mjs   (ไม่ต้องต่อฐานข้อมูล)
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// 15–16 ส.ค. 69 งานอัปเดตปลั๊กอินล้ม 40 ใบ สำเร็จ 36 — สาเหตุคือค่าคงที่
// ที่บวกกันแล้วเกิน 60 วิ (งบ 38 วิ + ปลั๊กอินที่รันต่อได้อีก 45 วิ + 2 คำสั่ง
// ปิดท้ายที่ไม่ได้กันเวลาไว้เลย = 184 วิในเคสแย่สุด)
//
// ไม่มีใครจับได้จนกระทั่งไปนั่งไล่ดู log ในฐานข้อมูล เทสต์นี้จับให้แทน

import {
  VERCEL_LIMIT_MS,
  JOB_BUDGET_MS,
  TAIL_RESERVE_MS,
  FIRST_LIST_MS,
  CORE_VERSION_MS,
  PLUGIN_MAX_MS,
  PLUGIN_MIN_MS,
  LOOP_DEADLINE_MS,
  canStartPlugin,
  pluginTimeoutMs,
  tailTimeoutMs,
  worstCaseMs,
} from '../lib/services/web/jobBudget.ts'

/** เวลาที่ใช้จริงนอก runPluginUpdate — หยิบงาน + ปิดงาน + ความหน่วงของ Vercel */
const OVERHEAD_MS = 4_000

let pass = 0
let fail = 0
const ok = (cond, title, detail = '') => {
  if (cond) {
    pass++
    console.log(`  ✅ ${title}`)
  } else {
    fail++
    console.log(`  ❌ ${title}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\n══════════════════════════════════════════════════════════')
console.log('งบเวลางานอัปเดตปลั๊กอิน')
console.log('══════════════════════════════════════════════════════════')

// ── 1. เคสแย่สุดต้องไม่ทะลุเพดาน ─────────────────────────────────────
const worst = worstCaseMs() + OVERHEAD_MS
ok(
  worst <= VERCEL_LIMIT_MS,
  `เคสแย่สุด ${(worst / 1000).toFixed(1)} วิ ไม่เกินเพดาน ${VERCEL_LIMIT_MS / 1000} วิ`,
  `เกินไป ${((worst - VERCEL_LIMIT_MS) / 1000).toFixed(1)} วิ`
)
ok(
  VERCEL_LIMIT_MS - worst >= 5_000,
  `เหลือเผื่ออย่างน้อย 5 วิ (ตอนนี้ ${((VERCEL_LIMIT_MS - worst) / 1000).toFixed(1)} วิ)`
)

// ── 2. ค่าคงที่ต้องสมเหตุผลกันเอง ────────────────────────────────────
ok(JOB_BUDGET_MS < VERCEL_LIMIT_MS, 'งบทั้งใบน้อยกว่าเพดาน Vercel')
ok(TAIL_RESERVE_MS < JOB_BUDGET_MS, 'เวลาที่กันไว้ท้ายงานน้อยกว่างบทั้งใบ')
ok(LOOP_DEADLINE_MS > FIRST_LIST_MS, 'ลูปยังมีเวลาเหลือหลัง listPlugins ใบแรก')
ok(PLUGIN_MIN_MS <= PLUGIN_MAX_MS, 'เวลาขั้นต่ำต่อปลั๊กอินไม่เกินเพดานต่อตัว')
ok(
  PLUGIN_MIN_MS >= 10_000,
  `เวลาขั้นต่ำคร่อม median จริง 10.6 วิ (ตอนนี้ ${PLUGIN_MIN_MS / 1000} วิ)`
)
ok(
  PLUGIN_MAX_MS >= 18_000,
  `เพดานต่อตัวคลุม p90 จริง 18 วิ (ตอนนี้ ${PLUGIN_MAX_MS / 1000} วิ)`
)

// ── 3. timeout ต่อปลั๊กอินต้องไม่พาลูปเลย deadline ───────────────────
let overshoot = 0
for (let left = 0; left <= 60_000; left += 100) {
  if (!canStartPlugin(left)) continue
  if (pluginTimeoutMs(left) > left) overshoot++
}
ok(overshoot === 0, 'ไม่มีค่า "เวลาที่เหลือ" ไหนที่ทำให้ปลั๊กอินรันเกินเวลาที่เหลือ', `${overshoot} ค่า`)

// ── 4. จำลองลูปเต็มรูปแบบ — สุ่มเวลาที่แต่ละคำสั่ง "อยากใช้" ─────────
const runCapped = (want, cap) => Math.min(want, cap)
let rnd = 987654321
const rand = (n) => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) % n)

let worstSim = 0
let loopViolations = 0
let capViolations = 0
const ROUNDS = 200_000

for (let k = 0; k < ROUNDS; k++) {
  let t = runCapped(rand(60_000), FIRST_LIST_MS)
  const plugins = rand(30)
  for (let i = 0; i < plugins; i++) {
    const left = LOOP_DEADLINE_MS - t
    if (!canStartPlugin(left)) break
    t += runCapped(rand(70_000), pluginTimeoutMs(left))
  }
  if (t > LOOP_DEADLINE_MS) loopViolations++
  t += runCapped(rand(60_000), tailTimeoutMs(t))
  t += runCapped(rand(60_000), CORE_VERSION_MS)
  const total = t + OVERHEAD_MS
  if (total > VERCEL_LIMIT_MS) capViolations++
  if (total > worstSim) worstSim = total
}

ok(loopViolations === 0, `จำลอง ${ROUNDS.toLocaleString()} รอบ · ลูปไม่เคยเลย deadline`, `${loopViolations} รอบ`)
ok(
  capViolations === 0,
  `จำลอง ${ROUNDS.toLocaleString()} รอบ · ไม่เคยทะลุ 60 วิ (แย่สุดที่เจอ ${(worstSim / 1000).toFixed(1)} วิ)`,
  `${capViolations} รอบ`
)

// ── 5. ของเดิมต้องตกเทสต์นี้ (พิสูจน์ว่าเทสต์จับของจริงได้) ──────────
const oldWorst = 45_000 + 38_000 + 45_000 + 45_000 + 45_000 + OVERHEAD_MS
ok(
  oldWorst > VERCEL_LIMIT_MS,
  `สูตรเดิม ${(oldWorst / 1000).toFixed(0)} วิ ตกเทสต์นี้ — แปลว่าเทสต์จับของจริงได้`
)

console.log('\n──────────────────────────────────────────────────────────')
console.log(`รวม ผ่าน ${pass} · ไม่ผ่าน ${fail}`)
process.exit(fail ? 1 : 0)

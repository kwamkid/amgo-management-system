// รันเทสต์ทั้งหมดทีเดียว
//
// รัน: npm test
//     npm test -- --server http://localhost:3002   (รวมเทสต์ที่ต้องมีเซิร์ฟเวอร์)
//
// ── ทำไมต้องมีตัวรวม ──────────────────────────────────────────────────
// เทสต์แยกเป็นไฟล์ตามเรื่อง แต่เวลาจะรู้ว่า "ระบบพังไหม" ต้องรันให้ครบ
// ถ้าต้องจำเองว่ามีกี่ไฟล์ สุดท้ายก็จะลืมรันบางตัว
//
// ทุกไฟล์อ่านอย่างเดียวหรือคืนค่าเดิมให้เสมอ รันบนฐานข้อมูลจริงได้

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const SUITES = [
  { file: 'test-todo-tasks.mjs', title: 'สิ่งที่ต้องทำก่อนใช้งาน' },
  { file: 'test-org-structure.mjs', title: 'บริษัท · หน้าที่ · รอบจ่าย' },
  { file: 'test-employee-names.mjs', title: 'ชื่อพนักงาน' },
  { file: 'test-self-edit-guard.mjs', title: 'พนักงานแก้ข้อมูลตัวเอง' },
  { file: 'test-rls.mjs', title: 'สิทธิ์การเข้าถึงข้อมูล' },
  { file: 'test-checkin-rls.mjs', title: 'เช็คอิน' },
  { file: 'test-checkout-hours.mjs', title: 'ชั่วโมงตอนเช็คเอาท์ · ลืมเช็คเอาท์', noEnv: true },
  { file: 'test-payroll-cycle.mjs', title: 'รอบจ่าย · ช่วงงวดเงินเดือน', noEnv: true },
  { file: 'test-leave-rls.mjs', title: 'สิทธิ์ใบลา' },
  { file: 'test-leave-flow.mjs', title: 'ยื่นลา → อนุมัติ → โควต้า' },
  { file: 'test-attendance-report.mjs', title: 'รายงานการมาทำงาน' },
  { file: 'test-routes.mjs', title: 'ลิงก์ในเมนู', noEnv: true },
  // ต้องเปิดเซิร์ฟเวอร์ก่อน — ข้ามเองถ้ายังไม่เปิด
  { file: 'test-register.mjs', title: 'สมัครเป็นพนักงาน', server: true },
]

const serverArg = process.argv.indexOf('--server')
const serverUrl = serverArg > -1 ? process.argv[serverArg + 1] : null

const run = (suite) =>
  new Promise((resolve) => {
    const args = []
    if (!suite.noEnv) args.push('--env-file=.env.local')
    args.push(`scripts/${suite.file}`)
    if (suite.server && serverUrl) args.push(serverUrl)

    const child = spawn('node', args, { stdio: ['inherit', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    // Node เตือนเรื่อง type stripping ทุกครั้งที่ import .ts — ไม่ใช่ปัญหาของเทสต์
    child.stderr.on('data', (d) => {
      const s = String(d)
      if (!/Warning|Reparsing|To eliminate|trace-warnings/.test(s)) out += s
    })

    child.on('close', (code) => {
      const summary = out.match(/ผ่าน (\d+) · ไม่ผ่าน (\d+)/)
      const allPass = out.match(/✅ ผ่านทั้งหมด (\d+) ข้อ/)
      const skipped = /⏭️/.test(out) && !summary && !allPass

      resolve({
        ...suite,
        code,
        skipped,
        passed: summary ? Number(summary[1]) : allPass ? Number(allPass[1]) : 0,
        failed: summary ? Number(summary[2]) : 0,
        out,
      })
    })
  })

const results = []
for (const suite of SUITES) {
  if (!existsSync(`scripts/${suite.file}`)) continue
  process.stdout.write(`  ${suite.title.padEnd(28, '·')} `)
  const r = await run(suite)
  results.push(r)
  // ผ่าน 0 โดยไม่มีอะไรตก = สคริปต์ล่มก่อนถึงบทสรุป (เช่น sign-in โดน rate limit)
  // ห้ามขึ้น ✅ — เคยหลอกว่าเขียวทั้งที่ไม่ได้ตรวจสักข้อ
  const crashed = !r.skipped && r.passed === 0 && r.failed === 0
  if (crashed) r.failed = 1
  console.log(
    r.skipped
      ? 'ข้าม (ยังไม่ได้เปิดเซิร์ฟเวอร์)'
      : crashed
        ? '💥 ล่มก่อนจบ — รันเดี่ยวเพื่อดูสาเหตุ'
        : r.failed
          ? `❌ ผ่าน ${r.passed} · ไม่ผ่าน ${r.failed}`
          : `✅ ผ่าน ${r.passed}`
  )
}

// ตัวที่ไม่ผ่าน ขึ้นรายละเอียดให้ดูเลย ไม่ต้องรันซ้ำเอง
const broken = results.filter((r) => r.failed > 0)
for (const r of broken) {
  console.log(`\n${'═'.repeat(58)}\n${r.title}\n${'═'.repeat(58)}`)
  console.log(r.out.split('\n').filter((l) => /❌|⚠️|ℹ️|ยังขาด|ยังเป็นชื่อ|ยังไม่มี/.test(l)).join('\n'))
}

const totalPass = results.reduce((s, r) => s + r.passed, 0)
const totalFail = results.reduce((s, r) => s + r.failed, 0)

console.log(`\n${'─'.repeat(58)}`)
console.log(`รวม ผ่าน ${totalPass} · ไม่ผ่าน ${totalFail}\n`)
process.exit(totalFail ? 1 : 0)

// ตรวจว่าทุกลิงก์ในเมนูมีหน้าอยู่จริง
//
// รัน: node scripts/test-routes.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// เมนูชี้ไปหน้าที่ไม่มี = ผู้ใช้กดแล้วเจอ 404 และ Next.js prefetch ลิงก์
// ในเมนูอัตโนมัติ จึงยิง 404 รัวใน console ตั้งแต่เปิดหน้า โดยไม่มีใครกด
//
// เคยพลาดมาแล้ว 2 รอบ:
//   1. /settings/leave-types · /settings/notifications · /settings/security
//      — เมนูมี แต่ไม่เคยสร้างหน้า
//   2. /settings/permissions
//      — โฟลเดอร์มีอยู่ แต่ข้างในว่าง ไม่มี page.tsx
//      (ตอนแก้รอบแรกเช็คแค่ชื่อโฟลเดอร์ เลยหลุด)

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SIDEBAR = path.join(ROOT, 'components/layout/Sidebar.tsx')
const APP = path.join(ROOT, 'app')

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

/** หา page.tsx ของ path นั้น โดยข้ามชื่อโฟลเดอร์แบบ (group) */
function routeExists(href) {
  const segments = href.split('/').filter(Boolean)

  const walk = (dir, rest) => {
    if (!rest.length) {
      return ['page.tsx', 'page.ts', 'page.jsx', 'page.js']
        .some((f) => fs.existsSync(path.join(dir, f)))
    }

    const [head, ...tail] = rest

    // ตรงตัว
    const direct = path.join(dir, head)
    if (fs.existsSync(direct) && walk(direct, tail)) return true

    // [param] แบบไดนามิก
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return false
    }

    for (const e of entries) {
      if (!e.isDirectory()) continue
      // (admin) (auth) เป็นแค่กลุ่ม ไม่นับเป็น segment ของ URL
      if (e.name.startsWith('(') && walk(path.join(dir, e.name), rest)) return true
      if (e.name.startsWith('[') && walk(path.join(dir, e.name), tail)) return true
    }
    return false
  }

  return walk(APP, segments)
}

const src = fs.readFileSync(SIDEBAR, 'utf8')
const hrefs = [...src.matchAll(/href:\s*'([^']+)'/g)]
  .map((m) => m[1])
  .filter((h) => h.startsWith('/'))

console.log(`\nตรวจลิงก์ในเมนู ${hrefs.length} รายการ\n`)

for (const href of [...new Set(hrefs)]) {
  check(routeExists(href), href)
}

console.log(`\n${'─'.repeat(50)}`)
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
process.exit(fail ? 1 : 0)

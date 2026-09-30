// ทดสอบกติกาใบเบิกค่าใช้จ่าย — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
//
// รัน: node scripts/test-expense-rules.mjs
//
// กติกาเจ้าของ 30 ก.ย. 69: ต้องแนบรูปใบเสร็จทุกใบ ไม่มีวงเงิน (ไม่มีใบเสร็จ =
// เขียนเหตุผลแทน) · รวมเงินเดือน = เข้างวดที่วันอนุมัติตกอยู่ ซึ่งยังไม่ตัดยอด

import { checkExpense, payrollMonthFor } from '../lib/services/expenseRules.ts'

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

const TODAY = '2026-09-30'
const ok = (o) =>
  checkExpense({ expenseDate: '2026-09-29', category: 'travel', description: 'ค่าแท็กซี่ไปบูธ', amount: 250,
                 receiptCount: 1, noReceiptReason: '', ...o }, TODAY)

console.log('\n1) ยื่นได้')
check(ok({}) === null, 'มีใบเสร็จ 1 รูป ผ่าน', ok({}) ?? '')
check(ok({ receiptCount: 0, noReceiptReason: 'วินไม่มีใบเสร็จ' }) === null, 'ไม่มีใบเสร็จแต่บอกเหตุผล ผ่าน')
check(ok({ amount: 125000 }) === null, 'ไม่มีวงเงิน — 125,000 ผ่าน')
check(ok({ amount: 0.29 }) === null, 'ทศนิยม 2 ตำแหน่ง (0.29) ผ่าน — ไม่โดนเศษทศนิยมฐานสอง')
check(ok({ expenseDate: TODAY }) === null, 'จ่ายวันนี้ ผ่าน')

console.log('\n2) ยื่นไม่ได้')
check(!!ok({ receiptCount: 0, noReceiptReason: '  ' }), 'ไม่มีใบเสร็จและไม่บอกเหตุผล', ok({ receiptCount: 0, noReceiptReason: ' ' }) ?? '')
check(!!ok({ amount: 0 }), 'ยอด 0')
check(!!ok({ amount: -50 }), 'ยอดติดลบ')
check(!!ok({ amount: 10.555 }), 'ทศนิยม 3 ตำแหน่ง')
check(!!ok({ expenseDate: '2026-10-01' }), 'วันที่ในอนาคต')
check(!!ok({ description: '   ' }), 'ไม่บอกว่าจ่ายค่าอะไร')
check(!!ok({ category: 'gift' }), 'ประเภทไม่มีในรายการ')

console.log('\n3) รวมเงินเดือนเข้างวดไหน')
const D = (s) => new Date(`${s}T12:00:00`)
check(payrollMonthFor('c28', D('2026-09-20')) === '2026-09-01', 'c28 อนุมัติ 20 ก.ย. → งวด ก.ย. (26 ส.ค.–25 ก.ย.)', payrollMonthFor('c28', D('2026-09-20')))
check(payrollMonthFor('c28', D('2026-09-26')) === '2026-10-01', 'c28 อนุมัติ 26 ก.ย. (ตัดยอดแล้ว) → งวด ต.ค.', payrollMonthFor('c28', D('2026-09-26')))
check(payrollMonthFor('c28', D('2026-09-25')) === '2026-09-01', 'c28 อนุมัติวันตัดยอด → ยังเข้างวด ก.ย.', payrollMonthFor('c28', D('2026-09-25')))
check(payrollMonthFor('c4', D('2026-09-30')) === '2026-09-01', 'c4 อนุมัติ 30 ก.ย. → งวด ก.ย.', payrollMonthFor('c4', D('2026-09-30')))
check(payrollMonthFor('c4', D('2026-10-01')) === '2026-10-01', 'c4 อนุมัติ 1 ต.ค. → งวด ต.ค.', payrollMonthFor('c4', D('2026-10-01')))

console.log(`\n${'─'.repeat(50)}`)
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
process.exit(fail ? 1 : 0)

// ทดสอบกติกาใบเบิกค่าใช้จ่าย — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
//
// รัน: node scripts/test-expense-rules.mjs
//
// กติกาเจ้าของ 30 ก.ย. 69: ต้องแนบรูปใบเสร็จทุกใบ ไม่มีวงเงิน (ไม่มีใบเสร็จ =
// เขียนเหตุผลแทน) · รวมเงินเดือน = เข้างวดที่วันอนุมัติตกอยู่ ซึ่งยังไม่ตัดยอด

import { checkExpense, formSectionOf, guessSection, payrollMonthFor, suggestSection, vatIncluded } from '../lib/services/expenseRules.ts'
import { buildScbFile, buildTransferLines, isScbAccount, scbText } from '../lib/services/bankTransferFile.ts'

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

console.log('\n4) จ่าย supplier (3 พ.ย. 69)')
const sup = (o) => ok({ kind: 'supplier', category: 'other', description: 'ค่าผลิตโปสเตอร์', amount: 5350,
  payeeName: 'บจก. ปริ้นท์ดี', payeeBank: 'KBANK', payeeAccountNo: '123-4-56789-0', ...o })
check(sup({}) === null, 'ครบ ผ่าน (เลขบัญชีมีขีดได้)', sup({}) ?? '')
check(!!sup({ receiptCount: 0, noReceiptReason: 'ไม่มี' }), 'ไม่แนบใบแจ้งหนี้ ไม่ผ่าน (supplier ใช้ "ไม่มีใบเสร็จ" ไม่ได้)')
check(!!sup({ payeeName: ' ' }), 'ไม่มีชื่อบัญชี')
check(!!sup({ payeeBank: '' }), 'ไม่เลือกธนาคาร')
check(!!sup({ payeeAccountNo: '12345' }), 'เลขบัญชีสั้นเกิน')

console.log('\n5) VAT')
check(vatIncluded(107) === 7, 'VAT ในยอด 107 = 7', String(vatIncluded(107)))
check(vatIncluded(5350) === 350, 'VAT ในยอด 5,350 = 350', String(vatIncluded(5350)))
check(!!ok({ vatAmount: 250 }), 'VAT เท่ายอดรวม ไม่ผ่าน')
check(ok({ vatAmount: 16.36 }) === null, 'VAT น้อยกว่ายอด ผ่าน')

console.log('\n6) ลงช่องไหนของฟอร์ม EXPENSES REIMBURSEMENT')
check(formSectionOf('travel', 0) === 'taxi', 'travel → (1) Taxi')
check(formSectionOf('parking', 0) === 'toll', 'parking → (2) ทางด่วน/จอด')
check(formSectionOf('fuel', 33) === 'gas', 'fuel มี VAT ก็ยังอยู่ (3) Gasoline')
check(formSectionOf('meal', 0) === 'entertain', 'meal → (B) Entertainment')
check(formSectionOf('phone', 0) === 'phone', 'phone → (C) Telephone')
check(formSectionOf('supplies', 0) === 'other', 'supplies ไม่มี VAT → (D) Others')
check(formSectionOf('supplies', 7) === 'other_vat', 'supplies มี VAT → (E) Others Vat 7%')

console.log('\n7) ไฟล์โอน SCB (รูปแบบ CPX Toolkit 1.1.2)')
// เลขบัญชีจริงจาก template ของบัญชี — ผ่าน check digit ของ toolkit ทุกเลข
for (const a of ['4240230419', '2502167033', '0222828056', '4024292552', '1752622099', '0384699741'])
  check(isScbAccount(a), `เลขบัญชี SCB ${a} ผ่าน check digit`)
check(!isScbAccount('0384699742'), 'หลักสุดท้ายผิด ไม่ผ่าน')
check(!isScbAccount('038469974'), '9 หลัก ไม่ผ่าน')

const emp = (id, amount, o = {}) => ({ id, kind: 'reimburse', amount, description: `ใบ ${id}`,
  ownerFullName: 'สมหญิง ใจดี', bankName: 'SCB', bankAccountNo: '424-023041-9', ...o })
const { lines, problems } = buildTransferLines([
  emp('a', 100.1), emp('b', 200.2),
  { id: 's', kind: 'supplier', amount: 5350, description: 'โปสเตอร์ #BBB 65 (50%)', payeeName: 'บจก. ปริ้นท์ดี', payeeBank: 'SCB', payeeAccountNo: '2502167033' },
  emp('x', 50, { bankName: null }),
  emp('y', 50, { bankAccountNo: '4240230418' }),
  { id: 'k', kind: 'supplier', amount: 10, description: 'x', payeeName: 'ร้าน', payeeBank: 'KBANK', payeeAccountNo: '1234567890' },
])
check(lines.length === 2, 'บัญชีเดียวกันรวมเป็นบรรทัดเดียว (3 ใบ → 2 บรรทัด)', String(lines.length))
check(lines[0].amount === 300.3 && lines[0].claimIds.length === 2, '100.1 + 200.2 = 300.3 ไม่มีเศษเพี้ยน', String(lines[0].amount))
check(lines[0].accountNo === '4240230419' && lines[0].bankClearing === '014', 'เลขบัญชีตัวเลขล้วน · SCB = 014')
check(lines[1].reference === 'โปสเตอร์ BBB 65 (50)', 'หมายเหตุตัดอักขระที่ toolkit ห้าม (# %) ออก', lines[1].reference)
check(problems.map((p) => p.claimId).join() === 'x,y,k', 'ไม่มีธนาคาร · check digit ผิด · ธนาคารอื่น → ไม่ใส่ไฟล์ แจ้งกลับ', JSON.stringify(problems))
check(scbText(' บจก. A&B_C ', 140) === 'บจก. A B C', 'ชื่อผู้รับ: ตัด & _ และช่องว่างหน้า', scbText(' บจก. A&B_C ', 140))

const now = new Date(2026, 10, 3, 14, 5, 9) // 3 พ.ย. 2026 14:05:09
const file = buildScbFile({ lines, product: 'OAT', debitAccount: '038-4-69974-1', valueDate: '2026-11-03', now })
const want = [
  'HEADER|031126140509OAT',
  'BCHDET|031126140509|OAT|20261103|0384699741|0384699741|5650.30|2||',
  'TXNDET||4240230419||014|0111|300.30||BEN|N||N||สมหญิง ใจดี||||N|||N|N||||N||2 รายการ',
  'TXNDET||2502167033||014|0111|5350.00||BEN|N||N||บจก. ปริ้นท์ดี||||N|||N|N||||N||โปสเตอร์ BBB 65 (50)',
  'TRAILR|1|2|5650.30',
].join('\r\n')
check(file.content === want, 'เนื้อไฟล์ตรงรูปแบบ toolkit ทุกบรรทัด (CRLF · 28 ช่องต่อรายการ)', file.content === want ? '' : JSON.stringify(file.content))
check(file.content.split('\r\n')[2].split('|').length === 28, 'TXNDET มี 28 ช่อง')
check(file.content.split('\r\n')[1].split('|').length === 10, 'BCHDET มี 10 ช่อง')
check(file.filename === 'SCB_file_reference_031126140509.txt', 'ชื่อไฟล์แบบ toolkit', file.filename)
let err = ''
try { buildScbFile({ lines, product: 'OAT', debitAccount: '0384699742', valueDate: '2026-11-03', now }) } catch (e) { err = e.message }
check(!!err, 'บัญชีตัดเงิน check digit ผิด → ไม่สร้างไฟล์', err)
err = ''
try { buildScbFile({ lines, product: 'OAT', debitAccount: '0384699741', valueDate: '2026-11-02', now }) } catch (e) { err = e.message }
check(!!err, 'วันที่มีผลย้อนหลัง → ไม่สร้างไฟล์', err)

console.log('\n8) เดาหมวดจากรายละเอียด (กติกาจากประวัติ Reimbursement.xlsx — แม่น 90% กับ 1,218 รายการเดิม)')
const G = [
  ['ค่ารถไปเก็บแฟร์อัมรินทร์', 'taxi'], ['ค่าแทกซี่กลับพระราม2', 'taxi'], ['ค่าบีทีเอสจากบ้าน - ไอคอนสยาม', 'taxi'],
  ['ค่าเดิินทางไปซื้อผ้าที่โลตัส', 'taxi'], ['น้ำ+แป้งหมี่ ไปนับสต็อก QD', 'taxi'], ['ค่ารถกลับจากแฟร์ (รวมทางด่วน)', 'taxi'],
  ['ค่าทางด่วนจากห้องไปพระราม2', 'toll'], ['อีซีพาส', 'toll'], ['ค่่าจอดรถ ใกล้สาขา พาราก้อน', 'toll'],
  ['ค่าน้ำมันขนของไปจัดดิสเพลย์', 'gas'], ['ค่าน้ำมัน 31.26L. 282km.', 'gas'],
  ['ค่าข้าวแฟร์ 26 กล่อง', 'entertain'], ['ค่าน้ำแพ็ค 3 แพ็ค', 'entertain'], ['เค้กวันเกิดโฟน', 'entertain'],
  ['ค่าโทรศัพท์ของเครื่องรูดบัตร 2 เครื่อง', 'phone'],
  ['ฟิวเจอร์บอร์ดจัดแฟร์ อัมรินทร์', 'other'], ['ค่าลาล่าไปตั้งบูธที่เมกะ', 'other'], ['ค่าส่งพัสดุจากวังเด็ก', 'other'],
  ['ค่าน้ำโกดัง', 'other'], ['ค่าตั๋วเครื่องบิน ไป-กลับ อุดร', 'other'],
]
for (const [d, want] of G) check(guessSection(d) === want, `"${d}" → ${want}`, guessSection(d))
check(guessSection('อุปกรณ์สำนักงาน office Mate', true) === 'other_vat', 'อื่นๆ ที่มี VAT → other_vat')
const hist = [{ description: 'ค่าเช่าบูธงาน BBB 65', section: 'other' }, { description: 'ไกด์ ร้านวังเด็ก', section: 'entertain' }]
check(suggestSection('ค่าเช่าบูธงาน BBB 66', hist)?.from === 'history', 'รายละเอียดคล้ายใบเก่า → ใช้หมวดของใบเก่า')
check(suggestSection('ไกด์ ร้านวังเด็ก', hist)?.section === 'entertain', 'ตรงใบเก่าเป๊ะ ชนะกติกาคำ')
check(suggestSection('ค่าแท็กซี่ไปสยาม', hist)?.from === 'words', 'ไม่มีใบเก่าคล้าย → ใช้กติกาคำ')
check(suggestSection('ab', hist) === null, 'สั้นเกิน ยังไม่เดา')

console.log(`\n${'─'.repeat(50)}`)
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
process.exit(fail ? 1 : 0)

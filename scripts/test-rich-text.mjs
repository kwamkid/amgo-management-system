// scripts/test-rich-text.mjs — ข้อความมีรูปแบบ: กันสคริปต์ · ข้อความเก่า · แปลงเป็นตัวหนังสือ (ไม่แตะฐานข้อมูล)
import assert from 'node:assert/strict'
import { sanitizeRichText, richTextToPlain, isRichTextEmpty } from '../lib/utils/richText.ts'

let pass = 0
const check = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${e.message}`)
    process.exitCode = 1
  }
}

check('เก็บแท็กที่อนุญาต ตัด attribute ทิ้ง', () => {
  assert.equal(sanitizeRichText('<b onclick="x()">หนา</b> <u style="a">เส้น</u>'), '<b>หนา</b> <u>เส้น</u>')
  assert.equal(sanitizeRichText('<ul><li>หนึ่ง</li><li>สอง</li></ul>'), '<ul><li>หนึ่ง</li><li>สอง</li></ul>')
})

check('script / iframe / แท็กแปลก ๆ หายหมด', () => {
  assert.equal(sanitizeRichText('<b>ok</b><script>alert(1)</script>'), '<b>ok</b>')
  assert.equal(sanitizeRichText('<b>a</b><img src=x onerror=alert(1)><a href="javascript:x">ลิงก์</a>'), '<b>a</b>ลิงก์')
  assert.equal(sanitizeRichText('<div><iframe src="//evil"></iframe>ข้อความ</div>'), '<div>ข้อความ</div>')
})

check('ข้อความเก่า (ตัวหนังสือล้วน) — escape แล้วขึ้นบรรทัดตาม \\n', () => {
  assert.equal(sanitizeRichText('บรรทัด 1\nราคา < 500 & ส่งฟรี'), 'บรรทัด 1<br>ราคา &lt; 500 &amp; ส่งฟรี')
})

check('แปลงเป็นตัวหนังสือล้วน (บอท/ค้นหา)', () => {
  assert.equal(richTextToPlain('<b>โทร</b>หาพี่ตุ้ม<ul><li>ขอราคา</li><li>ขอแคตตาล็อก</li></ul>'), 'โทรหาพี่ตุ้ม\n• ขอราคา\n• ขอแคตตาล็อก')
  assert.equal(richTextToPlain('ข้อความธรรมดา'), 'ข้อความธรรมดา')
})

check('ลบหมดแล้วเหลือแท็กเปล่า = ว่าง', () => {
  assert.equal(isRichTextEmpty('<div><br></div>'), true)
  assert.equal(isRichTextEmpty('<b>x</b>'), false)
})

console.log(`\n${pass} ผ่าน`)

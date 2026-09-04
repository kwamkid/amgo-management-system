// สร้างไอคอน PWA จาก public/amgo-logo.svg → public/icons/
// ใช้: node scripts/generate-pwa-icons.mjs   (รันใหม่ทุกครั้งที่โลโก้เปลี่ยน แล้ว commit ผลลัพธ์)
//
// ── หน้าตาไอคอน ──
// พื้นส้มแบรนด์ + โลโก้ขาว (จรวดกลายเป็นสีส้มเพราะเป็นช่องโปร่งในตัวโลโก้)
// ไม่ใช้โลโก้ส้มบนพื้นขาว เพราะ iOS 18 ย้อมไอคอนพื้นขาวให้เข้มเองเมื่อหน้าจอโฮม
// เป็นโหมดมืด — พื้นสีอิ่มตัวรอดจากการย้อมนั้น (บทเรียนจาก aoocommerce)
//
// ── สัดส่วน ──
// ไฟล์ SVG มีขอบว่างรอบตัวโลโก้ — ตัดขอบ (trim) ก่อน แล้วค่อยคิดสัดส่วนจาก "ตัวโลโก้จริง"
// โลโก้ AMGO เป็นก้อนกลม ๆ มีหางล่างซ้าย ใกล้เคียงวงกลม จึงใส่ใน safe zone ของ
// maskable (วงกลม Ø80%) ได้ถึง ~0.74 · ไอคอน iOS เว้นขอบมากกว่านิดให้หายใจ
import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'fs'

const SRC = 'public/amgo-logo.svg'
const OUT = 'public/icons'
mkdirSync(OUT, { recursive: true })

const LOGO_SVG = readFileSync(SRC, 'utf8')
const LOGO_COLOR = '#f9a11b' // สีเดียวในไฟล์ต้นฉบับ
const BG = { r: 249, g: 161, b: 27, alpha: 1 } // = LOGO_COLOR

function recolored(color) {
  return Buffer.from(LOGO_SVG.replace(LOGO_COLOR, color), 'utf8')
}

async function logoPng(color, size) {
  // density สูงพอให้ราสเตอร์ก่อนย่อมีความละเอียดเกิน 512px (viewBox 300 @72dpi = 300px)
  return sharp(recolored(color), { density: 400 })
    .trim()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function icon(size, ratio, file) {
  const logo = await logoPng('#ffffff', Math.round(size * ratio))
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${file}`)
  console.log(`✓ ${file} (${size}x${size})`)
}

// badge บน status bar ของ Android — ต้องเป็นเงาขาวบนพื้นใส
async function badge(size, file) {
  const logo = await logoPng('#ffffff', Math.round(size * 0.9))
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${file}`)
  console.log(`✓ ${file} (badge ${size}x${size})`)
}

const PLAIN = 0.78    // purpose 'any' — แท็บ/หน้าต่างติดตั้ง/เดสก์ท็อป
const MASKABLE = 0.72 // ใน safe zone Ø80% พร้อมเผื่อหางล่างซ้าย
const APPLE = 0.70    // iOS ตัดมุมโค้งเองและไม่มี safe zone — เว้นขอบให้ดูเป็นไอคอน

await icon(192, PLAIN, 'icon-192.png')
await icon(512, PLAIN, 'icon-512.png')
await icon(512, MASKABLE, 'maskable-512.png')
await icon(180, APPLE, 'apple-touch-icon.png')
await badge(96, 'badge-96.png')
console.log('Done.')

// scripts/test-bot-images.mjs — API บอท: ย่อรูปเป็น JPEG · กันดึงลิงก์นอก Discord (ไม่แตะฐานข้อมูล/เน็ต)
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { toTaskJpeg, fetchDiscordImage } from '../lib/services/bot/botImages.ts'

let pass = 0
const check = async (name, fn) => {
  try {
    await fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${e.message}`)
    process.exitCode = 1
  }
}

await check('PNG ใหญ่ → JPEG ด้านยาว 1600 · เล็กกว่า 5 MB (bucket รับแค่นี้)', async () => {
  const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#f03d0e' } }).png().toBuffer()
  const j = await toTaskJpeg(png)
  const m = await sharp(j).metadata()
  assert.equal(m.format, 'jpeg')
  assert.equal(m.width, 1600)
  assert.equal(m.height, 1067)
  assert.ok(j.length < 5 * 1024 * 1024)
})

await check('รูปเล็กไม่ขยาย', async () => {
  const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#14532d' } }).png().toBuffer()
  assert.equal((await sharp(await toTaskJpeg(png)).metadata()).width, 400)
})

await check('ไม่ใช่รูป = null', async () => {
  assert.equal(await toTaskJpeg(Buffer.from('hello')), null)
})

await check('ดึงได้เฉพาะ https ของ Discord — กัน SSRF', async () => {
  for (const u of ['https://evil.example.com/a.png', 'http://cdn.discordapp.com/a.png', 'https://169.254.169.254/x', 'not a url'])
    assert.equal(typeof (await fetchDiscordImage(u)), 'string', u)
})

console.log(`\n${pass} ผ่าน`)

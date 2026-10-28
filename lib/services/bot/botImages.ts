// lib/services/bot/botImages.ts
//
// รูปของงานผ่าน API บอท — ที่เก็บเดียวกับหน้าเว็บ (bucket task-images · ตาราง task_images)
//
// บอทส่งรูปมาได้ 2 ทาง:
//   · JSON { url } — ลิงก์ไฟล์แนบใน Discord (ดึงจาก server เฉพาะโดเมน Discord — กัน SSRF)
//   · multipart/form-data  field "file" (หลายไฟล์ได้)
// ทุกรูปย่อเป็น JPEG ด้านยาว 1600px ด้วย sharp — ตรงกับหน้าเว็บ (bucket รับแค่ image/jpeg ≤ 5 MB)
// ทำใน request เลย (ไม่ลงคิว) เพราะบอทต้องได้ id รูปกลับไปตอบในแชท — จำกัดครั้งละ 5 รูป ~1–3 วิ
// ลำดับ: sort_order (รูปแรกของงาน = ปก) · รูปในรายการไทม์ไลน์เรียงแยกตาม update_id

import sharp from 'sharp'
import type { AdminDb } from './botApi'

const BUCKET = 'task-images'
/** ไฟล์ต้นฉบับใหญ่สุดที่ยอมรับ (ก่อนย่อ) */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024
/** โดเมนที่ server ยอมไปดึงรูป — ไฟล์แนบของ Discord เท่านั้น */
const ALLOWED_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net'])

export interface BotImage {
  id: string
  url: string | null
  /** null = รูปของงาน · มีค่า = รูปในรายการไทม์ไลน์นั้น */
  updateId: string | null
  /** รูปแรกของงาน = ปกบนการ์ด */
  cover?: true
  order: number
}

export async function listTaskImages(sb: AdminDb, taskId: string): Promise<BotImage[]> {
  const { data } = await sb
    .from('task_images')
    .select('id, path, update_id, sort_order')
    .eq('task_id', taskId)
    .order('sort_order')
    .order('created_at')
  const rows = data ?? []
  const urls = new Map<string, string>()
  if (rows.length) {
    // 1 ชั่วโมงพอให้บอทแนบลิงก์ตอบในแชท
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  const firstTaskImage = rows.find((r) => !r.update_id)?.id
  return rows.map((r) => ({
    id: r.id,
    url: urls.get(r.path) ?? null,
    updateId: r.update_id,
    ...(r.id === firstTaskImage ? { cover: true as const } : {}),
    order: r.sort_order,
  }))
}

/** ดึงรูปจากลิงก์ Discord — คืน error เป็นข้อความ (ให้ตอบ 400) */
export async function fetchDiscordImage(raw: unknown): Promise<Buffer | string> {
  let url: URL
  try {
    url = new URL(String(raw))
  } catch {
    return 'url ไม่ถูกต้อง'
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname))
    return 'รับเฉพาะลิงก์ไฟล์แนบของ Discord (cdn.discordapp.com / media.discordapp.net) — ไฟล์อื่นส่งแบบ multipart'
  const res = await fetch(url, { redirect: 'error' }).catch(() => null)
  if (!res?.ok) return `ดึงรูปไม่สำเร็จ (${res?.status ?? 'network'})`
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_SOURCE_BYTES) return 'รูปใหญ่เกิน 25 MB'
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.length > MAX_SOURCE_BYTES ? 'รูปใหญ่เกิน 25 MB' : buf
}

/** ย่อ + แปลง JPEG (หมุนตาม EXIF) — ไม่ใช่รูป = null */
export async function toTaskJpeg(input: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
  } catch {
    return null
  }
}

/** อัปโหลด + บันทึกแถว — ไม่ระบุลำดับ = ต่อท้าย */
export async function saveTaskImage(
  sb: AdminDb,
  taskId: string,
  jpeg: Buffer,
  createdBy: string,
  opts: { updateId?: string | null; sortOrder?: number } = {}
): Promise<string> {
  const path = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', upsert: false })
  if (upErr) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${upErr.message}`)
  const { data, error } = await sb
    .from('task_images')
    .insert({
      task_id: taskId,
      path,
      created_by: createdBy,
      update_id: opts.updateId ?? null,
      sort_order: opts.sortOrder ?? Date.now(),
    })
    .select('id')
    .single()
  if (error) {
    await sb.storage.from(BUCKET).remove([path])
    throw error
  }
  return data.id
}

/** ลบแถว + ไฟล์ */
export async function removeTaskImages(sb: AdminDb, rows: { id: string; path: string }[]): Promise<void> {
  if (!rows.length) return
  const { error } = await sb.from('task_images').delete().in('id', rows.map((r) => r.id))
  if (error) throw error
  await sb.storage.from(BUCKET).remove(rows.map((r) => r.path))
}

/**
 * รูปจาก request: JSON { url | urls[] } หรือ multipart "file" — คืน JPEG ที่ย่อแล้ว หรือข้อความ error
 * body JSON ที่อ่านไปแล้วส่งมาทาง json (อ่าน stream ซ้ำไม่ได้)
 */
export async function collectImages(
  source: { json?: Record<string, unknown> | null; form?: FormData | null },
  max = 5
): Promise<Buffer[] | string> {
  const raws: Buffer[] = []
  if (source.form) {
    const files = source.form.getAll('file').filter((f): f is File => typeof f !== 'string')
    for (const f of files) {
      if (f.size > MAX_SOURCE_BYTES) return `${f.name} ใหญ่เกิน 25 MB`
      raws.push(Buffer.from(await f.arrayBuffer()))
    }
  } else if (source.json) {
    const list = [source.json.url, ...(Array.isArray(source.json.urls) ? source.json.urls : [])].filter(Boolean)
    for (const u of list) {
      const r = await fetchDiscordImage(u)
      if (typeof r === 'string') return r
      raws.push(r)
    }
  }
  if (!raws.length) return 'ไม่มีรูป — ส่ง { "url": "<ลิงก์ไฟล์แนบ Discord>" } หรือ multipart field "file"'
  if (raws.length > max) return `ส่งได้ครั้งละไม่เกิน ${max} รูป`
  const out: Buffer[] = []
  for (const r of raws) {
    const j = await toTaskJpeg(r)
    if (!j) return 'ไฟล์นี้ไม่ใช่รูปที่อ่านได้ (รองรับ JPEG / PNG / WebP / GIF)'
    out.push(j)
  }
  return out
}

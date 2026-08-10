// app/api/avatar/[userId]/route.ts
//
// รูปโปรไฟล์พนักงาน — ที่อยู่เดียวที่หน้าจอต้องรู้จัก
//
// ── ปัญหาที่แก้ ────────────────────────────────────────────────────────
// ลิงก์รูปจาก LINE (profile.line-scdn.net) มีอายุจำกัด พอหมดอายุก็ 404
// ต่อให้ดึงลิงก์ใหม่ทุกครั้งที่ล็อกอินก็หมดอายุอีกอยู่ดี
// (เคสจริง: 44 จาก 46 คนรูปหายพร้อมกันหลังย้ายระบบ)
//
// ── วิธีแก้ ────────────────────────────────────────────────────────────
// ครั้งแรกที่มีคนเปิดดูรูปของใคร เราจะก๊อปรูปนั้นเก็บไว้ใน Supabase Storage
// แล้วครั้งต่อ ๆ ไปเสิร์ฟจากของเรา ไม่พึ่ง LINE อีก
//
// หน้าจอใช้ <img src="/api/avatar/{id}"> ได้เลย ไม่ต้องรู้ว่ารูปอยู่ที่ไหน
// และไม่ต้องคอยสร้าง signed URL ใหม่ทุก 7 วัน

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'

const BUCKET = 'avatars'

/** เก็บในเบราว์เซอร์ได้ 1 วัน — รูปโปรไฟล์ไม่ได้เปลี่ยนบ่อย */
const CACHE = 'private, max-age=86400'

/**
 * คนที่ไม่มีรูปก็ต้อง cache ผลว่า "ไม่มี" ด้วย
 * ไม่งั้นเบราว์เซอร์ยิงซ้ำทุกครั้งที่โหลดหน้า — ในหน้ารายชื่อ 46 คน
 * ที่รูปเสีย 6 คน กลายเป็นยิงเปล่า 6 ครั้งต่อการเปิดหน้า 1 ครั้ง
 * ตั้งสั้นหน่อย (1 ชม.) เผื่อเจ้าตัวล็อกอินใหม่แล้วรูปกลับมา
 */
const MISS_CACHE = 'private, max-age=3600'
const notFound = () =>
  new NextResponse(null, { status: 404, headers: { 'Cache-Control': MISS_CACHE } })

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // รูปพนักงานไม่ใช่ของสาธารณะ — ต้องล็อกอินก่อน
  const me = await getCurrentUser()
  if (!me) return new NextResponse(null, { status: 401 })

  const { userId } = await params
  const sb = createAdminClient()

  const { data: user } = await sb
    .from('users')
    .select('photo_url, line_picture_url')
    .eq('id', userId)
    .maybeSingle()

  if (!user) return notFound()

  // 1) มีสำเนาของเราแล้ว — เสิร์ฟเลย
  if (user.photo_url) {
    const { data } = await sb.storage.from(BUCKET).download(user.photo_url)
    if (data) {
      return new NextResponse(data, {
        headers: { 'Content-Type': data.type || 'image/jpeg', 'Cache-Control': CACHE },
      })
    }
    // ไฟล์หายไปจาก storage — ล้างค่าแล้วไปดึงจาก LINE ใหม่ข้างล่าง
    await sb.from('users').update({ photo_url: null }).eq('id', userId)
  }

  // 2) ยังไม่มีสำเนา — ดึงจาก LINE แล้วเก็บไว้
  const source = user.line_picture_url
  if (!source || !source.startsWith('http')) return notFound()

  try {
    const res = await fetch(source)
    if (!res.ok) return notFound()

    const buf = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const path = `${userId}/profile.jpg`

    const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType,
      upsert: true, // ทับของเดิมได้ เผื่อเจ้าตัวเปลี่ยนรูปใน LINE
    })

    if (!error) await sb.from('users').update({ photo_url: path }).eq('id', userId)
    else console.warn(`เก็บรูปโปรไฟล์ไม่สำเร็จ (${userId}):`, error.message)

    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': contentType, 'Cache-Control': CACHE },
    })
  } catch (err) {
    console.warn(`ดึงรูปจาก LINE ไม่สำเร็จ (${userId}):`, err)
    return notFound()
  }
}

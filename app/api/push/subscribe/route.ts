// app/api/push/subscribe/route.ts
//
// เก็บ/ถอน subscription ของอุปกรณ์นี้ — 1 แถวต่อเบราว์เซอร์ (unique ที่ endpoint)
// user_id = auth.uid() (users.id ตรงกับ auth.users.id) · ใช้ admin client เพราะ
// ตาราง push_subscriptions ไม่เปิด RLS ให้เขียนจากเบราว์เซอร์ตรง ๆ
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function currentUserId(): Promise<string | null> {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  return user?.id ?? null
}

// POST — บันทึก (upsert: เครื่องเดิม subscribe ซ้ำ = อัปเดตเจ้าของ/เวลาล่าสุด)
export async function POST(request: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const authKey = body?.keys?.auth
  if (!endpoint || !p256dh || !authKey || !/^https:\/\//.test(endpoint)) {
    return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 })
  }

  const { error } = await createAdminClient()
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth: authKey,
        user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )
  if (error) {
    console.error('[Push] บันทึก subscription ไม่สำเร็จ:', error.message)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

// DELETE — ยกเลิกของอุปกรณ์นี้ (ลบได้เฉพาะของตัวเอง)
export async function DELETE(request: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { endpoint?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (!body?.endpoint) return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })

  const { error } = await createAdminClient()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', userId)
  if (error) {
    console.error('[Push] ลบ subscription ไม่สำเร็จ:', error.message)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

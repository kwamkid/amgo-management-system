import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ valid: false, error: 'ไม่พบรหัส invite link' }, { status: 400 })
  }

  try {
    const snapshot = await adminDb
      .collection('inviteLinks')
      .where('code', '==', code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return NextResponse.json({ valid: false, error: 'ลิงก์ไม่ถูกต้องหรือถูกปิดใช้งานแล้ว' })
    }

    const doc = snapshot.docs[0]
    const data = doc.data()

    // Check expiry
    if (data.expiresAt) {
      const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
      if (expiresAt < new Date()) {
        return NextResponse.json({ valid: false, error: 'ลิงก์หมดอายุแล้ว' })
      }
    }

    // Check usage limit
    if (data.maxUses && data.usedCount >= data.maxUses) {
      return NextResponse.json({ valid: false, error: 'ลิงก์ถูกใช้งานครบจำนวนแล้ว' })
    }

    const link = {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      expiresAt: data.expiresAt?.toDate?.()?.toISOString() ?? data.expiresAt ?? null,
    }

    return NextResponse.json({ valid: true, link })
  } catch (error) {
    console.error('Invite validate error:', error)
    return NextResponse.json({ valid: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบลิงก์' }, { status: 500 })
  }
}

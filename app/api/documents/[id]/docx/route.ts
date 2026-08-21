// ดาวน์โหลดเอกสารเป็นไฟล์ Word (.docx)
//
// ทำฝั่งเซิร์ฟเวอร์เพราะต้องดึงไฟล์โลโก้มาฝังในไฟล์ Word ด้วย —
// ฝั่งเบราว์เซอร์ดึงข้ามโดเมนแล้วติด CORS ของ Supabase Storage
//
// ใช้ session ของผู้ใช้ (ไม่ใช่ service key) เพื่อให้ RLS ของตาราง documents
// เป็นตัวตัดสินว่าใครโหลดได้ — คนที่ไม่ใช่ HR จะได้ 404 เหมือนไม่มีเอกสารนี้

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { buildDocx } from '@/lib/documents/buildDocx'
import { fileNameOf, parseBody, type CompanyHead, type Signer } from '@/lib/documents/types'

export const maxDuration = 30

/** โลโก้โหลดไม่ได้ = ออกไฟล์ต่อโดยไม่มีโลโก้ ดีกว่าดาวน์โหลดไม่ได้ทั้งใบ */
async function fetchLogo(url: string | null): Promise<Buffer | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // docx รับ png/jpg/gif/bmp — ที่ระบบอัปโหลดไว้เป็น png ทั้งหมด
    return buf.length > 0 ? buf : null
  } catch {
    return null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!doc) {
    return NextResponse.json({ error: 'ไม่พบเอกสารนี้' }, { status: 404 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select(
      'id, code, name_th, name_en, address, phone, registration_no, branch_label, logo_url'
    )
    .eq('id', doc.company_id)
    .maybeSingle()

  const head = (company ?? null) as CompanyHead | null

  const buf = await buildDocx({
    company: head,
    logo: await fetchLogo(head?.logo_url ?? null),
    docNo: doc.doc_no ?? '',
    title: doc.title ?? '',
    period: doc.period ?? '',
    recipient: doc.recipient ?? '',
    // แปลข้อความเป็นบล็อกด้วย parseBody ตัวเดียวกับที่หน้าจอใช้ —
    // ไฟล์ Word กับตัวอย่างบนจอจึงเป็นผลของโค้ดชุดเดียวกัน ไม่มีทางต่างกัน
    body: parseBody(doc.body_text ?? ''),
    signers: (doc.signers ?? []) as Signer[],
    issuedAt: doc.issued_at ?? null,
  })

  const name = fileNameOf({ doc_no: doc.doc_no ?? '', title: doc.title ?? '' })

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // ชื่อไฟล์เป็นภาษาไทย ต้องใช้ filename* (RFC 5987) —
      // filename= เฉย ๆ รับได้แค่ ASCII เบราว์เซอร์จะได้ชื่อมั่ว
      'Content-Disposition': `attachment; filename="document.docx"; filename*=UTF-8''${encodeURIComponent(
        name + '.docx'
      )}`,
      'Cache-Control': 'no-store',
    },
  })
}

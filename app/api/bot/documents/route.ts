// GET /api/bot/documents — เอกสารที่ออกจากระบบ (หนังสือรับรอง ฯลฯ) · superadmin เท่านั้น (documents_read = can_view_all)
//   ?q=คำในชื่อ/เลขที่/ผู้รับ · status=draft|issued|… · limit=30 (สูงสุด 100)
//   ลิงก์ดูเอกสาร = /api/documents/:id บนเว็บ (ต้องล็อกอิน) — บอทส่งแค่รายการ
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, personName } from '@/lib/services/bot/botApi'

type DocRow = {
  id: string
  doc_no: string
  title: string
  period: string | null
  recipient: string | null
  status: string
  issued_at: string | null
  created_at: string
  company: { code: string; name_th: string } | null
  creator: { nickname: string | null; full_name: string } | null
}

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  if (caller.scope !== 'superadmin') return apiError(403, 'ดูเอกสารได้เฉพาะแอดมิน')
  const p = request.nextUrl.searchParams
  const limit = Math.min(Math.max(Number(p.get('limit')) || 30, 1), 100)

  let q = caller.sb
    .from('documents')
    .select(
      'id, doc_no, title, period, recipient, status, issued_at, created_at, ' +
        'company:companies!documents_company_id_fkey(code, name_th), creator:users!documents_created_by_fkey(nickname, full_name)',
    )
  const status = p.get('status')?.trim()
  if (status) q = q.eq('status', status)
  const text = p.get('q')?.trim().replace(/[%_\\,()]/g, ' ')
  if (text) q = q.or(`title.ilike.%${text}%,doc_no.ilike.%${text}%,recipient.ilike.%${text}%`)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) return apiError(500, error.message)

  const documents = ((data ?? []) as unknown as DocRow[]).map((d) => ({
    id: d.id,
    docNo: d.doc_no,
    title: d.title,
    period: d.period,
    recipient: d.recipient,
    status: d.status,
    issuedAt: d.issued_at,
    company: d.company?.code ?? null,
    createdBy: d.creator ? personName(d.creator) : null,
    createdAt: d.created_at,
  }))
  return apiJson({ documents, count: documents.length })
}

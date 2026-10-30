// บันทึกข้อมูลฉลาก (label_specs) ทีละหลายแถว — แถวที่ทุกช่องว่าง = ลบทิ้ง (กลับไปใช้ค่าชั้นบน)
import { NextRequest, NextResponse } from 'next/server'
import { SPEC_FIELDS, type SpecField } from '@/lib/labels/resolve'
import { labelGuard } from '@/lib/labels/server'

type In = { brand: string; scope: 'brand' | 'group' | 'product'; key: string } & Partial<Record<SpecField, unknown>>

const SIZE_RE = /^\d+(\.\d+)?x\d+(\.\d+)?$/

function clean(f: SpecField, v: unknown): string | number | boolean | null {
  if (v == null || v === '') return null
  // booleans keep false too: a lower layer may switch off what a higher one switched on
  if (f === 'show_license' || f === 'icon_03' || f === 'skip') return v === true || v === 'true'
  if (f === 'price') return Number.isFinite(+(v as number)) && +(v as number) >= 0 ? +(v as number) : null
  if (f === 'tis_type') return [1, 2, 3, 4, 5, 6].includes(+(v as number)) ? +(v as number) : null
  const s = String(v).trim().slice(0, 500)
  if (f === 'size') return SIZE_RE.test(s) ? s : null
  return s || null
}

export async function PUT(req: NextRequest) {
  const ctx = await labelGuard(true)
  if (ctx instanceof NextResponse) return ctx
  const { rows } = (await req.json()) as { rows: In[] }
  if (!Array.isArray(rows) || !rows.length || rows.length > 2000) return NextResponse.json({ error: 'rows' }, { status: 400 })

  const now = new Date().toISOString()
  const upserts: Record<string, unknown>[] = []
  const deletes: In[] = []
  for (const r of rows) {
    const brand = String(r.brand ?? '').trim().toLowerCase()
    const scope = r.scope
    const key = scope === 'brand' ? '' : String(r.key ?? '').trim()
    if (!brand || !['brand', 'group', 'product'].includes(scope) || (scope !== 'brand' && !key)) {
      return NextResponse.json({ error: `bad row ${brand}/${scope}/${key}` }, { status: 400 })
    }
    const row: Record<string, unknown> = { brand, scope, key, updated_at: now, updated_by: ctx.userId }
    for (const f of SPEC_FIELDS) row[f] = clean(f, r[f])
    if (SPEC_FIELDS.every((f) => row[f] == null)) deletes.push({ brand, scope, key })
    else upserts.push(row)
  }

  if (upserts.length) {
    const { error } = await ctx.sb.from('label_specs').upsert(upserts as never)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  for (const d of deletes) {
    const { error } = await ctx.sb.from('label_specs').delete().eq('brand', d.brand).eq('scope', d.scope).eq('key', d.key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, saved: upserts.length, cleared: deletes.length })
}

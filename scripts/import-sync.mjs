#!/usr/bin/env node
// Import module sync — local order-plan files ⇄ amgo (import_rounds / import_round_items).
//
//   node scripts/import-sync.mjs push <plan.json | round folder> [...]   file → amgo
//   node scripts/import-sync.mjs pull <plan.json | round folder> [...]   amgo → file (web-edited qty + status)
//   add --dry to print what would change without writing
//
// Field master (owner, 29 Oct 2026): qty = web, everything else = builder (plan.json).
//   push never overwrites a qty that was edited on the web (qty_edited_at set).
//   round status: taken from the file only when the round is created; after that the web owns it.
// Pictures: aoocommerce product image URL when barcode/code matches (no storage used);
//   otherwise the local picture is resized to webp and uploaded once to
//   import-images/<brand>/<code>.webp (keyed by brand + code, so later rounds reuse it).
// Keys: amgo from ./.env.local, aoocommerce from ~/aoocommerce/.env.local (AOO_ENV overrides).

import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const BUCKET = 'import-images'

async function readEnv(file) {
  const txt = await fs.readFile(file, 'utf8')
  return Object.fromEntries(
    txt.split('\n').map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, '')])
  )
}

const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
const int = (v) => (num(v) === null ? null : Math.round(Number(v)))

async function resolvePlan(arg) {
  const abs = path.resolve(arg)
  const st = await fs.stat(abs)
  return st.isDirectory() ? path.join(abs, 'plan.json') : abs
}

// ── aoocommerce: product picture by barcode / code ─────────────────────────
async function aooImages(brandNames) {
  const envFile = process.env.AOO_ENV || path.join(process.env.HOME, 'aoocommerce/.env.local')
  const env = await readEnv(envFile).catch(() => null)
  if (!env) {
    console.warn('  ! aoocommerce env not found — pictures from local files only')
    return new Map()
  }
  const aoo = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  const all = async (build) => {
    const out = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await build().range(from, from + 999)
      if (error) throw new Error(`aoo: ${error.message}`)
      out.push(...data)
      if (data.length < 1000) return out
    }
  }
  const brands = []
  for (const n of brandNames) {
    const { data } = await aoo.from('product_brands').select('id').ilike('name', n)
    brands.push(...(data ?? []).map((b) => b.id))
  }
  if (!brands.length) return new Map()
  const vars = await all(() =>
    aoo
      .from('products_with_variations')
      .select('product_id, variation_id, sku, barcode')
      .in('brand_id', brands)
      .is('variation_deleted_at', null)
  )
  const productIds = [...new Set(vars.map((v) => v.product_id))]
  const imgs = []
  for (let i = 0; i < productIds.length; i += 200) {
    imgs.push(
      ...(await all(() =>
        aoo
          .from('product_images')
          .select('product_id, variation_id, image_url, sort_order')
          .in('product_id', productIds.slice(i, i + 200))
          .order('sort_order', { ascending: true })
      ))
    )
  }
  // variation picture first, then the product's first picture
  const byVar = new Map()
  const byProduct = new Map()
  for (const im of imgs) {
    if (!im.image_url) continue
    if (im.variation_id && !byVar.has(im.variation_id)) byVar.set(im.variation_id, im.image_url)
    if (!im.variation_id && !byProduct.has(im.product_id)) byProduct.set(im.product_id, im.image_url)
  }
  const out = new Map()
  for (const v of vars) {
    const url = byVar.get(v.variation_id) ?? byProduct.get(v.product_id)
    if (!url) continue
    const sku = String(v.sku || '').trim().toUpperCase().replace(/^00-[A-Z]+-/, '')
    for (const k of [String(v.barcode || '').trim(), sku]) if (k && !out.has(k)) out.set(k, url)
  }
  return out
}

// ── push ───────────────────────────────────────────────────────────────────
async function push(sb, file, dry) {
  const dir = path.dirname(file)
  const slug = path.basename(dir)
  const plan = JSON.parse(await fs.readFile(file, 'utf8'))
  const { items = [], ...r } = plan
  const known = ['brand', 'sub', 'srpBrand', 'round', 'title', 'container', 'status', 'currency', 'fx', 'incoterm',
    'containers', 'overMonths', 'arrive', 'leadMonths', 'notes', 'updated']
  const extra = Object.fromEntries(Object.entries(r).filter(([k]) => !known.includes(k)))

  const { data: existing } = await sb.from('import_rounds').select('id, status').eq('slug', slug).maybeSingle()
  const roundRow = {
    slug,
    brand: r.brand,
    sub: r.sub || '',
    srp_brand: r.srpBrand ?? null,
    round: r.round,
    title: r.title || '',
    container: r.container ?? null,
    ...(existing ? {} : { status: r.status || 'draft' }),
    currency: r.currency || 'USD',
    fx: num(r.fx),
    incoterm: r.incoterm ?? null,
    containers: r.containers ?? {},
    over_months: num(r.overMonths),
    arrive: r.arrive || null,
    lead_months: num(r.leadMonths),
    notes: r.notes ?? null,
    extra,
  }

  // pictures
  const brandKey = slugify(r.srpBrand || r.sub || r.brand)
  const aoo = await aooImages([...new Set([r.brand, r.sub, r.srpBrand].filter(Boolean))])
  const { data: stored } = await sb.storage.from(BUCKET).list(brandKey, { limit: 10000 })
  const have = new Set((stored ?? []).map((o) => o.name))
  let fromAoo = 0
  let uploaded = 0
  let reused = 0
  let noPic = 0
  const imgOf = async (it) => {
    const hit = aoo.get(String(it.barcode || '').trim()) ?? aoo.get(String(it.code || '').trim().toUpperCase())
    if (hit) {
      fromAoo++
      return hit
    }
    const name = `${slugify(it.code)}.webp`
    const key = `${brandKey}/${name}`
    if (have.has(name)) {
      reused++
      return key
    }
    if (!it.img) {
      noPic++
      return null
    }
    // prefer the hi-res copy when the builder made one
    const base = path.basename(it.img)
    const candidates = [path.join(dir, 'img/hi', base), path.join(dir, it.img)]
    let src = null
    for (const c of candidates) if (await fs.stat(c).then(() => true, () => false)) { src = c; break }
    if (!src) {
      noPic++
      return null
    }
    if (!dry) {
      const buf = await sharp(src).rotate().resize(1000, 1000, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
      const { error } = await sb.storage.from(BUCKET).upload(key, buf, { contentType: 'image/webp', upsert: true })
      if (error) throw new Error(`upload ${key}: ${error.message}`)
      have.add(name)
    }
    uploaded++
    return key
  }

  if (dry) {
    for (const it of items) await imgOf(it)
    console.log(`  ${slug}: ${items.length} items · round ${existing ? 'update' : 'create'} · pictures aoo ${fromAoo} / upload ${uploaded} / reuse ${reused} / none ${noPic} (dry run)`)
    return
  }

  const { data: round, error: rErr } = await sb.from('import_rounds').upsert(roundRow, { onConflict: 'slug' }).select('id').single()
  if (rErr) throw new Error(`round ${slug}: ${rErr.message}`)

  const { data: cur, error: cErr } = await sb.from('import_round_items').select('code, qty, qty_edited_at').eq('round_id', round.id)
  if (cErr) throw cErr
  const webQty = new Map((cur ?? []).filter((c) => c.qty_edited_at).map((c) => [c.code, c.qty]))

  const rows = []
  for (const [i, it] of items.entries()) {
    rows.push({
      round_id: round.id,
      code: String(it.code),
      barcode: it.barcode || null,
      name: it.name || '',
      grp: it.group || null,
      sub: it.sub || null,
      channel: it.channel || null,
      tags: Array.isArray(it.tags) ? it.tags : [],
      remark: it.remark || null,
      img: await imgOf(it),
      fob: num(it.fob),
      srp: num(it.srp),
      our_price: num(it.ourPrice),
      our_price_src: it.ourPriceSrc || null,
      qty: webQty.has(String(it.code)) ? webQty.get(String(it.code)) : int(it.qty) ?? 0,
      suggested: int(it.suggested),
      note: it.note || null,
      blocked: it.blocked ? String(it.blocked) : null,
      case_pack: int(it.casePack),
      qty_pdq: int(it.qtyPdq),
      pdq_per_case: int(it.pdqPerCase),
      pdq_dim: it.pdqDim || null,
      ctn: it.ctn ?? null,
      cbm: num(it.cbm),
      nw: num(it.nw),
      gw: num(it.gw),
      stock: num(it.stock),
      incoming: num(it.incoming),
      avg: num(it.avg),
      sort: i,
    })
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('import_round_items').upsert(rows.slice(i, i + 500), { onConflict: 'round_id,code' })
    if (error) throw new Error(`items ${slug}: ${error.message}`)
  }
  const gone = (cur ?? []).map((c) => c.code).filter((c) => !rows.some((x) => x.code === c))
  if (gone.length) {
    const { error } = await sb.from('import_round_items').delete().eq('round_id', round.id).in('code', gone)
    if (error) throw error
  }
  console.log(
    `  ${slug}: ${rows.length} items${gone.length ? ` · removed ${gone.length}` : ''} · kept web qty ${webQty.size}` +
      ` · pictures aoo ${fromAoo} / uploaded ${uploaded} / reused ${reused} / none ${noPic}`
  )
}

// ── pull ───────────────────────────────────────────────────────────────────
async function pull(sb, file, dry) {
  const slug = path.basename(path.dirname(file))
  const { data: round, error } = await sb.from('import_rounds').select('id, status').eq('slug', slug).maybeSingle()
  if (error) throw error
  if (!round) return console.log(`  ${slug}: not in amgo yet — push first`)
  const { data: edited, error: e2 } = await sb
    .from('import_round_items')
    .select('code, qty')
    .eq('round_id', round.id)
    .not('qty_edited_at', 'is', null)
  if (e2) throw e2

  const plan = JSON.parse(await fs.readFile(file, 'utf8'))
  const web = new Map(edited.map((e) => [e.code, e.qty]))
  let changed = 0
  for (const it of plan.items ?? []) {
    if (web.has(String(it.code)) && it.qty !== web.get(String(it.code))) {
      it.qty = web.get(String(it.code))
      changed++
    }
  }
  const statusChanged = plan.status !== round.status
  if (!changed && !statusChanged) return console.log(`  ${slug}: up to date`)
  console.log(`  ${slug}: qty ${changed}${statusChanged ? ` · status ${plan.status} → ${round.status}` : ''}${dry ? ' (dry run)' : ''}`)
  if (dry) return
  plan.status = round.status
  plan.updated = new Date().toISOString()
  const tmp = file + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(plan, null, 1))
  await fs.rename(tmp, file)
}

// ── main ───────────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2)
const dry = rest.includes('--dry')
const targets = rest.filter((a) => a !== '--dry')
if (!['push', 'pull'].includes(cmd) || !targets.length) {
  console.log('usage: node scripts/import-sync.mjs push|pull <plan.json | round folder> [...] [--dry]')
  process.exit(1)
}
const env = await readEnv(path.join(ROOT, '.env.local'))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
for (const t of targets) {
  const file = await resolvePlan(t)
  await (cmd === 'push' ? push : pull)(sb, file, dry)
}

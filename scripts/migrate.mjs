/**
 * Phase 3 — ย้ายข้อมูล Firestore → Supabase
 *
 *   node --env-file=.env.local scripts/migrate.mjs <step...|all>
 *   steps: locations users checkins leaves quotas delivery marketing settings apply verify
 *
 * หลักการ:
 *   · อ่าน Firebase อย่างเดียว ไม่เขียนกลับ
 *   · รันซ้ำได้ (idempotent) ผ่านตาราง migration_id_map
 *   · แถวไหนเข้าไม่ได้ → log ไว้ ไม่ crash ทั้ง batch
 *   · ท้ายสุด verify นับเทียบทุกตาราง
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createClient } from '@supabase/supabase-js'

// ── setup ────────────────────────────────────────────────────────────
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
})
const fs = getFirestore()
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const problems = []
const warn = (step, msg) => { problems.push(`[${step}] ${msg}`); console.log(`   ⚠️  ${msg}`) }
const ok = (msg) => console.log(`   ✅ ${msg}`)
const head = (t) => console.log(`\n${'─'.repeat(60)}\n${t}\n${'─'.repeat(60)}`)

const ts = (v) => (v?.toDate ? v.toDate().toISOString() : v ?? null)
const dt = (v) => (v?.toDate ? v.toDate().toISOString().slice(0, 10) : null)
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v) => (typeof v === 'string' ? v.trim() : '')
const emailFor = (lineUserId) => `${lineUserId.toLowerCase()}@line.invalid`

// ── id map (idempotent) ──────────────────────────────────────────────
const idCache = new Map()  // "collection|firestoreId" -> uuid

async function loadIdMap() {
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('migration_id_map')
      .select('collection, firestore_id, postgres_id').range(from, from + 999)
    if (error) throw error
    all.push(...data)
    if (data.length < 1000) break
  }
  all.forEach((r) => idCache.set(`${r.collection}|${r.firestore_id}`, r.postgres_id))
  return all.length
}

const getId = (col, fid) => idCache.get(`${col}|${fid}`) ?? null

async function saveIds(col, pairs) {
  if (!pairs.length) return
  for (let i = 0; i < pairs.length; i += 500) {
    const chunk = pairs.slice(i, i + 500)
    const { error } = await sb.from('migration_id_map').upsert(
      chunk.map(([fid, pid]) => ({ collection: col, firestore_id: fid, postgres_id: pid })),
      { onConflict: 'collection,firestore_id' })
    if (error) throw error
    chunk.forEach(([fid, pid]) => idCache.set(`${col}|${fid}`, pid))
  }
}

// ══ กันเขียนทับข้อมูลที่คนกรอกใน Supabase ═══════════════════════════
//
// ปัญหา: สคริปต์นี้ upsert ทับด้วยค่าจาก Firestore ทุกครั้งที่รัน
// พอ HR เริ่มกรอกของจริงใน Supabase แล้ว (เงินเดือน · วันเริ่มงานจริง ·
// สถานะการทำงาน · หน่วยธุรกิจ · ค่าคอม) การรันซ้ำจะลบทิ้งหมด
// เพราะ Firestore ไม่มีข้อมูลพวกนี้เลย
//
// ตารางในลิสต์นี้จะ "เพิ่มเฉพาะแถวใหม่" ไม่แตะแถวที่มีอยู่แล้ว
// → รันซ้ำก่อนตัดระบบได้ปลอดภัย จะเก็บเฉพาะของที่เกิดหลังรันรอบก่อน
// อยากทับจริง ๆ ให้สั่ง MIGRATE_OVERWRITE=1 (ใช้ตอนล้างแล้วย้ายใหม่เท่านั้น)
const HUMAN_EDITED_TABLES = new Set([
  // ── คนกรอกเอง ──────────────────────────────────────────────────────
  'users',                    // role · วันเริ่มงาน · สถานะ · หน่วยธุรกิจ
  'locations',                // รัศมี · เวลาเปิดปิด · ประเภทสถานที่
  'shifts',
  'user_allowed_locations',
  'leave_quotas',             // โควตาที่ HR ตั้งเอง
  'business_units',
  'user_compensation',        // เงินเดือน — Firestore ไม่มีเลย

  // ── ซ่อมไปแล้วหลังย้ายข้อมูล ห้ามให้ Firestore ทับกลับ ───────────────
  // checkins: กู้ชั่วโมงที่หายไป 1,465 แถว + ติดธง needs_review 203 แถว
  //           ถ้าทับกลับ ชั่วโมงติดลบกับชั่วโมงที่ระบบเดาไว้จะกลับมาทั้งชุด
  'checkins',
  'checkin_edits',
  // leave_days: trigger คิดใหม่จากใบลาที่อนุมัติจริง + ล้างของค้างจากใบที่ยกเลิก
  'leave_days',
  'leave_requests',
  'leave_quota_history',
  // delivery_points: ตัวเลขสรุปเส้นทางคิดใหม่หมดแล้ว
  'delivery_points',
  'delivery_routes',
])

const OVERWRITE = process.env.MIGRATE_OVERWRITE === '1'

async function insertChunked(table, rows, step, conflict) {
  // เพิ่มเฉพาะแถวใหม่ ไม่ทับของเดิม
  const protect = !OVERWRITE && HUMAN_EDITED_TABLES.has(table)
  const opts = conflict ? { onConflict: conflict, ignoreDuplicates: protect } : undefined
  if (protect) console.log(`   🛡  ${table}: เพิ่มเฉพาะแถวใหม่ (ไม่ทับของที่กรอกไว้)`)

  let done = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const q = conflict
      ? sb.from(table).upsert(chunk, opts)
      : sb.from(table).insert(chunk)
    const { error } = await q
    if (error) {
      // แถวเสียไม่ควรล้มทั้ง batch → ลองทีละแถวเพื่อหาตัวที่ผิด
      for (const row of chunk) {
        const one = conflict
          ? await sb.from(table).upsert([row], opts)
          : await sb.from(table).insert([row])
        if (one.error) warn(step, `${table}: ${one.error.message} · ${JSON.stringify(row).slice(0, 120)}`)
        else done++
      }
    } else done += chunk.length
  }
  return done
}

// ══ 1. LOCATIONS + SHIFTS ════════════════════════════════════════════
async function migrateLocations() {
  head('1. locations + shifts')

  const { data: fixes } = await sb.from('location_corrections').select('*')
  const fixByName = new Map(fixes.map((f) => [f.firestore_name, f]))
  const merges = fixes.filter((f) => f.action === 'merge_into')

  const snap = await fs.collection('locations').get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // สาขาที่ต้องยุบรวม → ไม่สร้างใหม่ แต่ชี้ id ไปที่สาขาปลายทาง
  const mergeNames = new Set(merges.map((m) => m.firestore_name))
  const keep = docs.filter((d) => !mergeNames.has(d.name))

  const rows = [], pairs = []
  for (const d of keep) {
    const f = fixByName.get(d.name)
    const id = getId('locations', d.id) ?? crypto.randomUUID()
    pairs.push([d.id, id])
    rows.push({
      id,
      name: str(d.name),                                   // trim ' aDay Fresh'
      address: str(d.address),
      lat: f?.new_lat ?? d.lat,
      lng: f?.new_lng ?? d.lng,
      radius: f?.new_radius ?? d.radius ?? 100,
      break_hours: num(d.breakHours),
      working_hours: d.workingHours ?? {},
      location_type: f?.new_location_type ?? 'office',
      is_active: d.isActive !== false,
      created_at: ts(d.createdAt) ?? new Date().toISOString(),
    })
  }

  // location ประเภท home ต้องมีเจ้าของ — ยังไม่รู้จนกว่าจะย้าย users
  // จึงตั้งเป็น office ไปก่อน แล้ว step `apply` ค่อยแก้
  rows.forEach((r) => { if (r.location_type === 'home') r._home = true })
  rows.forEach((r) => { if (r._home) { r.location_type = 'office'; delete r._home } })

  const n = await insertChunked('locations', rows, 'locations', 'id')
  await saveIds('locations', pairs)
  ok(`locations ${n}/${rows.length} แถว`)

  // สาขาที่ยุบรวม → map id เดิมไปที่ปลายทาง เพื่อให้ checkin เก่าชี้ถูก
  for (const m of merges) {
    const src = docs.find((d) => d.name === m.firestore_name)
    const dst = docs.find((d) => d.name === m.merge_into_name)
    if (!src || !dst) { warn('locations', `merge ไม่เจอ: ${m.firestore_name} → ${m.merge_into_name}`); continue }
    await saveIds('locations', [[src.id, getId('locations', dst.id)]])
    ok(`ยุบ "${str(m.firestore_name)}" → "${m.merge_into_name}"`)
  }

  // shifts — ของเดิมเป็น array ไม่มี id ต้อง match ด้วย (location_id, name)
  const shiftRows = []
  for (const d of keep) {
    for (const s of d.shifts ?? []) {
      if (!s?.name || !s?.startTime || !s?.endTime) continue
      shiftRows.push({
        location_id: getId('locations', d.id),
        name: str(s.name),
        start_time: s.startTime,
        end_time: s.endTime,
        grace_minutes: num(s.graceMinutes),
      })
    }
  }
  const sn = await insertChunked('shifts', shiftRows, 'locations', 'location_id,name')
  ok(`shifts ${sn}/${shiftRows.length} แถว`)
}

// ══ 2. USERS (auth + app) ════════════════════════════════════════════
async function migrateUsers() {
  head('2. auth.users + users')

  const snap = await fs.collection('users').get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // auth users ที่มีอยู่แล้ว (รันซ้ำ)
  const existing = new Map()
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    data.users.forEach((u) => existing.set(u.email, u.id))
    if (data.users.length < 1000) break
  }

  const pairs = [], rows = []
  let created = 0
  for (const d of docs) {
    const lineId = d.lineUserId || d.id
    const email = emailFor(lineId)
    let uid = getId('users', d.id) ?? existing.get(email)

    if (!uid) {
      const { data, error } = await sb.auth.admin.createUser({
        email, email_confirm: true,
        // ⚠️ role/line_user_id ต้องอยู่ใน app_metadata เท่านั้น
        //    user_metadata ผู้ใช้แก้เองได้ = ยกระดับสิทธิ์ตัวเองได้ (พิสูจน์แล้วใน Phase 0)
        app_metadata: { line_user_id: lineId, role: d.role || 'employee' },
        user_metadata: { display_name: str(d.lineDisplayName) },
      })
      if (error) { warn('users', `createUser ${lineId}: ${error.message}`); continue }
      uid = data.user.id
      created++
    }
    pairs.push([d.id, uid])

    rows.push({
      id: uid,
      line_user_id: lineId,
      line_display_name: str(d.lineDisplayName),
      line_picture_url: str(d.linePictureUrl),
      full_name: str(d.fullName) || str(d.lineDisplayName) || lineId,
      phone: str(d.phone),
      birth_date: /^\d{4}-\d{2}-\d{2}$/.test(str(d.birthDate)) ? str(d.birthDate) : null,
      role: ['admin','hr','manager','employee','driver','marketing'].includes(d.role) ? d.role : 'employee',
      is_active: d.isActive !== false,
      needs_approval: d.needsApproval === true,
      allow_checkin_outside_location: d.allowCheckInOutsideLocation === true,
      invite_link_code: str(d.inviteLinkCode) || null,
      approved_at: ts(d.approvedAt),
      registered_at: ts(d.registeredAt) ?? ts(d.createdAt) ?? new Date().toISOString(),
      last_login_at: ts(d.lastLoginAt),
      // วันเริ่มงานจริงยังไม่มีข้อมูล → ใช้วันสมัครไปก่อน (ต้องให้ HR แก้ทีหลัง)
      start_date: dt(d.registeredAt) ?? dt(d.createdAt),
      deleted_at: d.isDeleted ? ts(d.deletedAt) ?? new Date().toISOString() : null,
      employment_type: 'monthly',
      created_at: ts(d.createdAt) ?? new Date().toISOString(),
    })
  }

  await saveIds('users', pairs)
  const n = await insertChunked('users', rows, 'users', 'id')
  ok(`auth user สร้างใหม่ ${created} · users ${n}/${rows.length} แถว`)

  // approved_by / deleted_by ต้องรอให้ users ครบก่อนถึงจะ map ได้
  const fixes = []
  for (const d of docs) {
    const uid = getId('users', d.id)
    const by = d.approvedBy ? getId('users', d.approvedBy) : null
    const delBy = d.deletedBy ? getId('users', d.deletedBy) : null
    if (uid && (by || delBy)) fixes.push({ id: uid, approved_by: by, deleted_by: delBy })
  }
  if (fixes.length) {
    for (const f of fixes) await sb.from('users').update(f).eq('id', f.id)
    ok(`ผูก approved_by/deleted_by ${fixes.length} แถว`)
  }

  // allowedLocationIds[] → user_allowed_locations
  const links = []
  for (const d of docs) {
    const uid = getId('users', d.id)
    if (!uid) continue
    for (const locFid of d.allowedLocationIds ?? []) {
      const lid = getId('locations', locFid)
      if (lid) links.push({ user_id: uid, location_id: lid })
    }
  }
  const uniq = [...new Map(links.map((l) => [`${l.user_id}|${l.location_id}`, l])).values()]
  const ln = await insertChunked('user_allowed_locations', uniq, 'users', 'user_id,location_id')
  ok(`user_allowed_locations ${ln}/${uniq.length} แถว`)
}

// ══ 3. CHECKINS ══════════════════════════════════════════════════════
async function migrateCheckins() {
  head('3. checkins + checkin_edits')

  // shift lookup: (location_id, name) → id  (ของเดิมอ้างกะด้วยชื่อ ไม่มี id)
  const { data: shifts } = await sb.from('shifts').select('id, location_id, name')
  const shiftBy = new Map(shifts.map((s) => [`${s.location_id}|${s.name}`, s.id]))

  const dates = (await fs.collection('checkins').listDocuments()).map((d) => d.id).sort()
  const rows = [], pairs = [], edits = []
  let skipped = 0

  for (const date of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { warn('checkins', `ข้ามวันที่ผิดรูปแบบ: ${date}`); continue }
    const snap = await fs.collection('checkins').doc(date).collection('records').get()
    for (const doc of snap.docs) {
      const c = doc.data()
      const uid = getId('users', c.userId)
      if (!uid) { skipped++; continue }

      const locId = c.primaryLocationId ? getId('locations', c.primaryLocationId) : null
      const id = getId('checkins', doc.id) ?? crypto.randomUUID()
      pairs.push([doc.id, id])

      const checkin = ts(c.checkinTime)
      const checkout = ts(c.checkoutTime)
      // constraint: checkout ต้องหลัง checkin — ข้อมูลเสียให้ทิ้ง checkout ไม่ใช่ทิ้งทั้งแถว
      const badCheckout = checkout && checkin && new Date(checkout) <= new Date(checkin)
      if (badCheckout) warn('checkins', `${date} checkout <= checkin → เก็บเป็นยังไม่เช็คเอาท์`)

      // ── ชั่วโมงทำงานจาก Firestore เชื่อไม่ได้ 2 กรณี ──────────────────
      //   1. ติดลบ 104 แถว (คำนวณผิดตอนกะข้ามคืน/แก้เวลา)
      //   2. เป็น 0 ทั้งที่เช็คเอาท์แล้ว 1,465 แถว — ระบบเดิมพัง หนักตั้งแต่ ม.ค. 2026
      // ทิ้งทั้งแถวไม่ได้ เพราะวันนั้นเขามาทำงานจริง → คำนวณใหม่จากเวลาเข้า-ออก
      let reg = num(c.regularHours), ot = num(c.overtimeHours), brk = num(c.breakHours)
      const negative = reg < 0 || ot < 0 || brk < 0
      const missing = reg === 0 && ot === 0 && checkout && !badCheckout
      let hoursStatus = 'original'

      if (negative || missing) {
        const span = !badCheckout && checkin && checkout
          ? (new Date(checkout) - new Date(checkin)) / 3600000
          : 0
        brk = Math.max(0, brk)
        const worked = Math.max(0, Math.round((span - brk) * 100) / 100)

        // ระบบปิดให้อัตโนมัติ = ไม่รู้เวลาเลิกจริง · เกิน 16 ชม. = เป็นไปไม่ได้
        // ตัวเลขพวกนี้เอาไปคิดโอที ห้ามเดา → ให้ HR ใส่เอง
        const unreliable = c.autoCheckout === true || worked > 16
        hoursStatus = unreliable ? 'needs_review' : 'recomputed'
        reg = unreliable ? 0 : worked
        ot = 0

        warn('checkins',
          `${date} ${negative ? `ชั่วโมงติดลบ (${reg}/${ot})` : 'ชั่วโมงเป็น 0 ทั้งที่เช็คเอาท์แล้ว'} → ` +
          (unreliable ? `ไม่น่าเชื่อถือ (${worked} ชม.) ให้ HR ตรวจ` : `คำนวณใหม่ = ${worked} ชม.`))
      }

      rows.push({
        id, user_id: uid, work_date: date,
        checkin_time: checkin,
        checkin_lat: c.checkinLat ?? 0, checkin_lng: c.checkinLng ?? 0,
        checkin_type: ['onsite','offsite','wfh'].includes(c.checkinType) ? c.checkinType : 'onsite',
        checkin_photo_url: str(c.checkinPhotoUrl) || null,
        primary_location_id: locId,
        primary_location_name: str(c.primaryLocationName) || null,
        locations_in_range: (c.locationsInRange ?? []).map((x) => getId('locations', x)).filter(Boolean),
        shift_id: locId && c.selectedShiftName ? shiftBy.get(`${locId}|${str(c.selectedShiftName)}`) ?? null : null,
        shift_name: str(c.selectedShiftName) || null,
        shift_start_time: str(c.shiftStartTime) || null,
        shift_end_time: str(c.shiftEndTime) || null,
        checkout_time: badCheckout ? null : checkout,
        checkout_lat: badCheckout ? null : (c.checkoutLat ?? null),
        checkout_lng: badCheckout ? null : (c.checkoutLng ?? null),
        checkout_note: str(c.checkoutNote) || null,
        regular_hours: reg, overtime_hours: ot,
        break_hours: brk, hours_status: hoursStatus,
        status: ['checked-in','completed','pending'].includes(c.status) ? c.status : 'pending',
        is_late: c.isLate === true, late_minutes: num(c.lateMinutes),
        is_overnight_shift: c.isOvernightShift === true,
        needs_overtime_approval: c.needsOvertimeApproval === true,
        forgot_checkout: c.forgotCheckout === true,
        auto_checkout: c.autoCheckout === true,
        auto_checkout_at: ts(c.autoCheckoutAt), auto_checkout_note: str(c.autoCheckoutNote) || null,
        note: str(c.note) || null,
        user_name: str(c.userName), user_avatar: str(c.userAvatar),
        created_at: ts(c.createdAt) ?? checkin,
      })

      for (const e of c.editHistory ?? []) {
        edits.push({
          checkin_id: id,
          edited_by: e.editedBy ? getId('users', e.editedBy) : null,
          edited_by_name: str(e.editedByName),
          edited_at: ts(e.editedAt) ?? checkin,
          field: str(e.field) || '?',
          old_value: e.oldValue != null ? String(e.oldValue) : null,
          new_value: e.newValue != null ? String(e.newValue) : null,
          reason: str(e.reason),
        })
      }
    }
  }

  const n = await insertChunked('checkins', rows, 'checkins', 'id')
  await saveIds('checkins', pairs)
  ok(`checkins ${n}/${rows.length} แถว จาก ${dates.length} วัน` + (skipped ? ` · ข้าม ${skipped} (ไม่รู้จัก user)` : ''))
  const en = await insertChunked('checkin_edits', edits, 'checkins')
  ok(`checkin_edits ${en}/${edits.length} แถว`)
}

// ══ 4. LEAVES ════════════════════════════════════════════════════════
async function migrateLeaves() {
  head('4. leave_requests + leave_days')

  const snap = await fs.collection('leaves').get()
  const rows = [], pairs = [], days = []

  for (const doc of snap.docs) {
    const l = doc.data()
    const uid = getId('users', l.userId)
    if (!uid) { warn('leaves', `ไม่รู้จัก user ${l.userId}`); continue }
    const start = ts(l.startDate), end = ts(l.endDate)
    if (!start || !end) { warn('leaves', `ใบลา ${doc.id} ไม่มีวันที่`); continue }

    const status = ['pending','approved','rejected','cancelled'].includes(l.status) ? l.status : 'pending'
    const approvedBy = l.approvedBy ? getId('users', l.approvedBy) : null
    // constraint: approved ต้องมีคนอนุมัติ — ถ้าข้อมูลเดิมไม่มี ให้ผู้ใช้เองเป็น placeholder
    const finalApprovedBy = status === 'approved' ? (approvedBy ?? uid) : approvedBy
    if (status === 'approved' && !approvedBy)
      warn('leaves', `ใบลา ${doc.id} อนุมัติแล้วแต่ไม่รู้ว่าใครอนุมัติ`)

    const id = getId('leaves', doc.id) ?? crypto.randomUUID()
    pairs.push([doc.id, id])
    rows.push({
      id, user_id: uid,
      leave_type: ['sick','personal','vacation'].includes(l.type) ? l.type : 'personal',
      status, start_date: start, end_date: end,
      total_days: num(l.totalDays) > 0 ? num(l.totalDays) : 1,
      urgent_multiplier: num(l.urgentMultiplier) || 1,
      reason: str(l.reason),
      approved_by: finalApprovedBy, approved_at: ts(l.approvedAt),
      rejected_reason: str(l.rejectedReason) || null,
      cancelled_by: l.cancelledBy ? getId('users', l.cancelledBy) : null,
      cancelled_at: ts(l.cancelledAt), cancel_reason: str(l.cancelReason) || null,
      user_name: str(l.userName), user_avatar: str(l.userAvatar), user_email: str(l.userEmail),
      created_at: ts(l.createdAt) ?? start,
    })

    // แตกช่วงวันที่เป็นรายวัน — จำเป็นสำหรับกติกา "มาทำงานชนะใบลา คืนโควตา"
    const d0 = new Date(start), d1 = new Date(end)
    for (let t = new Date(d0); t <= d1; t.setUTCDate(t.getUTCDate() + 1)) {
      days.push({ leave_request_id: id, user_id: uid, leave_date: t.toISOString().slice(0, 10) })
    }
  }

  // ⚠️ ต้อง saveIds ก่อน ไม่งั้นรอบหน้า getId('leaves') คืน null
  //    → สุ่ม uuid ใหม่ → แทรกใบลาซ้ำทั้งชุด (เคยเกิดจริง 299 → 600 แถว)
  await saveIds('leaves', pairs)
  const n = await insertChunked('leave_requests', rows, 'leaves', 'id')
  ok(`leave_requests ${n}/${rows.length} แถว`)
  // ไม่สร้าง leave_days เองแล้ว — trigger leave_requests_sync_days แตกให้อัตโนมัติ
  // และทำได้ถูกกว่า เพราะเช็คให้ด้วยว่าวันนั้นเช็คอินมาทำงานจริงไหม (คืนโควตา)
  // ของเดิมสร้างให้ใบลาทุกสถานะ รวมที่ยกเลิก → ไปจองวันค้างไว้ให้ใบอื่นเข้าไม่ได้
  const { count: dn } = await sb
    .from('leave_days').select('*', { count: 'exact', head: true })
  ok(`leave_days ${dn} แถว (trigger แตกให้จากใบที่อนุมัติ)`)
}

// ══ 5. QUOTAS ════════════════════════════════════════════════════════
async function migrateQuotas() {
  head('5. leave_quotas + history')

  const snap = await fs.collectionGroup('years').get()
  const rows = [], hist = []
  let badYear = 0

  for (const doc of snap.docs) {
    const q = doc.data()
    const uid = getId('users', q.userId)
    if (!uid) continue
    const year = Number(q.year)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      badYear++
      warn('quotas', `ปีไม่ถูกต้อง (${q.year}) ของ user ${q.userId} → ข้าม`)
      continue
    }
    for (const t of ['sick', 'personal', 'vacation']) {
      if (!q[t]) continue
      const total = num(q[t].total), used = num(q[t].used)
      if (used > total)
        warn('quotas', `${t} ปี ${year}: ใช้ ${used} > โควตา ${total} → ปรับโควตาเป็น ${used} เพื่อไม่ให้ข้อมูลหาย`)
      rows.push({
        user_id: uid, year, leave_type: t,
        total_days: Math.max(total, used),   // กัน constraint used <= total
        used_days: used,
        updated_by: q.updatedBy ? getId('users', q.updatedBy) : null,
        updated_at: ts(q.updatedAt) ?? new Date().toISOString(),
      })
    }
    for (const h of q.history ?? []) {
      hist.push({
        user_id: uid, year,
        changes: h.changes ?? {}, reason: str(h.reason),
        changed_by: h.changedBy ? getId('users', h.changedBy) : null,
        changed_at: ts(h.changedAt) ?? new Date().toISOString(),
      })
    }
  }

  const n = await insertChunked('leave_quotas', rows, 'quotas', 'user_id,year,leave_type')
  ok(`leave_quotas ${n}/${rows.length} แถว` + (badYear ? ` · ข้ามปีเสีย ${badYear}` : ''))
  const hn = await insertChunked('leave_quota_history', hist, 'quotas')
  ok(`leave_quota_history ${hn}/${hist.length} แถว`)
}

// ══ 6. DELIVERY ══════════════════════════════════════════════════════
async function migrateDelivery() {
  head('6. delivery_routes + delivery_points')

  const rsnap = await fs.collection('deliveryRoutes').get()
  const routes = [], rpairs = []
  for (const doc of rsnap.docs) {
    const r = doc.data()
    const uid = getId('users', r.driverId)
    if (!uid) { warn('delivery', `route ${doc.id}: ไม่รู้จัก driver`); continue }
    const id = getId('deliveryRoutes', doc.id) ?? crypto.randomUUID()
    rpairs.push([doc.id, id])
    routes.push({
      id, driver_id: uid, driver_name: str(r.driverName),
      route_date: /^\d{4}-\d{2}-\d{2}$/.test(str(r.date)) ? str(r.date) : (dt(r.createdAt) ?? '2025-01-01'),
      status: ['in-progress','completed'].includes(r.status) ? r.status : 'in-progress',
      start_time: ts(r.startTime),
      total_points: num(r.totalPoints), completed_points: num(r.completedPoints),
      failed_points: num(r.failedPoints),
      created_at: ts(r.createdAt) ?? new Date().toISOString(),
    })
  }
  // ไม่ย้าย delivery_routes แล้ว — trigger delivery_points_recalc_route
  // สรุปจากจุดส่งจริงให้เอง  ตัวเลขจาก Firestore เพี้ยน (อ้างว่ามีจุดส่ง
  // 966 จุดที่ไม่มีอยู่จริง เพราะโค้ดเดิมนับด้วยการอ่าน-บวก-เขียนใน JS)
  await saveIds('deliveryRoutes', rpairs)
  ok(`delivery_routes ข้าม ${routes.length} แถว (ให้ trigger คิดเอง)`)

  const psnap = await fs.collection('deliveryPoints').get()
  const points = [], ppairs = []
  for (const doc of psnap.docs) {
    const p = doc.data()
    const uid = getId('users', p.driverId)
    if (!uid) { warn('delivery', `point ${doc.id}: ไม่รู้จัก driver`); continue }
    const id = getId('deliveryPoints', doc.id) ?? crypto.randomUUID()
    ppairs.push([doc.id, id])
    const ph = p.photo ?? {}
    points.push({
      id, driver_id: uid, driver_name: str(p.driverName),
      delivery_type: ['pickup','delivery'].includes(p.deliveryType) ? p.deliveryType : 'delivery',
      delivery_status: ['pending','completed','failed'].includes(p.deliveryStatus) ? p.deliveryStatus : 'pending',
      address: str(p.address), lat: p.lat ?? 0, lng: p.lng ?? 0,
      customer_name: str(p.customerName) || null, customer_phone: str(p.customerPhone) || null,
      order_number: str(p.orderNumber) || null, note: str(p.note),
      check_in_time: ts(p.checkInTime),
      photo_url: str(ph.url) || str(p.photoUrl) || null,
      photo_thumbnail_url: str(ph.thumbnailUrl) || null,
      photo_width: ph.width ?? null, photo_height: ph.height ?? null,
      photo_original_size: ph.originalSize ?? null, photo_compressed_size: ph.compressedSize ?? null,
      photo_captured_at: ts(ph.capturedAt), photo_uploaded_at: ts(ph.uploadedAt),
      created_at: ts(p.createdAt) ?? new Date().toISOString(),
    })
  }
  const pn = await insertChunked('delivery_points', points, 'delivery', 'id')
  await saveIds('deliveryPoints', ppairs)
  ok(`delivery_points ${pn}/${points.length} แถว`)
}

// ══ 7. SETTINGS ══════════════════════════════════════════════════════
async function migrateSettings() {
  head('7. app_settings')
  const rows = []
  for (const col of ['settings', 'config']) {
    const snap = await fs.collection(col).get()
    snap.docs.forEach((d) => rows.push({ key: `${col}:${d.id}`, value: JSON.parse(JSON.stringify(d.data())) }))
  }
  const n = await insertChunked('app_settings', rows, 'settings', 'key')
  ok(`app_settings ${n}/${rows.length} แถว`)
}

// ══ 8. APPLY — ค่าที่ตัดสินใจไว้ ต้องรันหลัง users เสมอ ═══════════════
// ⚠️ ขั้นนี้สำคัญ: step `users` upsert ทับด้วยค่าจาก Firestore ทุกครั้ง
//    เช่น ปู/ขวัญ ยังเป็น driver ใน Firestore ถ้าไม่ apply จะกลับไปเป็น driver
async function applyPlans() {
  head('8. apply ค่าที่ตัดสินใจไว้')

  // ค่าที่เคย apply ไปแล้วไม่ต้องยัดซ้ำ — HR อาจแก้ทีหลังแล้วเราจะไปทับเขา
  let planQuery = sb.from('user_settings_plan').select('*')
  if (!OVERWRITE) planQuery = planQuery.is('applied_at', null)
  const { data: plans } = await planQuery

  if (!plans?.length) { ok('ไม่มีค่าที่ต้อง apply ใหม่'); return }
  const { data: users } = await sb.from('users').select('id, line_display_name, full_name, role')
  const byLine = new Map(users.map((u) => [u.line_display_name, u]))

  let applied = 0
  for (const p of plans) {
    const u = byLine.get(p.match_line_display_name)
    if (!u) { warn('apply', `หาไม่เจอ: ${p.nickname} (${p.match_line_display_name})`); continue }

    const patch = {}
    if (p.set_role) patch.role = p.set_role
    if (p.wfh_eligible !== null) patch.wfh_eligible = p.wfh_eligible
    if (p.requires_checkin !== null) patch.requires_checkin = p.requires_checkin
    if (p.employment_type) patch.employment_type = p.employment_type
    if (!Object.keys(patch).length) continue

    const { error } = await sb.from('users').update(patch).eq('id', u.id)
    if (error) { warn('apply', `${p.nickname}: ${error.message}`); continue }

    // sync role ไป auth app_metadata ด้วย — RLS อ่าน role จาก JWT
    // (app_metadata เท่านั้น ห้าม user_metadata เพราะ user แก้เองได้)
    if (patch.role) {
      const { error: e2 } = await sb.auth.admin.updateUserById(u.id, {
        app_metadata: { role: patch.role },
      })
      if (e2) warn('apply', `sync app_metadata ${p.nickname}: ${e2.message}`)
    }
    applied++
    console.log(`   · ${p.nickname.padEnd(10)} → ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(' ')}`)
  }
  ok(`ตั้งค่าพิเศษ ${applied}/${plans.length} คน`)

  await sb.from('user_settings_plan').update({ applied_at: new Date().toISOString() })
    .is('applied_at', null)
}

// ══ 9. VERIFY — นับเทียบ Firestore ═══════════════════════════════════
async function verify() {
  head('9. ตรวจนับเทียบ Firestore')

  const count = async (col) => (await fs.collection(col).count().get()).data().count
  const groupCount = async (g) => (await fs.collectionGroup(g).count().get()).data().count
  const sbCount = async (t) => {
    const { count: c } = await sb.from(t).select('*', { count: 'exact', head: true })
    return c ?? 0
  }

  const checks = [
    ['users',            await count('users'),            await sbCount('users')],
    ['locations',        13,                              await sbCount('locations')],
    ['checkins',         await groupCount('records'),     await sbCount('checkins')],
    ['leave_requests',   await count('leaves'),           await sbCount('leave_requests')],
    ['leave_quotas(ปี)', await groupCount('years'),       null],
    ['deliveryPoints',   await count('deliveryPoints'),   await sbCount('delivery_points')],
    // delivery_routes ไม่ต้องตรงกับ Firestore — คิดใหม่จากจุดส่งจริง
  ]

  const pad = (s, n) => String(s).padEnd(n)
  console.log(`${pad('ตาราง', 20)}${pad('Firestore', 12)}${pad('Supabase', 12)}ผล`)
  console.log('─'.repeat(56))
  let allOk = true
  for (const [name, fsN, sbN] of checks) {
    if (sbN === null) { console.log(`${pad(name,20)}${pad(fsN,12)}${pad('—',12)}(แตกเป็น long format)`); continue }
    const same = fsN === sbN
    if (!same) allOk = false
    console.log(`${pad(name,20)}${pad(fsN,12)}${pad(sbN,12)}${same ? '✅' : `❌ ขาด ${fsN - sbN}`}`)
  }

  // ยอดชั่วโมงรวม — ตัวเลขที่กระทบเงินเดือน ต้องตรงเป๊ะ
  const { data: hrs } = await sb.rpc('sum_total_hours').single().then(
    (r) => r, () => ({ data: null }))
  if (!hrs) {
    const { data } = await sb.from('checkins').select('total_hours')
    const sum = (data ?? []).reduce((s, r) => s + Number(r.total_hours ?? 0), 0)
    console.log(`\nชั่วโมงทำงานรวมใน Supabase: ${sum.toFixed(1)} ชม.`)
  }
  console.log(allOk ? '\n✅ จำนวนตรงทุกตาราง' : '\n⚠️ มีตารางที่จำนวนไม่ตรง — ดูรายละเอียดข้างบน')
}

// ลำดับสำคัญ:
//   checkins ต้องมาก่อน leaves — กติกา "มาทำงานชนะใบลา" ต้องรู้ว่าวันนั้นเช็คอินไหม
//   quotas   ต้องมาก่อน leaves — ไม่งั้น trigger สร้างแถวโควตาค่าเริ่มต้นไว้ก่อน
//                                 แล้วขั้นนี้จะข้าม ทำให้โควตาจริงไม่เข้า
const STEPS = {
  locations: migrateLocations, users: migrateUsers, checkins: migrateCheckins,
  quotas: migrateQuotas, leaves: migrateLeaves, delivery: migrateDelivery,
  settings: migrateSettings, apply: applyPlans, verify,
}

// ── main ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const steps = args.includes('all') ? Object.keys(STEPS) : args.filter((a) => STEPS[a])
if (!steps.length) {
  console.log('ใช้: node --env-file=.env.local scripts/migrate.mjs <step...|all>')
  console.log('steps:', Object.keys(STEPS).join(' '))
  process.exit(1)
}

console.log(`โหลด id map เดิม: ${await loadIdMap()} รายการ`)
for (const s of steps) await STEPS[s]()

if (problems.length) {
  console.log(`\n${'═'.repeat(60)}\nปัญหา ${problems.length} รายการ:`)
  problems.slice(0, 20).forEach((p) => console.log('  ' + p))
  if (problems.length > 20) console.log(`  ... อีก ${problems.length - 20}`)
} else console.log('\n✅ ไม่มีปัญหา')

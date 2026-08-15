// lib/services/web/webService.ts
//
// ดูแลเว็บไซต์ลูกค้า (WordPress) — ย้ายมาจากระบบเดี่ยว aoo-student-website
// RLS คุมชั้น DB แล้ว (เฉพาะคนใน web_owners) โค้ดฝั่งนี้ query ตรงได้เลย
//
// เก็บ 2 เรื่องในที่เดียว: "บิลค่าโฮสต์+โดเมนรายปี" ของเดิม
// กับ "งานดูแลเว็บ" ของใหม่ (วันหมดอายุ · เว็บล่ม · ปลั๊กอิน · บันทึกงาน)

import { createClient } from '@/lib/supabase/client'

const sb = () => createClient()

export interface WebCourse {
  id: string
  name: string
  periodStart: string | null
  periodEnd: string | null
  hostingAmount: number
  domainAmount: number
}

export interface WebHost {
  id: string
  name: string
  provider: string
  sshHost: string
  sshPort: number
  sshUser: string
  domainsPath: string
  hardened: boolean
  backupKeep: number
  isActive: boolean
  notes: string
  lastDiscoveredAt: string | null
  /** ตั้งรหัสผ่าน SSH ไว้แล้วไหม (ตัวรหัสอ่านกลับไม่ได้ — อยู่ฝั่งเซิร์ฟเวอร์) */
  hasPassword: boolean
  /** กุญแจจากคลังที่โฮสต์นี้ใช้ (null = ไม่ได้เลือก) */
  keyId: string | null
  keyName?: string
  /** เว็บธุรกิจของเราเอง (ไม่ใช่ของลูกค้า) — ไม่ออกบิล แต่ยังดูแลเหมือนกัน */
  isOwnBusiness: boolean
  planExpiresAt: string | null
  siteCount?: number
}

export interface WebJob {
  id: string
  batchId: string | null
  type: 'scan' | 'plugin_update' | 'plugin_check' | 'backup' | 'discover'
  status: 'queued' | 'running' | 'done' | 'failed'
  hostId: string | null
  siteId: string | null
  siteName?: string
  hostName?: string
  queuedAt: string
  startedAt: string | null
  finishedAt: string | null
  rawLog: string
  summary: Record<string, unknown> | null
}

export interface WebBatch {
  id: string
  type: WebJob['type']
  totalJobs: number
  doneJobs: number
  failedJobs: number
  createdAt: string
  finishedAt: string | null
}

export interface WebSite {
  id: string
  siteName: string
  isActive: boolean
  courseId: string | null
  courseName?: string
  hostId: string | null
  hostName?: string
  publicHtmlPath: string
  pendingPluginCount: number
  /** ปลั๊กอินทั้งหมดที่ติดตั้ง — ใช้คู่กับ pendingPluginCount เป็น "ค้าง/ทั้งหมด" */
  pluginCount: number
  /** ปลั๊กอินที่ระบบอัปเดตให้ไม่ได้ ต้องทำมือ (มักเป็นตัว pro ที่ license หมด) */
  blockedPluginCount: number
  lastScanStatus: 'ok' | 'suspect' | 'fail' | 'unknown'
  lastScanAt: string | null
  lastBackupAt: string | null
  lastBackupFile: string
  studentName: string
  studentContact: string
  hostingProvider: string
  hostingAccount: string
  hostingExpiresAt: string | null
  domainSelfRegistered: boolean
  domainRegistrar: string
  domainRegisteredAt: string | null
  domainExpiresAt: string | null
  sslExpiresAt: string | null
  wpAdminUrl: string
  sshHost: string
  sshPort: number
  sshUser: string
  sshPath: string
  wpVersion: string
  pluginsCheckedAt: string | null
  httpStatus: number | null
  responseMs: number | null
  lastCheckedAt: string | null
  lastUpAt: string | null
  downSince: string | null
  /** อาการที่อ่านได้จากเนื้อหาหน้า เช่น critical_error, blank_page — null = ปกติ */
  pageIssue: string | null
  notes: string
  /** สรุปจากบิล — เติมให้เฉพาะตอนดึงรายการ */
  unpaidCount?: number
  latestPeriodEnd?: string | null
}

export interface WebBill {
  id: string
  siteId: string
  courseId: string | null
  year: number
  periodStart: string | null
  periodEnd: string | null
  hostingAmount: number
  domainAmount: number
  billDomain: boolean
  paidScope: 'none' | 'hosting' | 'hosting_domain'
  status: 'unpaid' | 'pending_review' | 'paid' | 'rejected'
  renewedRegistrar: string
  paidAt: string | null
}

export interface WebSlip {
  id: string
  billId: string
  siteId: string
  slipImageUrl: string
  qrRaw: string
  readRef: string
  verifyResult: 'ok' | 'duplicate' | 'unreadable'
  uploadedAt: string
  siteName?: string
  billYear?: number
  billStatus?: WebBill['status']
}

export interface WebLog {
  id: string
  siteId: string
  kind: 'note' | 'plugin_update' | 'core_update' | 'backup' | 'downtime' | 'renewal'
  message: string
  createdAt: string
  createdByName?: string
}

export interface WebPlugin {
  id: string
  siteId: string
  slug: string
  name: string
  version: string
  newVersion: string | null
  status: string
  checkedAt: string
}

/* ── mapper ─────────────────────────────────────────────────────────── */

type SiteRow = Record<string, unknown>

const toSite = (r: SiteRow): WebSite => ({
  id: r.id as string,
  siteName: (r.site_name as string) ?? '',
  isActive: (r.is_active as boolean) ?? true,
  courseId: (r.course_id as string) ?? null,
  courseName: ((r.web_courses as { name?: string } | null)?.name as string) ?? '',
  hostId: (r.host_id as string) ?? null,
  hostName: ((r.web_hosts as { name?: string } | null)?.name as string) ?? '',
  publicHtmlPath: (r.public_html_path as string) ?? '',
  pendingPluginCount: (r.pending_plugin_count as number) ?? 0,
  pluginCount: (r.plugin_count as number) ?? 0,
  blockedPluginCount: (r.blocked_plugin_count as number) ?? 0,
  lastScanStatus: (r.last_scan_status as WebSite['lastScanStatus']) ?? 'unknown',
  lastScanAt: (r.last_scan_at as string) ?? null,
  lastBackupAt: (r.last_backup_at as string) ?? null,
  lastBackupFile: (r.last_backup_file as string) ?? '',
  studentName: (r.student_name as string) ?? '',
  studentContact: (r.student_contact as string) ?? '',
  hostingProvider: (r.hosting_provider as string) ?? '',
  hostingAccount: (r.hosting_account as string) ?? '',
  hostingExpiresAt: (r.hosting_expires_at as string) ?? null,
  domainSelfRegistered: (r.domain_self_registered as boolean) ?? false,
  domainRegistrar: (r.domain_registrar as string) ?? '',
  domainRegisteredAt: (r.domain_registered_at as string) ?? null,
  domainExpiresAt: (r.domain_expires_at as string) ?? null,
  sslExpiresAt: (r.ssl_expires_at as string) ?? null,
  wpAdminUrl: (r.wp_admin_url as string) ?? '',
  sshHost: (r.ssh_host as string) ?? '',
  sshPort: (r.ssh_port as number) ?? 22,
  sshUser: (r.ssh_user as string) ?? '',
  sshPath: (r.ssh_path as string) ?? '',
  wpVersion: (r.wp_version as string) ?? '',
  pluginsCheckedAt: (r.plugins_checked_at as string) ?? null,
  httpStatus: (r.http_status as number) ?? null,
  responseMs: (r.response_ms as number) ?? null,
  lastCheckedAt: (r.last_checked_at as string) ?? null,
  lastUpAt: (r.last_up_at as string) ?? null,
  downSince: (r.down_since as string) ?? null,
  pageIssue: (r.page_issue as string) ?? null,
  notes: (r.notes as string) ?? '',
})

const toBill = (r: Record<string, unknown>): WebBill => ({
  id: r.id as string,
  siteId: r.site_id as string,
  courseId: (r.course_id as string) ?? null,
  year: r.year as number,
  periodStart: (r.period_start as string) ?? null,
  periodEnd: (r.period_end as string) ?? null,
  hostingAmount: Number(r.hosting_amount ?? 0),
  domainAmount: Number(r.domain_amount ?? 0),
  billDomain: (r.bill_domain as boolean) ?? true,
  paidScope: (r.paid_scope as WebBill['paidScope']) ?? 'none',
  status: (r.status as WebBill['status']) ?? 'unpaid',
  renewedRegistrar: (r.renewed_registrar as string) ?? '',
  paidAt: (r.paid_at as string) ?? null,
})

/* ── เว็บไซต์ ───────────────────────────────────────────────────────── */

export async function getSites(): Promise<WebSite[]> {
  const { data, error } = await sb()
    .from('web_sites')
    .select('*, web_courses(name), web_hosts(name), web_bills(status, period_end)')
    .order('site_name')
  if (error) throw error
  return (data ?? []).map((r) => {
    const bills = (r.web_bills ?? []) as { status: string; period_end: string | null }[]
    return {
      ...toSite(r),
      unpaidCount: bills.filter((b) => b.status === 'unpaid' || b.status === 'pending_review').length,
      latestPeriodEnd: bills.map((b) => b.period_end).filter(Boolean).sort().at(-1) ?? null,
    }
  })
}

export async function getSite(id: string): Promise<WebSite | null> {
  const { data, error } = await sb()
    .from('web_sites')
    .select('*, web_courses(name), web_hosts(name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? toSite(data) : null
}

export async function saveSite(data: Partial<WebSite>): Promise<string> {
  const fields = {
    site_name: data.siteName?.trim().toLowerCase() ?? '',
    is_active: data.isActive ?? true,
    course_id: data.courseId || null,
    host_id: data.hostId || null,
    public_html_path: data.publicHtmlPath || null,
    student_name: data.studentName ?? '',
    student_contact: data.studentContact ?? '',
    hosting_provider: data.hostingProvider ?? '',
    hosting_account: data.hostingAccount ?? '',
    hosting_expires_at: data.hostingExpiresAt || null,
    domain_self_registered: data.domainSelfRegistered ?? false,
    domain_registrar: data.domainRegistrar ?? '',
    domain_registered_at: data.domainRegisteredAt || null,
    domain_expires_at: data.domainExpiresAt || null,
    ssl_expires_at: data.sslExpiresAt || null,
    wp_admin_url: data.wpAdminUrl ?? '',
    ssh_host: data.sshHost ?? '',
    ssh_port: data.sshPort ?? 22,
    ssh_user: data.sshUser ?? '',
    ssh_path: data.sshPath ?? '',
    notes: data.notes ?? '',
    updated_at: new Date().toISOString(),
  }
  if (data.id) {
    const { error } = await sb().from('web_sites').update(fields).eq('id', data.id)
    if (error) throw error
    return data.id
  }
  const { data: row, error } = await sb().from('web_sites').insert(fields).select('id').single()
  if (error) throw error
  return row.id as string
}

export async function deleteSite(id: string): Promise<void> {
  const { error } = await sb().from('web_sites').delete().eq('id', id)
  if (error) throw error
}

/* ── บิล ────────────────────────────────────────────────────────────── */

export async function getBills(siteId: string): Promise<WebBill[]> {
  const { data, error } = await sb()
    .from('web_bills')
    .select('*')
    .eq('site_id', siteId)
    .order('year', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toBill)
}

export async function saveBill(data: Partial<WebBill> & { siteId: string }): Promise<void> {
  const fields = {
    site_id: data.siteId,
    course_id: data.courseId || null,
    year: data.year ?? new Date().getFullYear(),
    period_start: data.periodStart || null,
    period_end: data.periodEnd || null,
    hosting_amount: data.hostingAmount ?? 0,
    domain_amount: data.domainAmount ?? 0,
    bill_domain: data.billDomain ?? true,
    paid_scope: data.paidScope ?? 'none',
    status: data.status ?? 'unpaid',
    renewed_registrar: data.renewedRegistrar ?? '',
    paid_at: data.status === 'paid' ? (data.paidAt ?? new Date().toISOString()) : null,
  }
  if (data.id) {
    const { error } = await sb().from('web_bills').update(fields).eq('id', data.id)
    if (error) throw error
  } else {
    const { error } = await sb().from('web_bills').insert(fields)
    if (error) throw error
  }
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await sb().from('web_bills').delete().eq('id', id)
  if (error) throw error
}

/* ── สลิป ───────────────────────────────────────────────────────────── */

/** สลิปทั้งหมด (ค่าปริยาย = เฉพาะบิลที่ยังรอตรวจ) */
export async function getSlips(onlyPending = true): Promise<WebSlip[]> {
  let q = sb()
    .from('web_slips')
    .select('*, web_sites(site_name), web_bills(year, status)')
    .order('uploaded_at', { ascending: false })
  if (onlyPending) q = q.eq('web_bills.status', 'pending_review')
  const { data, error } = await q
  if (error) throw error
  return (data ?? [])
    .filter((r) => !onlyPending || r.web_bills)
    .map((r) => ({
      id: r.id as string,
      billId: r.bill_id as string,
      siteId: r.site_id as string,
      slipImageUrl: r.slip_image_url as string,
      qrRaw: (r.qr_raw as string) ?? '',
      readRef: (r.read_ref as string) ?? '',
      verifyResult: (r.verify_result as WebSlip['verifyResult']) ?? 'unreadable',
      uploadedAt: r.uploaded_at as string,
      siteName: (r.web_sites as { site_name?: string } | null)?.site_name ?? '',
      billYear: (r.web_bills as { year?: number } | null)?.year,
      billStatus: (r.web_bills as { status?: WebBill['status'] } | null)?.status,
    }))
}

export async function getSlipsBySite(siteId: string): Promise<WebSlip[]> {
  const { data, error } = await sb()
    .from('web_slips')
    .select('*')
    .eq('site_id', siteId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    billId: r.bill_id as string,
    siteId: r.site_id as string,
    slipImageUrl: r.slip_image_url as string,
    qrRaw: (r.qr_raw as string) ?? '',
    readRef: (r.read_ref as string) ?? '',
    verifyResult: (r.verify_result as WebSlip['verifyResult']) ?? 'unreadable',
    uploadedAt: r.uploaded_at as string,
  }))
}

/** อนุมัติ/ปฏิเสธสลิป — เปลี่ยนสถานะบิลตาม */
export async function reviewSlip(billId: string, approve: boolean): Promise<void> {
  const { error } = await sb()
    .from('web_bills')
    .update(
      approve
        ? { status: 'paid', paid_at: new Date().toISOString() }
        : { status: 'rejected', paid_at: null }
    )
    .eq('id', billId)
  if (error) throw error
}

/** รูปสลิปอยู่ใน bucket ปิด — ต้องขอลิงก์ชั่วคราวก่อนแสดง (เก่าบางใบยังเป็น URL เต็ม) */
export async function slipUrl(path: string): Promise<string> {
  if (path.startsWith('http')) return path
  const { data, error } = await sb().storage.from('web-slips').createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

/* ── รุ่น/คอร์ส ─────────────────────────────────────────────────────── */

export async function getCourses(): Promise<WebCourse[]> {
  const { data, error } = await sb().from('web_courses').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    periodStart: (r.period_start as string) ?? null,
    periodEnd: (r.period_end as string) ?? null,
    hostingAmount: Number(r.hosting_amount ?? 0),
    domainAmount: Number(r.domain_amount ?? 0),
  }))
}

export async function saveCourse(data: Partial<WebCourse>): Promise<void> {
  const fields = {
    name: data.name ?? '',
    period_start: data.periodStart || null,
    period_end: data.periodEnd || null,
    hosting_amount: data.hostingAmount ?? 2000,
    domain_amount: data.domainAmount ?? 600,
  }
  if (data.id) {
    const { error } = await sb().from('web_courses').update(fields).eq('id', data.id)
    if (error) throw error
  } else {
    const { error } = await sb().from('web_courses').insert(fields)
    if (error) throw error
  }
}

/* ── บันทึกงาน + ปลั๊กอิน ────────────────────────────────────────────── */

export async function getLogs(siteId: string): Promise<WebLog[]> {
  const { data, error } = await sb()
    .from('web_site_logs')
    .select('*, users(display_name)')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    siteId: r.site_id as string,
    kind: (r.kind as WebLog['kind']) ?? 'note',
    message: (r.message as string) ?? '',
    createdAt: r.created_at as string,
    createdByName: (r.users as { display_name?: string } | null)?.display_name ?? '',
  }))
}

export async function addLog(
  siteId: string,
  message: string,
  kind: WebLog['kind'] = 'note',
  userId?: string
): Promise<void> {
  const { error } = await sb()
    .from('web_site_logs')
    .insert({ site_id: siteId, message, kind, created_by: userId ?? null })
  if (error) throw error
}

export async function getPlugins(siteId: string): Promise<WebPlugin[]> {
  const { data, error } = await sb()
    .from('web_plugins')
    .select('*')
    .eq('site_id', siteId)
    .order('name')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    siteId: r.site_id as string,
    slug: r.slug as string,
    name: (r.name as string) ?? '',
    version: (r.version as string) ?? '',
    newVersion: (r.new_version as string) ?? null,
    status: (r.status as string) ?? 'active',
    checkedAt: r.checked_at as string,
  }))
}

/* ── โฮสต์ (บัญชี Hostinger/SiteGround 1 บัญชี = 1 แถว) ──────────────── */

export async function getHosts(): Promise<WebHost[]> {
  const { data, error } = await sb()
    .from('web_hosts')
    .select('*, web_sites(count), web_ssh_keys(name)')
    .order('name')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    sshHost: r.ssh_host,
    sshPort: r.ssh_port,
    sshUser: r.ssh_user,
    domainsPath: r.domains_path,
    hardened: r.hardened,
    backupKeep: r.backup_keep,
    isActive: r.is_active,
    notes: r.notes ?? '',
    lastDiscoveredAt: r.last_discovered_at,
    hasPassword: r.has_password ?? false,
    keyId: r.key_id ?? null,
    isOwnBusiness: r.is_own_business ?? false,
    planExpiresAt: r.plan_expires_at ?? null,
    keyName: (r.web_ssh_keys as { name?: string } | null)?.name ?? '',
    siteCount: ((r.web_sites as unknown as { count?: number }[])?.[0]?.count) ?? 0,
  }))
}

export async function saveHost(data: Partial<WebHost>): Promise<void> {
  const fields = {
    name: data.name ?? '',
    provider: data.provider || 'Hostinger',
    ssh_host: data.sshHost ?? '',
    ssh_port: data.sshPort ?? 22,
    ssh_user: data.sshUser ?? '',
    domains_path: data.domainsPath || 'domains',
    hardened: data.hardened ?? false,
    backup_keep: data.backupKeep ?? 3,
    is_active: data.isActive ?? true,
    notes: data.notes ?? '',
    key_id: data.keyId || null,
    is_own_business: data.isOwnBusiness ?? false,
    plan_expires_at: data.planExpiresAt || null,
  }
  if (data.id) {
    const { error } = await sb().from('web_hosts').update(fields).eq('id', data.id)
    if (error) throw error
  } else {
    const { error } = await sb().from('web_hosts').insert(fields)
    if (error) throw error
  }
}

/* ── คลังกุญแจ SSH (1 ดอกต่อผู้ให้บริการ) ───────────────────────────── */

export interface SshKey {
  id: string
  name: string
  provider: string
  publicKey: string
  hostCount: number
  createdAt: string
}

export async function getSshKeys(): Promise<SshKey[]> {
  const res = await fetch('/api/web/keys')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'โหลดกุญแจไม่สำเร็จ')
  return json.keys
}

/** ไม่ส่ง privateKey มา = ให้ระบบสร้างคู่ใหม่ให้ แล้วคืน public key ไปแปะที่โฮสต์ */
export async function createSshKey(data: {
  name: string
  provider?: string
  privateKey?: string
  passphrase?: string
}): Promise<SshKey> {
  const res = await fetch('/api/web/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'สร้างกุญแจไม่สำเร็จ')
  return json.key
}

export async function deleteSshKey(id: string): Promise<void> {
  const res = await fetch(`/api/web/keys?id=${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json()).error || 'ลบกุญแจไม่สำเร็จ')
}

/** ตั้งความลับ SSH ของโฮสต์ (รหัสผ่าน/กุญแจ) — ผ่าน API เท่านั้น เข้ารหัสก่อนลง DB */
export async function setHostSecret(
  hostId: string,
  secret: { password?: string; privateKey?: string; passphrase?: string }
): Promise<void> {
  const res = await fetch('/api/web/hosts/secret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId, ...secret }),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'บันทึกไม่สำเร็จ')
}

export async function clearHostSecret(
  hostId: string,
  what: 'password' | 'key' | 'all' = 'all'
): Promise<void> {
  const res = await fetch(`/api/web/hosts/secret?hostId=${hostId}&what=${what}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json()).error || 'ลบไม่สำเร็จ')
}

export async function deleteHost(id: string): Promise<void> {
  const { error } = await sb().from('web_hosts').delete().eq('id', id)
  if (error) throw error
}

/* ── คิวงาน ─────────────────────────────────────────────────────────── */

/** สั่งงานทั้งฟลีต (หรือเฉพาะโฮสต์/เว็บที่เลือก) — คืนจำนวน job ที่เข้าคิว */
export async function enqueueJobs(body: {
  type: WebJob['type']
  siteIds?: string[]
  hostId?: string
}): Promise<{
  batchId?: string
  jobs: number
  /** ข้ามเพราะปลั๊กอินครบอยู่แล้ว */
  skippedUpToDate?: number
  /** ข้ามเพราะมีงานชนิดเดียวกันค้างคิวอยู่ */
  skippedQueued?: number
  message?: string
}> {
  const res = await fetch('/api/web/jobs/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'สั่งงานไม่สำเร็จ')
  return json
}

/** เร่งคิวเดี๋ยวนี้ ไม่ต้องรอ cron รอบถัดไป */
export async function runQueueNow(): Promise<number> {
  const res = await fetch('/api/web/jobs/next', { method: 'POST' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'รันคิวไม่สำเร็จ')
  return json.ran ?? 0
}

export async function getBatches(limit = 20): Promise<WebBatch[]> {
  const { data, error } = await sb()
    .from('web_run_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    type: r.type as WebJob['type'],
    totalJobs: r.total_jobs,
    doneJobs: r.done_jobs,
    failedJobs: r.failed_jobs,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  }))
}

const toJob = (r: Record<string, unknown>): WebJob => ({
  id: r.id as string,
  batchId: (r.batch_id as string) ?? null,
  type: r.type as WebJob['type'],
  status: r.status as WebJob['status'],
  hostId: (r.host_id as string) ?? null,
  siteId: (r.site_id as string) ?? null,
  siteName: (r.web_sites as { site_name?: string } | null)?.site_name ?? '',
  hostName: (r.web_hosts as { name?: string } | null)?.name ?? '',
  queuedAt: r.queued_at as string,
  startedAt: (r.started_at as string) ?? null,
  finishedAt: (r.finished_at as string) ?? null,
  rawLog: (r.raw_log as string) ?? '',
  summary: (r.summary as Record<string, unknown>) ?? null,
})

export async function getJobs(opts: { batchId?: string; limit?: number } = {}): Promise<WebJob[]> {
  let q = sb()
    .from('web_jobs')
    .select('*, web_sites(site_name), web_hosts(name)')
    .order('queued_at', { ascending: false })
    .limit(opts.limit ?? 100)
  if (opts.batchId) q = q.eq('batch_id', opts.batchId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(toJob)
}

export interface ActiveJob {
  siteId: string | null
  hostId: string | null
  type: WebJob['type']
  status: 'queued' | 'running'
}

/**
 * งานที่ยังไม่จบ — คืนรายตัวไม่ใช่แค่จำนวน เพราะหน้าเว็บต้องรู้ว่า
 * "เว็บไหนกำลังมีงานค้างอยู่" เพื่อปิดปุ่มกันกดซ้ำระหว่างรอคิว
 * (งานค้างมีไม่เกินหลักร้อย ดึงทั้งแถวถูกกว่ายิง count 2 รอบ)
 */
export async function getQueueStatus(): Promise<{
  queued: number
  running: number
  active: ActiveJob[]
}> {
  const { data, error } = await sb()
    .from('web_jobs')
    .select('site_id, host_id, type, status')
    .in('status', ['queued', 'running'])
    .limit(1000)
  if (error) throw error

  const active: ActiveJob[] = (data ?? []).map((r) => ({
    siteId: (r.site_id as string) ?? null,
    hostId: (r.host_id as string) ?? null,
    type: r.type as WebJob['type'],
    status: r.status as 'queued' | 'running',
  }))

  return {
    queued: active.filter((a) => a.status === 'queued').length,
    running: active.filter((a) => a.status === 'running').length,
    active,
  }
}

/* ── ตัวช่วย ────────────────────────────────────────────────────────── */

/** เหลืออีกกี่วันถึงวันหมดอายุ (ติดลบ = เลยมาแล้ว) */
export function daysLeft(date?: string | null): number | null {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

/** วันหมดอายุที่ใกล้ที่สุดของเว็บ (โดเมน/โฮสต์/SSL) */
export function nearestExpiry(site: WebSite): { label: string; date: string; days: number } | null {
  const list = [
    { label: 'โดเมน', date: site.domainExpiresAt },
    { label: 'โฮสต์', date: site.hostingExpiresAt },
    { label: 'SSL', date: site.sslExpiresAt },
  ].filter((x) => x.date) as { label: string; date: string }[]
  if (!list.length) return null
  const withDays = list.map((x) => ({ ...x, days: daysLeft(x.date) ?? 9999 }))
  return withDays.sort((a, b) => a.days - b.days)[0]
}

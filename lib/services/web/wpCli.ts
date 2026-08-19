// lib/services/web/wpCli.ts
//
// สั่งงานบนโฮสต์ของลูกค้าผ่าน SSH (WP-CLI + คำสั่ง shell) — ฝั่งเซิร์ฟเวอร์เท่านั้น
//
// ทำไมต้อง SSH: REST API ของ WordPress สั่ง "อัปเดตปลั๊กอิน" ไม่ได้
// (ทำได้แค่ติดตั้ง/เปิด-ปิด) ทางที่เหลือคือ WP-CLI ซึ่ง Hostinger/SiteGround
// ลงมาให้อยู่แล้ว — คำสั่งทั้งหมดยกมาจากสคริปต์ที่ใช้มือจริงอยู่แล้ว
// (scan.sh · update-plugins.sh · bulk-backup-ai1wm.sh) แค่ตัดให้ทำทีละเว็บ
//
// ยืนยันตัวตนได้ 2 ทาง (เลือกต่อโฮสต์):
//   1. กุญแจ — คีย์เดียวใช้ทุกโฮสต์ เก็บใน env WP_SSH_PRIVATE_KEY
//      (+ WP_SSH_PASSPHRASE) ต้องเอา public key ไปแปะในแผงควบคุมโฮสต์เอง
//   2. รหัสผ่าน — ตั้งรายโฮสต์ เก็บในตาราง web_host_secrets ที่เบราว์เซอร์
//      อ่านไม่ได้เลย (ไม่มี RLS policy) มีแต่ฝั่งเซิร์ฟเวอร์ที่หยิบไปใช้ตอนต่อ
// ⚠️ ไม่ว่าทางไหน รหัส/คีย์ต้องไม่หลุดออกไปหาเบราว์เซอร์เด็ดขาด

import { Client } from 'ssh2'

export interface SshTarget {
  host: string
  port: number
  user: string
  /** กุญแจเฉพาะโฮสต์นี้ (ถอดรหัสมาแล้ว) — มาก่อนทุกอย่าง */
  privateKey?: string
  passphrase?: string
  /** รหัสผ่านเฉพาะโฮสต์นี้ — ใช้เมื่อไม่มีกุญแจ */
  password?: string
}

export interface WpPlugin {
  name: string
  status: string
  update: string
  version: string
  update_version?: string
}

// Vercel ตัดฟังก์ชันที่ 60 วิ — คำสั่งเดียวต้องจบก่อนนั้นเสมอ
// (backup ที่นานกว่านี้ใช้วิธีสั่งแบบ detached แล้วตามผลทีหลัง ดู backupSite)
const TIMEOUT_MS = 45_000

/**
 * ขึ้นต้นข้อความตอน "เราเป็นคนตัดเอง เพราะเวลาหมด" — ไม่ใช่ปลายทางมีปัญหา
 *
 * ผู้เรียกต้องแยกสองอย่างนี้ออกจากกันได้ ไม่งั้นจะไปโทษปลั๊กอินที่จริง ๆ แล้ว
 * อัปเดตได้ แค่บังเอิญคิวมาถึงตอนงบเวลาเหลือน้อย (ตัวนับ "พลาด" ครบ 2 ครั้ง
 * แล้วระบบจะเลิกลองตัวนั้นถาวร — โทษผิดตัวคือเลิกลองของที่ยังใช้ได้)
 */
export const SSH_TIMEOUT_PREFIX = 'SSH หมดเวลา'

/** ครอบสตริงให้ปลอดภัยก่อนยัดลง shell — path/โดเมนมาจาก DB ไม่ควรเชื่อ 100% */
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/** รันคำสั่งเดียวแล้วปิดการเชื่อมต่อ — คืน stdout+exit code (ไม่โยน error เมื่อ code ≠ 0) */
export function sshRun(
  target: SshTarget,
  command: string,
  /** ตัดที่กี่มิลลิวินาที — ส่งมาเองได้เมื่อผู้เรียกมีงบเวลาน้อยกว่าค่าปกติ */
  timeoutMs: number = TIMEOUT_MS
): Promise<{ code: number; out: string; err: string }> {
  // กุญแจกลางจาก env ใช้เมื่อโฮสต์ไม่ได้ตั้งอะไรไว้เอง
  const fallbackKey = process.env.WP_SSH_PRIVATE_KEY
  if (!target.privateKey && !target.password && !fallbackKey) {
    return Promise.reject(
      new Error('โฮสต์นี้ยังไม่ได้ตั้งกุญแจ/รหัสผ่าน และระบบยังไม่มี WP_SSH_PRIVATE_KEY')
    )
  }

  return new Promise((resolve, reject) => {
    const conn = new Client()
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      conn.end()
      reject(new Error(`${SSH_TIMEOUT_PREFIX} (${Math.round(timeoutMs / 1000)} วินาที)`))
    }, timeoutMs)

    conn
      .on('ready', () => {
        conn.exec(command, (e, stream) => {
          if (e) {
            clearTimeout(timer)
            conn.end()
            return reject(e)
          }
          stream
            .on('close', (code: number) => {
              clearTimeout(timer)
              conn.end()
              resolve({ code: code ?? 0, out, err })
            })
            .on('data', (d: Buffer) => (out += d.toString()))
            .stderr.on('data', (d: Buffer) => (err += d.toString()))
        })
      })
      .on('error', (e) => {
        clearTimeout(timer)
        reject(new Error(`ต่อ SSH ไม่ได้: ${e.message}`))
      })
      .connect({
        host: target.host,
        port: target.port || 22,
        username: target.user,
        // กุญแจของโฮสต์ → รหัสผ่านของโฮสต์ → กุญแจกลางใน env
        ...(target.privateKey
          ? { privateKey: target.privateKey, passphrase: target.passphrase }
          : target.password
            ? { password: target.password }
            : {
                privateKey: fallbackKey!.replace(/\\n/g, '\n'),
                passphrase: process.env.WP_SSH_PASSPHRASE || undefined,
              }),
        readyTimeout: 20_000,
      })
  })
}

/** path ใน DB เก็บแบบ relative จาก home (domains/x/public_html) — เผื่อกรอกเป็น absolute มาด้วย */
const at = (path: string) => (path.startsWith('/') ? q(path) : `~/${q(path)}`)

/** wp ... ในโฟลเดอร์เว็บ — skip plugins/themes กันปลั๊กอินพังทำ CLI ล้มทั้งคำสั่ง */
const wpAt = (path: string, args: string) =>
  `cd ${at(path)} && wp ${args} --skip-plugins --skip-themes`

/* ── สำรวจว่าโฮสต์นี้มีเว็บอะไรบ้าง ─────────────────────────────────── */

export interface DiscoveredSite {
  domain: string
  path: string
  wpVersion: string
}

/**
 * ไล่ดูโฟลเดอร์ domains ของโฮสต์ แล้วคืนเฉพาะอันที่เป็น WordPress จริง
 * (ดูจาก wp-config.php) — ใช้จับคู่ว่าเว็บไหนอยู่โฮสต์ไหนโดยไม่ต้องกรอกมือ
 */
export async function discoverSites(target: SshTarget, domainsPath: string): Promise<DiscoveredSite[]> {
  const cmd = [
    `for d in ~/${domainsPath}/*/; do`,
    `  name=$(basename "$d");`,
    `  if [ -f "$d/public_html/wp-config.php" ]; then`,
    `    v=$(cd "$d/public_html" && wp core version --skip-plugins --skip-themes 2>/dev/null | tail -1);`,
    `    echo "$name|${domainsPath}/$name/public_html|$v";`,
    `  fi;`,
    `done`,
  ].join(' ')

  const { out } = await sshRun(target, cmd)
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [domain, path, wpVersion] = l.split('|')
      return { domain, path, wpVersion: wpVersion ?? '' }
    })
    .filter((s) => s.domain && s.path)
}

/* ── ปลั๊กอิน ────────────────────────────────────────────────────────── */

export async function listPlugins(
  target: SshTarget,
  path: string,
  timeoutMs?: number
): Promise<WpPlugin[]> {
  const { out } = await sshRun(target, wpAt(path, 'plugin list --format=json'), timeoutMs)
  const start = out.indexOf('[')
  if (start < 0) throw new Error('อ่านผลจาก WP-CLI ไม่ได้ (path ถูกไหม / มี wp-cli ไหม)')
  return JSON.parse(out.slice(start)) as WpPlugin[]
}

export async function coreVersion(
  target: SshTarget,
  path: string,
  timeoutMs?: number
): Promise<string> {
  const { out } = await sshRun(target, wpAt(path, 'core version'), timeoutMs)
  return out.trim().split('\n').pop()?.trim() ?? ''
}

/** slug = 'all' คืออัปเดตทุกตัวที่ค้าง */
export async function updatePlugins(
  target: SshTarget,
  path: string,
  slug = 'all',
  timeoutMs?: number
) {
  const args = slug === 'all' ? 'plugin update --all' : `plugin update ${q(slug)}`
  return sshRun(target, wpAt(path, args), timeoutMs)
}

/* ── สแกนไฟล์ต้องสงสัย (ยกจาก scan.sh) ──────────────────────────────── */

/** คำที่มัลแวร์ WordPress ใช้บ่อย — ตรงกับ pattern ใน scan.sh ที่ใช้มือ */
export const SCAN_PATTERNS = [
  'fm_login',
  'eval(base64_decode',
  'eval(gzinflate',
  'eval($_POST',
  'eval($_GET',
  'preg_replace("/.*/e"',
  'assert($_',
  'shell_exec(',
  'FilesMan',
  'wso_version',
]

/** หลักฐานต่อ 1 ไฟล์ที่เข้าข่าย — มากพอให้คนหรือ AI ตัดสินได้โดยไม่ต้องเปิดเซิร์ฟเวอร์ */
export interface ScanHit {
  path: string
  /** บรรทัดที่ตรง pattern — เลขบรรทัด + โค้ดจริง (ตัดความยาว) */
  lines: { no: number; text: string }[]
  /** แก้ไขล่าสุดเมื่อไหร่ (ISO) — ไฟล์ PHP ที่เพิ่งถูกแก้คือธงแดง */
  modifiedAt: string | null
  bytes: number | null
}

/** ตัดโค้ดยาว ๆ ทิ้ง — มัลแวร์ชอบยัด base64 ก้อนเดียวยาวเป็นหมื่นตัวอักษร */
const MAX_LINE = 240
const MAX_LINES_PER_FILE = 6

/**
 * ไล่หาไฟล์ที่เข้าข่ายมัลแวร์ พร้อม "หลักฐาน" ไม่ใช่แค่รายชื่อ
 *
 * เดิมคืนแต่ path ซึ่งเอาไปตัดสินอะไรต่อไม่ได้เลย — ไม่รู้ว่าผิดตรงไหน
 * เป็นไฟล์แปลกปลอมทั้งไฟล์หรือไฟล์ดีที่โดนแทรกโค้ด · เจ้าของสั่ง 15 ส.ค. 69
 * ให้เก็บ log ละเอียดพอที่เอาไปให้ AI แก้ต่อได้ทันที
 */
export async function scanSite(target: SshTarget, path: string): Promise<ScanHit[]> {
  const pats = SCAN_PATTERNS.map((p) => `-e ${q(p)}`).join(' ')

  // -n = เลขบรรทัด · -I = ข้ามไฟล์ไบนารี · จำกัดผลกันเว็บที่ติดหนักถล่ม log
  const { out } = await sshRun(
    target,
    `grep -rnI --include='*.php' ${pats} ${at(path)} 2>/dev/null | head -300`
  )

  const byFile = new Map<string, ScanHit>()
  for (const raw of out.split('\n')) {
    // รูปแบบ: /path/to/file.php:123:โค้ด...
    const m = raw.match(/^(.+?):(\d+):([\s\S]*)$/)
    if (!m) continue
    const [, file, no, text] = m
    if (!byFile.has(file)) byFile.set(file, { path: file, lines: [], modifiedAt: null, bytes: null })
    const hit = byFile.get(file)!
    if (hit.lines.length < MAX_LINES_PER_FILE) {
      hit.lines.push({ no: Number(no), text: text.trim().slice(0, MAX_LINE) })
    }
  }

  const files = [...byFile.keys()]
  if (!files.length) return []

  // ดึงเวลาแก้ไข + ขนาดในคำสั่งเดียว ไม่วนยิงทีละไฟล์
  const list = files.slice(0, 60).map((f) => q(f)).join(' ')
  const { out: statOut } = await sshRun(
    target,
    `stat -c '%n|%Y|%s' ${list} 2>/dev/null || true`
  )
  for (const line of statOut.split('\n')) {
    const [name, epoch, size] = line.split('|')
    const hit = name && byFile.get(name.trim())
    if (!hit) continue
    const secs = Number(epoch)
    if (Number.isFinite(secs) && secs > 0) hit.modifiedAt = new Date(secs * 1000).toISOString()
    if (Number.isFinite(Number(size))) hit.bytes = Number(size)
  }

  return [...byFile.values()]
}

/* ── สำรองข้อมูล (ai1wm) + ลบของเก่า ────────────────────────────────── */

/**
 * สั่ง backup แบบ detached (nohup) แล้วรอดูไฟล์สักพัก
 *
 * เว็บใหญ่ ๆ ai1wm ใช้เวลาหลายนาที — ถ้ารอในคำสั่งเดียวจะชน timeout ของ
 * Vercel (60 วิ) แล้ว SSH หลุด กระบวนการฝั่งโฮสต์ก็ตายกลางคัน
 * จึงสั่งให้มันหลุดจาก session ไปเลย (nohup + &) แล้วเฝ้าดูว่ามีไฟล์ใหม่ไหม
 * ไม่ทันในรอบนี้ก็ไม่เป็นไร — งานยังเดินต่อที่โฮสต์ ไฟล์จะโผล่รอบถัดไป
 */
export async function backupSite(
  target: SshTarget,
  path: string,
  keep: number
): Promise<{
  file: string
  size: string
  pending: boolean
  running: boolean
  log: string
  /** ไฟล์ล่าสุดที่มีอยู่บนโฮสต์ก่อนรอบนี้ — ใช้เก็บผลของรอบก่อนที่จบหลังเราเลิกรอ */
  latest: { file: string; at: string; size: string } | null
}> {
  // ⚠️ ห้ามใช้ wpAt() ตรงนี้ — มันต่อ `--skip-plugins` ให้อัตโนมัติ ซึ่งบอก WP-CLI
  // ว่า "อย่าโหลดปลั๊กอิน" แต่คำสั่ง `ai1wm` **เกิดจากปลั๊กอิน** All-in-One WP
  // Migration เอง พอไม่โหลดมันก็ไม่ถูกลงทะเบียน ตอบ "'ai1wm' is not a registered
  // wp command" ตั้งแต่ก่อนเริ่มสำรอง (บั๊กนี้ทำให้สำรองไม่เคยสำเร็จเลยสักครั้ง
  // ตั้งแต่มีระบบ — พิสูจน์บนเว็บจริง 19 ส.ค. 69 รันสองบรรทัดติดกันต่างกันแค่ธง)
  //
  // ธงที่ตัดขยะออกจากไฟล์สำรองเป็นของ ai1wm เอง ชื่อ --exclude-* คนละตัวกับ --skip-*
  // เอาครบทั้งฐานข้อมูล ไฟล์อัปโหลด ธีม ปลั๊กอิน (เจ้าของยืนยัน 19 ส.ค. 69) —
  // เว็บลูกค้าหลายตัวใช้ปลั๊กอิน Pro ที่ license หมด ถ้าไม่ติดไปด้วยจะกู้กลับไม่ได้
  const wpArgs = 'ai1wm backup --exclude-cache --exclude-spam-comments --exclude-post-revisions'

  // ทำทุกอย่างในการต่อ SSH ครั้งเดียว — ของเดิมต่อใหม่ 9 ครั้ง (2 + วนดู 7 รอบ)
  // ครั้งละ ~5.5 วิ บวกเวลานอนอีก 35 วิ = ~84 วิ ทะลุเพดาน Vercel 60 วิ
  // ฟังก์ชันจึงถูกตัดก่อนได้ตอบ งานค้าง running แล้วตัวกวาดงานผีปิดให้ทีหลัง
  // คราวนี้ให้ฝั่งโฮสต์เป็นคนนอนรอเอง เราจ่ายค่าต่อ SSH แค่ครั้งเดียว
  const script = [
    `cd ${at(path)} || exit 9`,
    'BD=wp-content/ai1wm-backups',
    'mkdir -p "$BD"',
    'PREV=$(ls -t "$BD"/*.wpress 2>/dev/null | head -1)',
    // รายงานไฟล์ล่าสุดที่ "มีอยู่แล้ว" กลับไปเสมอ พร้อมเวลาแก้ไขจริงของไฟล์
    // เพราะงานสำรองของเว็บใหญ่จบหลังเราเลิกรอ — ถ้าไม่เก็บตรงนี้ ไฟล์ที่ทำสำเร็จ
    // เมื่อรอบก่อนจะไม่มีวันถูกบันทึก หน้าเว็บก็ขึ้นว่า "ไม่มีไฟล์สำรอง" ตลอดไป
    '[ -n "$PREV" ] && echo "LATEST:$(basename "$PREV")|$(date -r "$PREV" +%s 2>/dev/null)|$(du -h "$PREV" 2>/dev/null | cut -f1)"',
    // ล็อกรายเว็บด้วย PID — โฮสต์อย่าง Hostinger วางหลายเว็บไว้ใต้ผู้ใช้เดียวกัน
    // เช็คด้วย pgrep เฉย ๆ จะไปเห็นงานของเว็บอื่นแล้วนึกว่าของตัวเองกำลังทำอยู่
    'LOCK="$BD/.aoo-backup.pid"',
    'if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then',
    '  echo RUNNING',
    'else',
    '  : > ~/aoo-backup-last.log',
    `  nohup wp ${wpArgs} >> ~/aoo-backup-last.log 2>&1 &`,
    '  echo $! > "$LOCK"',
    '  echo STARTED',
    'fi',
    'for i in 1 2 3 4 5; do',
    '  sleep 5',
    '  F=$(ls -t "$BD"/*.wpress 2>/dev/null | head -1)',
    '  if [ -n "$F" ] && [ "$F" != "$PREV" ]; then',
    '    echo "NEW:$F"',
    '    du -h "$F" 2>/dev/null | cut -f1',
    `    (cd "$BD" && ls -t *.wpress 2>/dev/null | tail -n +${keep + 1} | xargs -r rm -f)`,
    '    rm -f "$LOCK"',
    '    exit 0',
    '  fi',
    'done',
    'echo PENDING',
    // ต่อให้ยังไม่เสร็จก็ต้องส่ง log กลับมาด้วยเสมอ — คำสั่งที่พังทันทีจะโผล่ตรงนี้
    // ของเดิมยิงแบบ `nohup ... & echo started` ซึ่งคืน exit code ของ echo เสมอ 0
    // error จึงไปนอนอยู่ในไฟล์ log ที่ไม่มีใครอ่าน นานเป็นเดือน
    'echo ---LOG---',
    'head -c 600 ~/aoo-backup-last.log 2>/dev/null',
  ].join('\n')

  // นอนฝั่งโฮสต์ 25 วิ + ต่อ SSH ~6 วิ = ~31 วิ · เผื่อถึง 45 ยังห่างเพดาน 60
  const { out } = await sshRun(target, script, 45_000)

  const latestLine = out.split('\n').find((l) => l.startsWith('LATEST:'))
  const latest = (() => {
    if (!latestLine) return null
    const [file, epoch, size] = latestLine.slice(7).split('|')
    const secs = Number(epoch)
    if (!file || !Number.isFinite(secs) || secs <= 0) return null
    return { file, at: new Date(secs * 1000).toISOString(), size: size ?? '' }
  })()

  const running = /^RUNNING$/m.test(out)
  const newLine = out.split('\n').find((l) => l.startsWith('NEW:'))
  if (newLine) {
    const full = newLine.slice(4).trim()
    const size = out.split('\n')[out.split('\n').indexOf(newLine) + 1]?.trim() ?? ''
    return { file: full.split('/').pop() ?? full, size, pending: false, running: false, log: '', latest }
  }

  const tail = out.split('---LOG---')[1]?.trim() ?? ''
  // คำสั่งพังทันที = ไม่ใช่ "กำลังทำเบื้องหลัง" ต้องโยนให้งานล้มพร้อมเหตุผลจริง
  if (/is not a registered wp command|^Error:/m.test(tail)) {
    throw new Error(`สั่ง backup ไม่สำเร็จ — ${tail.split('\n')[0].slice(0, 200)}`)
  }

  return {
    file: '',
    size: '',
    pending: true,
    running,
    latest,
    log: running
      ? 'มีงานสำรองของเว็บนี้ทำค้างอยู่แล้วที่โฮสต์ — รอบนี้ไม่สั่งซ้ำ'
      : `สั่งแล้ว กำลังทำงานเบื้องหลังที่โฮสต์${tail ? `\n${tail}` : ''}`,
  }
}

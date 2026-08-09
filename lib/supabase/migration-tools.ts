/**
 * เครื่องมือช่วงย้ายระบบ (bulk edit / หน้าตรวจสถานะ) เขียนข้อมูลด้วย secret key
 * ซึ่งข้าม RLS ได้ทั้งหมด — ยังไม่มี session ฝั่ง Supabase ให้ตรวจสิทธิ์จริง
 *
 * ระหว่างนี้จึงล็อกด้วย env flag: ต้องตั้ง ENABLE_MIGRATION_TOOLS=true ใน .env.local
 * เท่านั้นถึงเปิดได้ — บน Vercel ไม่ได้ตั้งไว้ ก็จะปิดสนิท
 *
 * ⚠️ ต้องลบไฟล์นี้ + หน้าที่ใช้มัน ทิ้งเมื่อทำ RLS เสร็จ (Phase 6)
 */
export function migrationToolsEnabled() {
  return process.env.ENABLE_MIGRATION_TOOLS === 'true'
}

export function assertMigrationToolsEnabled() {
  if (!migrationToolsEnabled()) {
    throw new Error(
      'เครื่องมือช่วงย้ายระบบถูกปิดอยู่ — ตั้ง ENABLE_MIGRATION_TOOLS=true ใน .env.local ก่อน'
    )
  }
}

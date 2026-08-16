// lib/services/web/jobBudget.ts
//
// งบเวลาของงานอัปเดตปลั๊กอิน 1 ใบ
//
// ── ทำไมต้องแยกเป็นไฟล์ของตัวเอง ────────────────────────────────────
// บั๊ก 15–16 ส.ค. 69 (ล้ม 40 ใบ สำเร็จ 36) เกิดจากค่าคงที่ที่ "บวกกันแล้วเกิน"
// เพดาน 60 วิของ Vercel โดยไม่มีอะไรคอยจับ — งบ 38 วิเช็คแค่ตอนจะเริ่ม
// ปลั๊กอินตัวถัดไป แต่ตัวที่เริ่มไปแล้วยังรันต่อได้อีก 45 วิ (timeout ของ SSH)
// แถมไม่ได้กันเวลาไว้ให้ 2 คำสั่งปิดท้าย
//
// พอฟังก์ชันโดนตัด ใบงานค้างสถานะ running แล้วตัวกวาดงานผีปิดเป็น failed
// อีก 5 นาทีถัดมา — ระหว่างนั้นคิวของโฮสต์นั้นถูกดองไปด้วย
//
// อยู่ที่นี่เพื่อให้ `scripts/test-job-budget.mjs` ผูกตัวเลขไว้ได้ ใครมาแก้
// ค่าใดค่าหนึ่งแล้วผลรวมเกิน 60 วิ เทสต์จะตกทันที ไม่ต้องรอเว็บลูกค้าพัง

/** Vercel ตัดฟังก์ชันที่ 60 วิ — ทุกอย่างต้องจบก่อนนั้น */
export const VERCEL_LIMIT_MS = 60_000

/** ทั้งใบต้องจบใน 45 วิ — เหลือ 15 วิให้ claim + finish + ความหน่วงของ Vercel */
export const JOB_BUDGET_MS = 45_000

/**
 * กันไว้ให้ listPlugins ใบสอง + coreVersion ที่ต้องทำหลังลูป
 * ตั้งจากของจริง: งาน plugin_check (= listPlugins + coreVersion) median 11.1 วิ
 * สูงสุด 14.4 วิ รวมเวลาต่อ SSH สองครั้ง
 */
export const TAIL_RESERVE_MS = 14_000

/** listPlugins ใบแรกก็ต้องคุม ไม่งั้นกิน timeout ปกติ 45 วิได้คนเดียว */
export const FIRST_LIST_MS = 15_000

/** coreVersion เป็นคำสั่งสั้น ๆ */
export const CORE_VERSION_MS = 5_000

/**
 * ปลั๊กอินตัวเดียวได้มากสุดเท่านี้ ต่อให้เวลายังเหลือเยอะ
 * ของจริง: median 10.6 วิ · p90 18 วิ · max 39.5 วิ — 25 วิคลุม p90 แบบมีเผื่อ
 *
 * ตัวที่เกินเพดานนี้จริง ๆ จะถูกนับว่า "พลาด" ตามปกติ ไม่ใช่ยกไปรอบหน้าเรื่อย ๆ
 * ไม่งั้นมันจะถูกลองใหม่ทุกคืนไปตลอดกาลโดยไม่มีใครรู้
 */
export const PLUGIN_MAX_MS = 25_000

/** เหลือน้อยกว่านี้ไม่ต้องเริ่มตัวใหม่ — ตั้งคร่อม median 10.6 วิ ให้ตัวปกติจบทัน */
export const PLUGIN_MIN_MS = 10_000

/** ลูปอัปเดตต้องจบก่อนวินาทีนี้ (นับจากวินาทีแรกของงาน) */
export const LOOP_DEADLINE_MS = JOB_BUDGET_MS - TAIL_RESERVE_MS

/** เหลือเท่านี้ ยังคุ้มที่จะเริ่มปลั๊กอินตัวใหม่ไหม */
export const canStartPlugin = (leftMs: number) => leftMs >= PLUGIN_MIN_MS

/**
 * ปลั๊กอินตัวนี้ได้เวลาเท่าไหร่
 *
 * cap ที่ `leftMs` ด้วย จึงไม่มีทางพาลูปเลย deadline ได้เลย — ต่างจากของเดิม
 * ที่เช็คเวลาก่อนเริ่มแล้วปล่อยให้รันยาว 45 วิตายตัว
 */
export const pluginTimeoutMs = (leftMs: number) => Math.min(PLUGIN_MAX_MS, leftMs)

/** เวลาที่เหลือให้ 2 คำสั่งปิดท้าย เมื่อลูปใช้ไป `elapsedMs` แล้ว */
export const tailTimeoutMs = (elapsedMs: number) =>
  Math.min(TAIL_RESERVE_MS, Math.max(5_000, JOB_BUDGET_MS - elapsedMs))

/** เวลารวมที่แย่ที่สุดที่งาน 1 ใบจะใช้ (ไม่รวมงานนอก runPluginUpdate) */
export const worstCaseMs = () =>
  LOOP_DEADLINE_MS + tailTimeoutMs(LOOP_DEADLINE_MS) + CORE_VERSION_MS

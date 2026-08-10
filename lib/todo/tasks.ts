// lib/todo/tasks.ts
//
// รายการ "สิ่งที่ต้องทำ" ของพนักงานแต่ละคน — ทะเบียนกลางที่เดียว
//
// ── ทำไมต้องรวมไว้ที่เดียว ────────────────────────────────────────────
// เงื่อนไขพวกนี้ถูกถามจากหลายที่ที่คนละจังหวะกัน:
//   · LINE callback   — ตอนเพิ่งล็อกอินเสร็จ ตัดสินว่าจะพาไปหน้าไหน
//   · ProtectedRoute  — ทุกหน้าในระบบ กันคนที่ล็อกอินค้างไว้ตั้งแต่ก่อนมีกติกา
//   · หน้า /setup     — หน้าบังคับทำให้ครบก่อนเข้าระบบ
//   · TodoZone        — กล่องบนหน้าแรก สำหรับเรื่องที่ยังค้าง
// ถ้าแยกเขียนหลายที่ พอเพิ่มเงื่อนไขใหม่แล้วแก้ไม่ครบ จะกลายเป็นวนลูป
// (หน้าหนึ่งบอกว่ายังไม่ครบ อีกหน้าบอกว่าครบแล้ว เด้งไปมาไม่จบ)
//
// ── เพิ่มเรื่องใหม่ในอนาคต ────────────────────────────────────────────
// เติม 1 ก้อนใน TODO_TASKS ก็พอ ทั้งหน้าบังคับและกล่องบนหน้าแรกขึ้นเองทั้งคู่
//   · blocking: true  = ทำไม่ครบเข้าระบบไม่ได้ (ต้องไปเพิ่มการ์ดใน /setup ด้วย)
//   · blocking: false = ขึ้นเตือนในกล่องเฉย ๆ ใช้งานระบบต่อได้

import type { UserData } from '@/lib/services/user/mappers'

export type TodoTaskId = 'name' | 'discord'

export type TodoTask = {
  id: TodoTaskId
  title: string
  /** บอกว่าทำไมต้องทำ — คนอ่านแล้วต้องเข้าใจโดยไม่ต้องถามใคร */
  why: string
  /** true = ยังไม่ทำแล้วเข้าใช้งานระบบไม่ได้ */
  blocking: boolean
  done: (user: UserData) => boolean
  /** ไปทำต่อที่ไหน */
  href: string
  cta: string
}

export const TODO_TASKS: TodoTask[] = [
  {
    id: 'name',
    title: 'กรอกชื่อจริงและชื่อเล่น',
    // ชื่อ LINE เป็นชื่อที่เจ้าตัวตั้งเอง เช่น "🌨️🌈🌻" — เปิดรายงานมาแล้วไม่รู้ว่าใคร
    why: 'ชื่อใน LINE ดูไม่ออกว่าใครเป็นใคร รายงานและใบลาจึงตรวจสอบไม่ได้',
    blocking: true,
    done: (u) => !!u.nameVerified && !!u.nickname?.trim(),
    href: '/setup',
    cta: 'กรอกชื่อ',
  },
  {
    id: 'discord',
    title: 'เชื่อมต่อบัญชี Discord',
    // LINE ยังเป็นตัวยืนยันตัวตน ส่วน Discord ไว้ mention ตอนแจ้งเตือน
    why: 'ระบบใช้ Discord เรียกถึงตัวคุณโดยตรง — แจ้งวันเกิด เตือนลืมเช็คเอาท์ แจ้งผลอนุมัติลา',
    blocking: true,
    done: (u) => !!u.discordUserId,
    href: '/setup',
    cta: 'เชื่อมต่อ',
  },
]

/** เรื่องที่ยังไม่ได้ทำ — ทั้งที่บังคับและไม่บังคับ */
export function pendingTodos(user: UserData | null | undefined): TodoTask[] {
  if (!user) return []
  // Dev Admin / Super Admin ไม่ใช่คน ไม่มีชื่อเล่นและไม่มี Discord ให้ผูก
  // ถ้าไม่ยกเว้นตรงนี้ จะเข้าระบบไม่ได้เลยตอนต้องแก้ปัญหาฉุกเฉิน
  if (user.isSystem) return []
  return TODO_TASKS.filter((t) => !t.done(user))
}

/** เฉพาะเรื่องที่ไม่ทำแล้วเข้าระบบไม่ได้ */
export const blockingTodos = (user: UserData | null | undefined) =>
  pendingTodos(user).filter((t) => t.blocking)

export const needsSetup = (user: UserData | null | undefined) =>
  blockingTodos(user).length > 0

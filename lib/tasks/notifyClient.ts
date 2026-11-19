// lib/tasks/notifyClient.ts
//
// ฝั่งเบราว์เซอร์: บอก server ว่าเพิ่งเกิดอะไรกับงาน ให้ยิง push ไปมือถือคนที่เกี่ยว — ยิงแล้วไม่รอ
// แจ้งเตือนพลาดต้องไม่ทำให้การบันทึกงานดูเหมือนล้ม · ใครได้รับ/ข้อความ ตัดสินที่ server (lib/tasks/reminders.ts)
import type { TaskActionEvent } from './reminders'

export function taskNotify(event: TaskActionEvent, taskId: string, userIds?: string[]): void {
  if (typeof window === 'undefined') return
  if (event === 'assigned' && !userIds?.length) return
  fetch('/api/tasks/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, taskId, userIds }),
    keepalive: true,
  }).catch(() => {})
}

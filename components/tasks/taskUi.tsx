'use client'

// ไอคอนสถานะงาน — ใช้ทั้งหัวคอลัมน์และปุ่มเลือกสถานะ (เจ้าของขอเป็นไอคอน 28 ต.ค. 69)

import { CheckCircle2, Circle, Timer } from 'lucide-react'
import type { ComponentType } from 'react'
import type { StepTone } from '@/components/aoo'
import type { TaskStatus } from '@/lib/services/taskService'

export const STATUS_ICON: Record<TaskStatus, ComponentType<{ size?: number }>> = {
  todo: Circle,
  doing: Timer,
  done: CheckCircle2,
}

/** สีของแต่ละสถานะ — ปุ่มขั้นในหน้าต่างงานกับป้ายหัวคอลัมน์ใช้ชุดเดียวกัน (เจ้าของขอให้ต่างสี 28 ต.ค. 69) */
export const STATUS_TONE: Record<TaskStatus, StepTone & ('warning' | 'sky' | 'success')> = {
  todo: 'warning',
  doing: 'sky',
  done: 'success',
}

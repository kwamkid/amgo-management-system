// Plan templates — phases, starter KPI targets (target 0 = fill in later) and starter actions.
// Actions become ordinary tasks (plan_id + phase); due = plan start + offset days.

import { addDays, format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Metric, Phase } from '@/lib/services/marketingService'

export interface PlanTemplate {
  key: string
  label: string
  hint: string
  goal: string
  channels: string[]
  phases: Phase[]
  targets: { metric: Metric; channel: string; source: 'auto' | 'manual' }[]
  actions: { phase: string; title: string; day: number }[]
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    key: 'blank',
    label: 'แผนเปล่า',
    hint: 'มีแค่ 3 ช่วง ไม่มีงานตั้งต้น',
    goal: '',
    channels: [],
    phases: [
      { key: 'P0', label: 'เตรียมก่อนเปิด' },
      { key: 'P1', label: 'เปิดตัว' },
      { key: 'P2', label: 'ต่อเนื่อง' },
    ],
    targets: [],
    actions: [],
  },
  {
    key: 'launch',
    label: 'เปิดตัวแบรนด์ / สินค้าใหม่',
    hint: '3 ช่วง · เป้ายอดขาย ผู้ติดตาม โพสต์ ค่าโฆษณา · งานตั้งต้น 14 ข้อ',
    goal: 'เปิดตัวให้คนรู้จักแบรนด์ และขายล็อตแรกให้หมดตามเป้า',
    channels: ['shopee', 'lazada', 'tiktok_shop', 'facebook', 'instagram', 'tiktok', 'store'],
    phases: [
      { key: 'P0', label: 'เตรียมก่อนเปิด' },
      { key: 'P1', label: 'เปิดตัว' },
      { key: 'P2', label: 'ต่อเนื่อง' },
    ],
    targets: [
      { metric: 'sales_thb', channel: 'all', source: 'auto' },
      { metric: 'sales_pcs', channel: 'all', source: 'auto' },
      { metric: 'followers', channel: 'facebook', source: 'auto' },
      { metric: 'followers', channel: 'tiktok', source: 'auto' },
      { metric: 'posts', channel: 'all', source: 'auto' },
      { metric: 'ad_spend', channel: 'all', source: 'manual' },
      { metric: 'roas', channel: 'all', source: 'manual' },
    ],
    actions: [
      { phase: 'P0', title: 'เช็คคลิป/รูปจากแบรนด์ ตัดที่มีภาษาต่างประเทศ ใส่ซับไทย', day: 0 },
      { phase: 'P0', title: 'ทำรูปโปรไฟล์ + ปก FB/IG/TikTok', day: 2 },
      { phase: 'P0', title: 'ลงสินค้า Shopee / Lazada / TikTok Shop (รูป + คำอธิบาย + ราคา)', day: 5 },
      { phase: 'P0', title: 'ตั้งราคาเปิดตัว + โค้ดส่วนลด', day: 5 },
      { phase: 'P0', title: 'วางปฏิทินโพสต์ 4 สัปดาห์แรกใน aoosocial', day: 7 },
      { phase: 'P0', title: 'ติดต่ออินฟลูเอนเซอร์ / KOL รอบแรก', day: 7 },
      { phase: 'P1', title: 'โพสต์เปิดตัว + teaser ทุกช่องทาง', day: 10 },
      { phase: 'P1', title: 'ยิงโฆษณาเปิดตัว (TikTok / Shopee / Meta)', day: 10 },
      { phase: 'P1', title: 'Live ขายเปิดตัว', day: 14 },
      { phase: 'P1', title: 'วางสินค้าโชว์หน้าร้าน + ป้าย', day: 14 },
      { phase: 'P1', title: 'สรุปผลสัปดาห์แรก ปรับงบโฆษณา', day: 17 },
      { phase: 'P2', title: 'รีวิวจากลูกค้า / UGC รอบแรก', day: 30 },
      { phase: 'P2', title: 'แคมเปญวันสำคัญถัดไป (เช่น 12.12 / วันเด็ก)', day: 35 },
      { phase: 'P2', title: 'สรุปผลแผน + บทเรียน', day: 85 },
    ],
  },
  {
    key: 'campaign',
    label: 'แคมเปญรายเดือน / วันสำคัญ',
    hint: '3 ช่วง · เป้ายอดขาย ค่าโฆษณา ROAS · งานตั้งต้น 8 ข้อ',
    goal: 'ดันยอดขายช่วงแคมเปญให้ถึงเป้า',
    channels: ['shopee', 'lazada', 'tiktok_shop', 'facebook'],
    phases: [
      { key: 'P0', label: 'เตรียม' },
      { key: 'P1', label: 'ช่วงแคมเปญ' },
      { key: 'P2', label: 'สรุป' },
    ],
    targets: [
      { metric: 'sales_thb', channel: 'all', source: 'auto' },
      { metric: 'posts', channel: 'all', source: 'auto' },
      { metric: 'ad_spend', channel: 'all', source: 'manual' },
      { metric: 'roas', channel: 'all', source: 'manual' },
    ],
    actions: [
      { phase: 'P0', title: 'เลือกสินค้าเด่น + ตั้งราคาแคมเปญ', day: 0 },
      { phase: 'P0', title: 'สมัครแคมเปญ Shopee / Lazada / TikTok Shop', day: 1 },
      { phase: 'P0', title: 'ทำรูป/คลิปแคมเปญ + แบนเนอร์ร้าน', day: 3 },
      { phase: 'P0', title: 'ตั้งโพสต์ล่วงหน้าใน aoosocial', day: 5 },
      { phase: 'P1', title: 'ยิงโฆษณาช่วงแคมเปญ', day: 7 },
      { phase: 'P1', title: 'Live ขายวันแคมเปญ', day: 10 },
      { phase: 'P1', title: 'เช็คสต็อก + เติมของระหว่างแคมเปญ', day: 10 },
      { phase: 'P2', title: 'สรุปยอด + ROAS ต่อช่องทาง', day: 14 },
    ],
  },
]

/** create the template's targets + starter tasks on a new plan */
export async function applyTemplate(t: PlanTemplate, planId: string, brand: string, start: string): Promise<void> {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (t.targets.length) {
    const { error } = await sb
      .from('marketing_targets')
      .insert(t.targets.map((x, i) => ({ plan_id: planId, metric: x.metric, channel: x.channel, source: x.source, target: 0, sort: i })))
    if (error) throw error
  }
  if (t.actions.length) {
    const base = parseISO(start)
    const { error } = await sb.from('tasks').insert(
      t.actions.map((a, i) => ({
        title: a.title,
        brand,
        plan_id: planId,
        phase: a.phase,
        due_date: format(addDays(base, a.day), 'yyyy-MM-dd'),
        sort_order: i,
        created_by: user?.id ?? null,
      }))
    )
    if (error) throw error
  }
}

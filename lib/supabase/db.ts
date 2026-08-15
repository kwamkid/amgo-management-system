import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * client ตัวไหนก็ได้ที่คุยกับฐานข้อมูลนี้
 *
 * ฟังก์ชัน service ส่วนใหญ่เรียกจากหน้าเว็บ จึงใช้ client ฝั่งเบราว์เซอร์ (มี RLS)
 * เป็นค่าปริยาย — แต่งาน cron ไม่มีผู้ใช้ล็อกอิน ต้องส่ง client ฝั่ง server
 * (createAdminClient) เข้ามาแทน ไม่งั้น RLS ตัดข้อมูลทิ้งจนได้ผลว่าง ๆ แบบเงียบ ๆ
 *
 * เป็น type อย่างเดียว ไม่ผูกกับตัว client จริง — ไฟล์ 'use client' import ได้
 */
export type Db = SupabaseClient<Database>

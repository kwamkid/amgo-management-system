// 🗑️ หน้าเก่า — รวมเข้าไปเป็นข้อ 2 ของ /setup แล้ว
//
// เหลือไว้เพราะยังมีคนที่ค้างหน้านี้ไว้ในแท็บ หรือกดจากลิงก์เก่าใน Discord
// ปล่อยให้ 404 จะกลายเป็น "กดแล้วเจอหน้าเสีย" ทั้งที่ทำถูกทุกอย่าง

import { redirect } from 'next/navigation'

export default async function LinkDiscordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  redirect(error ? `/setup?error=${encodeURIComponent(error)}` : '/setup')
}

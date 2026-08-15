// lib/services/brandService.ts
//
// แบรนด์ของโมดูลอินฟลูเอนเซอร์ — ย้ายจาก Firestore มา Supabase (15 ส.ค. 69)
// หน้าตา API เหมือนเดิมทุกฟังก์ชัน หน้าจอที่เรียกอยู่จึงไม่ต้องแก้

import { createClient } from '@/lib/supabase/client'
import { Brand } from '@/types/influencer'
import type { Database } from '@/types/database'

const sb = () => createClient()

type Row = {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const toBrand = (r: Row): Brand =>
  ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    logoUrl: r.logo_url ?? '',
    isActive: r.is_active,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }) as Brand

export const getBrands = async (includeInactive = false): Promise<Brand[]> => {
  let q = sb().from('brands').select('*').order('name')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => toBrand(r as Row))
}

export const getBrand = async (brandId: string): Promise<Brand | null> => {
  const { data, error } = await sb().from('brands').select('*').eq('id', brandId).maybeSingle()
  if (error) throw error
  return data ? toBrand(data as Row) : null
}

export const createBrand = async (
  data: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const { data: row, error } = await sb()
    .from('brands')
    .insert({
      name: data.name,
      description: data.description ?? null,
      logo_url: (data as { logoUrl?: string }).logoUrl ?? null,
      is_active: true,
    })
    .select('id')
    .single()
  if (error) throw error
  return row.id
}

export const updateBrand = async (brandId: string, data: Partial<Brand>): Promise<void> => {
  const patch: Database['public']['Tables']['brands']['Update'] = {
    updated_at: new Date().toISOString(),
  }
  if (data.name !== undefined) patch.name = data.name
  if (data.description !== undefined) patch.description = data.description
  if ((data as { logoUrl?: string }).logoUrl !== undefined)
    patch.logo_url = (data as { logoUrl?: string }).logoUrl
  if (data.isActive !== undefined) patch.is_active = data.isActive

  const { error } = await sb().from('brands').update(patch).eq('id', brandId)
  if (error) throw error
}

/** ลบแบบนุ่ม — ปิดใช้งานไว้ ไม่ลบจริง (แคมเปญเก่ายังอ้างถึงอยู่) */
export const deleteBrand = async (brandId: string): Promise<void> => {
  const { error } = await sb()
    .from('brands')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', brandId)
  if (error) throw error
}

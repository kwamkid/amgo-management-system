// lib/services/productService.ts
//
// สินค้าของโมดูลอินฟลูเอนเซอร์ — ย้ายจาก Firestore มา Supabase (15 ส.ค. 69)
// ของเดิมเก็บ brandName ซ้ำไว้ในเอกสาร ของใหม่ join เอาจากตาราง brands แทน

import { createClient } from '@/lib/supabase/client'
import { Product } from '@/types/influencer'
import type { Database } from '@/types/database'

const sb = () => createClient()

type Row = {
  id: string
  brand_id: string
  name: string
  description: string | null
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  brands?: { name?: string } | null
}

const toProduct = (r: Row): Product =>
  ({
    id: r.id,
    brandId: r.brand_id,
    brandName: r.brands?.name ?? '',
    name: r.name,
    description: r.description ?? '',
    imageUrl: r.image_url ?? '',
    isActive: r.is_active,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }) as Product

const SELECT = '*, brands(name)'

export const getProducts = async (brandId?: string, includeInactive = false): Promise<Product[]> => {
  let q = sb().from('products').select(SELECT).order('name')
  if (brandId) q = q.eq('brand_id', brandId)
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => toProduct(r as unknown as Row))
}

export const getProductsByBrand = async (brandId: string): Promise<Product[]> =>
  getProducts(brandId)

export const getProductsByBrands = async (brandIds: string[]): Promise<Product[]> => {
  if (!brandIds.length) return []
  const { data, error } = await sb()
    .from('products')
    .select(SELECT)
    .in('brand_id', brandIds)
    .eq('is_active', true)
    .order('brand_id')
    .order('name')
  if (error) throw error
  return (data ?? []).map((r) => toProduct(r as unknown as Row))
}

export const getProduct = async (productId: string): Promise<Product | null> => {
  const { data, error } = await sb().from('products').select(SELECT).eq('id', productId).maybeSingle()
  if (error) throw error
  return data ? toProduct(data as unknown as Row) : null
}

export const createProduct = async (
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const { data: row, error } = await sb()
    .from('products')
    .insert({
      brand_id: data.brandId,
      name: data.name,
      description: data.description ?? null,
      image_url: (data as { imageUrl?: string }).imageUrl ?? null,
      is_active: true,
    })
    .select('id')
    .single()
  if (error) throw error
  return row.id
}

export const updateProduct = async (productId: string, data: Partial<Product>): Promise<void> => {
  const patch: Database['public']['Tables']['products']['Update'] = {
    updated_at: new Date().toISOString(),
  }
  if (data.brandId !== undefined) patch.brand_id = data.brandId
  if (data.name !== undefined) patch.name = data.name
  if (data.description !== undefined) patch.description = data.description
  if ((data as { imageUrl?: string }).imageUrl !== undefined)
    patch.image_url = (data as { imageUrl?: string }).imageUrl
  if (data.isActive !== undefined) patch.is_active = data.isActive

  const { error } = await sb().from('products').update(patch).eq('id', productId)
  if (error) throw error
}

/** ลบแบบนุ่ม — ปิดใช้งานไว้ ไม่ลบจริง (แคมเปญเก่ายังอ้างถึงอยู่) */
export const deleteProduct = async (productId: string): Promise<void> => {
  const { error } = await sb()
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', productId)
  if (error) throw error
}

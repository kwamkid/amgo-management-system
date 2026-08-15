// lib/services/influencerService.ts
//
// อินฟลูเอนเซอร์ — ย้ายจาก Firestore มา Supabase (15 ส.ค. 69)
//
// ของเดิมเก็บ children/socialChannels เป็น array ในเอกสารเดียว
// ของใหม่แยกเป็นตาราง influencer_children / social_channels แล้ว join กลับมา
// ให้หน้าจอเห็นรูปแบบเดิม — หน้าที่เรียกอยู่จึงไม่ต้องแก้
//
// การแบ่งหน้าเปลี่ยนจาก DocumentSnapshot ของ Firestore เป็น cursor เวลาสร้าง
// (created_at ของแถวสุดท้าย) — เร็วกว่า offset และไม่ข้ามแถวเวลามีคนเพิ่มใหม่

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import {
  Influencer,
  CreateInfluencerData,
  SocialChannel,
  Child,
  calculateInfluencerTier,
} from '@/types/influencer'

const sb = () => createClient()

/** ตัวชี้หน้าถัดไป = created_at ของแถวสุดท้ายที่โหลดมา */
export type InfluencerCursor = string | null

const SELECT = '*, social_channels(*), influencer_children(*)'

type ChannelRow = {
  id: string
  platform: string
  username: string | null
  profile_url: string | null
  follower_count: number | null
  is_verified: boolean | null
}
type ChildRow = { id: string; nickname: string; birth_date: string | null; gender: string | null }

const toInfluencer = (r: Record<string, unknown>): Influencer =>
  ({
    id: r.id as string,
    fullName: (r.full_name as string) ?? '',
    nickname: (r.nickname as string) ?? '',
    phone: (r.phone as string) ?? '',
    email: (r.email as string) ?? '',
    lineId: (r.line_id as string) ?? '',
    tier: r.tier as Influencer['tier'],
    totalFollowers: (r.total_followers as number) ?? 0,
    province: (r.province as string) ?? '',
    shippingAddress: (r.shipping_address as string) ?? '',
    notes: (r.notes as string) ?? '',
    birthDate: (r.birth_date as string) ?? '',
    isActive: (r.is_active as boolean) ?? true,
    createdAt: r.created_at ? new Date(r.created_at as string) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at as string) : undefined,
    socialChannels: ((r.social_channels as ChannelRow[]) ?? []).map((c) => ({
      id: c.id,
      platform: c.platform,
      username: c.username ?? '',
      profileUrl: c.profile_url ?? '',
      followerCount: c.follower_count ?? 0,
      isVerified: c.is_verified ?? false,
    })),
    children: ((r.influencer_children as ChildRow[]) ?? []).map((c) => ({
      id: c.id,
      nickname: c.nickname,
      birthDate: c.birth_date ?? '',
      gender: c.gender ?? '',
    })),
  }) as unknown as Influencer

/* ── อ่าน ────────────────────────────────────────────────────────────── */

export const getInfluencers = async (
  pageSize = 20,
  cursor?: InfluencerCursor,
  filters?: { tier?: string; platform?: string; searchTerm?: string; isActive?: boolean }
): Promise<{ influencers: Influencer[]; lastDoc: InfluencerCursor; hasMore: boolean }> => {
  let q = sb()
    .from('influencers')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1)

  if (filters?.tier) q = q.eq('tier', filters.tier)
  if (filters?.isActive !== undefined) q = q.eq('is_active', filters.isActive)
  if (cursor) q = q.lt('created_at', cursor)

  const { data, error } = await q
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > pageSize
  const page = rows.slice(0, pageSize)
  const influencers = page.map((r) => toInfluencer(r as Record<string, unknown>))

  return {
    influencers,
    lastDoc: (page.at(-1) as { created_at?: string } | undefined)?.created_at ?? null,
    hasMore,
  }
}

export const getInfluencer = async (influencerId: string): Promise<Influencer | null> => {
  const { data, error } = await sb().from('influencers').select(SELECT).eq('id', influencerId).maybeSingle()
  if (error) throw error
  return data ? toInfluencer(data as Record<string, unknown>) : null
}

export const searchInfluencers = async (searchTerm: string): Promise<Influencer[]> => {
  const term = searchTerm.trim()
  if (!term) return []
  const { data, error } = await sb()
    .from('influencers')
    .select(SELECT)
    .eq('is_active', true)
    .or(`full_name.ilike.%${term}%,nickname.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
    .order('full_name')
    .limit(100)
  if (error) throw error
  return (data ?? []).map((r) => toInfluencer(r as Record<string, unknown>))
}

export const getInfluencersByPlatform = async (platform: string): Promise<Influencer[]> => {
  const { data: ids, error } = await sb()
    .from('social_channels')
    .select('influencer_id')
    .eq('platform', platform)
  if (error) throw error
  const list = [...new Set((ids ?? []).map((r) => r.influencer_id))]
  if (!list.length) return []

  const { data, error: e2 } = await sb()
    .from('influencers')
    .select(SELECT)
    .in('id', list)
    .eq('is_active', true)
    .order('full_name')
  if (e2) throw e2
  return (data ?? []).map((r) => toInfluencer(r as Record<string, unknown>))
}

/* ── เขียน ───────────────────────────────────────────────────────────── */

const channelRows = (influencerId: string, channels: Partial<SocialChannel>[] = []) =>
  channels
    .filter((c) => c.platform)
    .map((c) => ({
      influencer_id: influencerId,
      platform: c.platform as string,
      username: c.username ?? '',
      profile_url: c.profileUrl ?? '',
      follower_count: c.followerCount ?? 0,
      is_verified: c.isVerified ?? false,
    }))

const childRows = (influencerId: string, children: Partial<Child>[] = []) =>
  children
    .filter((c) => c.nickname)
    .map((c) => ({
      influencer_id: influencerId,
      nickname: c.nickname as string,
      birth_date: c.birthDate ? String(c.birthDate).slice(0, 10) : null,
      gender: c.gender ?? null,
    }))

export const createInfluencer = async (
  data: CreateInfluencerData,
  createdBy: string
): Promise<string> => {
  const channels = data.socialChannels ?? []
  const totalFollowers = channels.reduce((sum, c) => sum + (c.followerCount || 0), 0)
  const tier = data.tier || calculateInfluencerTier(totalFollowers)

  const { data: row, error } = await sb()
    .from('influencers')
    .insert({
      full_name: data.fullName,
      nickname: data.nickname || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      line_id: data.lineId || undefined,
      tier,
      total_followers: totalFollowers,
      province: data.province || undefined,
      shipping_address: data.shippingAddress || undefined,
      notes: data.notes || undefined,
      birth_date: data.birthDate ? String(data.birthDate).slice(0, 10) : null,
      is_active: true,
      created_by: createdBy || undefined,
    })
    .select('id')
    .single()
  if (error) throw error

  const id = row.id as string
  const chans = channelRows(id, channels)
  const kids = childRows(id, data.children ?? [])
  if (chans.length) await sb().from('social_channels').insert(chans)
  if (kids.length) await sb().from('influencer_children').insert(kids)
  return id
}

export const updateInfluencer = async (
  influencerId: string,
  data: Partial<Influencer>,
  updatedBy: string
): Promise<void> => {
  const patch: Database['public']['Tables']['influencers']['Update'] = {
    updated_at: new Date().toISOString(),
  }
  const map: Record<string, string> = {
    fullName: 'full_name',
    nickname: 'nickname',
    phone: 'phone',
    email: 'email',
    lineId: 'line_id',
    province: 'province',
    shippingAddress: 'shipping_address',
    notes: 'notes',
    birthDate: 'birth_date',
    isActive: 'is_active',
    tier: 'tier',
  }
  for (const [k, col] of Object.entries(map)) {
    const v = (data as Record<string, unknown>)[k]
    if (v !== undefined && v !== null)
      (patch as Record<string, unknown>)[col] = v instanceof Date ? v.toISOString().slice(0, 10) : v
  }

  // ช่องทางโซเชียลเปลี่ยน = ยอดผู้ติดตามรวมและระดับเปลี่ยนตาม
  if (data.socialChannels) {
    const total = data.socialChannels.reduce((s, c) => s + (c.followerCount || 0), 0)
    patch.total_followers = total
    if (!('tier' in data)) patch.tier = calculateInfluencerTier(total)

    // แทนที่ทั้งชุด — ง่ายและตรงกับพฤติกรรมเดิมที่เขียนทับทั้ง array
    await sb().from('social_channels').delete().eq('influencer_id', influencerId)
    const rows = channelRows(influencerId, data.socialChannels)
    if (rows.length) await sb().from('social_channels').insert(rows)
  }

  if (data.children) {
    await sb().from('influencer_children').delete().eq('influencer_id', influencerId)
    const rows = childRows(influencerId, data.children)
    if (rows.length) await sb().from('influencer_children').insert(rows)
  }

  const { error } = await sb().from('influencers').update(patch).eq('id', influencerId)
  if (error) throw error
  void updatedBy // เดิมเก็บ updatedBy ไว้ในเอกสาร — ตารางใหม่ยังไม่มีคอลัมน์นี้
}

export const updateSocialChannel = async (
  influencerId: string,
  channel: SocialChannel,
  updatedBy: string
): Promise<void> => {
  const inf = await getInfluencer(influencerId)
  if (!inf) throw new Error('ไม่พบอินฟลูเอนเซอร์')
  const channels = inf.socialChannels || []
  const i = channels.findIndex((c) => c.id === channel.id)
  if (i >= 0) channels[i] = channel
  else channels.push(channel)
  await updateInfluencer(influencerId, { socialChannels: channels }, updatedBy)
}

export const removeSocialChannel = async (
  influencerId: string,
  channelId: string,
  updatedBy: string
): Promise<void> => {
  const inf = await getInfluencer(influencerId)
  if (!inf) throw new Error('ไม่พบอินฟลูเอนเซอร์')
  await updateInfluencer(
    influencerId,
    { socialChannels: (inf.socialChannels || []).filter((c) => c.id !== channelId) },
    updatedBy
  )
}

export const addChild = async (
  influencerId: string,
  child: Omit<Child, 'id'>,
  updatedBy: string
): Promise<void> => {
  const inf = await getInfluencer(influencerId)
  if (!inf) throw new Error('ไม่พบอินฟลูเอนเซอร์')
  await updateInfluencer(
    influencerId,
    { children: [...(inf.children || []), { ...child, id: '' } as Child] },
    updatedBy
  )
}

export const removeChild = async (
  influencerId: string,
  childId: string,
  updatedBy: string
): Promise<void> => {
  const inf = await getInfluencer(influencerId)
  if (!inf) throw new Error('ไม่พบอินฟลูเอนเซอร์')
  await updateInfluencer(
    influencerId,
    { children: (inf.children || []).filter((c) => c.id !== childId) },
    updatedBy
  )
}

/** ลบแบบนุ่ม — ปิดใช้งาน + ประทับเวลาลบ (แคมเปญเก่ายังอ้างถึงอยู่) */
export const deleteInfluencer = async (influencerId: string): Promise<void> => {
  const { error } = await sb()
    .from('influencers')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', influencerId)
  if (error) throw error
}

/* ── สถิติ ───────────────────────────────────────────────────────────── */

export const getInfluencerStats = async () => {
  const { data, error } = await sb()
    .from('influencers')
    .select('tier, social_channels(platform)')
    .eq('is_active', true)
  if (error) throw error

  const stats = {
    total: (data ?? []).length,
    byTier: { nano: 0, micro: 0, mid: 0, macro: 0, mega: 0 } as Record<string, number>,
    byPlatform: {} as Record<string, number>,
  }
  for (const r of data ?? []) {
    if (r.tier && r.tier in stats.byTier) stats.byTier[r.tier]++
    for (const c of (r.social_channels as { platform: string }[]) ?? []) {
      stats.byPlatform[c.platform] = (stats.byPlatform[c.platform] ?? 0) + 1
    }
  }
  return stats
}

/** อัปเดตยอดผู้ติดตามหลายช่องพร้อมกัน (ใช้ตอนดึงยอดจากแพลตฟอร์ม) */
export const batchUpdateFollowerCounts = async (
  updates: { influencerId: string; channelId: string; followerCount: number }[]
): Promise<void> => {
  for (const u of updates) {
    await sb()
      .from('social_channels')
      .update({ follower_count: u.followerCount })
      .eq('id', u.channelId)
  }

  // ยอดรวมของแต่ละคนต้องคิดใหม่หลังแก้ช่อง
  for (const influencerId of [...new Set(updates.map((u) => u.influencerId))]) {
    const { data } = await sb()
      .from('social_channels')
      .select('follower_count')
      .eq('influencer_id', influencerId)
    const total = (data ?? []).reduce((s, c) => s + (c.follower_count ?? 0), 0)
    await sb()
      .from('influencers')
      .update({ total_followers: total, tier: calculateInfluencerTier(total) })
      .eq('id', influencerId)
  }
}

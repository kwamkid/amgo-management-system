// lib/services/campaignService.ts
//
// แคมเปญ — ย้ายจาก Firestore มา Supabase (15 ส.ค. 69)
//
// ของเดิมเก็บ influencers/brands/products เป็น array ในเอกสารแคมเปญ
// ของใหม่แยกเป็นตารางเชื่อม campaign_influencers / campaign_brands /
// campaign_products แล้วประกอบกลับเป็นรูปแบบเดิมให้หน้าจอ (ไม่ต้องแก้หน้า)

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import {
  Campaign,
  CampaignStatus,
  CampaignInfluencer,
  CreateCampaignData,
} from '@/types/influencer'

const sb = () => createClient()

const SELECT = `*,
  campaign_influencers(influencer_id, assigned_at, submission_status, submission_link,
    influencers(full_name, nickname)),
  campaign_brands(brand_id),
  campaign_products(product_id)`

type CiRow = {
  influencer_id: string
  assigned_at: string
  submission_status: string
  submission_link: string | null
  influencers?: { full_name?: string; nickname?: string } | null
}

const toCampaign = (r: Record<string, unknown>): Campaign =>
  ({
    id: r.id as string,
    name: (r.name as string) ?? '',
    description: (r.description as string) ?? '',
    briefFileUrl: (r.brief_file_url as string) ?? '',
    trackingUrl: (r.tracking_url as string) ?? '',
    budget: (r.budget as number) ?? null,
    currency: (r.currency as string) ?? 'THB',
    startDate: r.start_date ? new Date(r.start_date as string) : undefined,
    deadline: r.deadline ? new Date(r.deadline as string) : undefined,
    status: r.status as CampaignStatus,
    createdBy: (r.created_by as string) ?? '',
    createdByName: (r.created_by_name as string) ?? '',
    createdAt: r.created_at ? new Date(r.created_at as string) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at as string) : undefined,
    brands: ((r.campaign_brands as { brand_id: string }[]) ?? []).map((b) => b.brand_id),
    products: ((r.campaign_products as { product_id: string }[]) ?? []).map((p) => p.product_id),
    influencers: ((r.campaign_influencers as CiRow[]) ?? []).map((i) => ({
      influencerId: i.influencer_id,
      influencerName: i.influencers?.full_name ?? '',
      influencerNickname: i.influencers?.nickname ?? '',
      assignedAt: new Date(i.assigned_at),
      submissionStatus: i.submission_status,
      submissionLink: i.submission_link ?? '',
    })),
  }) as unknown as Campaign

/* ── อ่าน ────────────────────────────────────────────────────────────── */

export const getCampaigns = async (
  status?: CampaignStatus,
  createdBy?: string
): Promise<Campaign[]> => {
  let q = sb().from('campaigns').select(SELECT).order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  if (createdBy) q = q.eq('created_by', createdBy)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => toCampaign(r as Record<string, unknown>))
}

export const getCampaign = async (campaignId: string): Promise<Campaign | null> => {
  const { data, error } = await sb().from('campaigns').select(SELECT).eq('id', campaignId).maybeSingle()
  if (error) throw error
  return data ? toCampaign(data as Record<string, unknown>) : null
}

export const getCampaignsByInfluencer = async (influencerId: string): Promise<Campaign[]> => {
  const { data: ids, error } = await sb()
    .from('campaign_influencers')
    .select('campaign_id')
    .eq('influencer_id', influencerId)
  if (error) throw error
  const list = (ids ?? []).map((r) => r.campaign_id)
  if (!list.length) return []

  const { data, error: e2 } = await sb()
    .from('campaigns')
    .select(SELECT)
    .in('id', list)
    .order('created_at', { ascending: false })
  if (e2) throw e2
  return (data ?? []).map((r) => toCampaign(r as Record<string, unknown>))
}

/* ── เขียน ───────────────────────────────────────────────────────────── */

/** ลิงก์ส่งงานของอินฟลูแต่ละคน — รูปแบบเดิมจากระบบ Firestore */
function generateSubmissionLink(influencerId: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}-${influencerId.substring(0, 8)}`
}

const dateOnly = (d: unknown) =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? '').slice(0, 10)

export const createCampaign = async (
  data: CreateCampaignData,
  createdBy: string,
  createdByName: string
): Promise<string> => {
  const { data: row, error } = await sb()
    .from('campaigns')
    .insert({
      name: data.name,
      description: data.description ?? '',
      brief_file_url: data.briefFileUrl || undefined,
      tracking_url: data.trackingUrl || undefined,
      budget: data.budget ?? undefined,
      currency: 'THB',
      start_date: dateOnly(data.startDate),
      deadline: dateOnly(data.deadline),
      status: 'active',
      created_by: createdBy || undefined,
      created_by_name: createdByName || undefined,
    })
    .select('id')
    .single()
  if (error) throw error
  const id = row.id as string

  if (data.brandIds?.length)
    await sb().from('campaign_brands').insert(data.brandIds.map((b) => ({ campaign_id: id, brand_id: b })))
  if (data.productIds?.length)
    await sb()
      .from('campaign_products')
      .insert(data.productIds.map((p) => ({ campaign_id: id, product_id: p })))
  if (data.influencerIds?.length)
    await sb()
      .from('campaign_influencers')
      .insert(
        data.influencerIds.map((influencerId) => ({
          campaign_id: id,
          influencer_id: influencerId,
          submission_status: 'pending',
          submission_link: generateSubmissionLink(influencerId),
        }))
      )

  return id
}

export const updateCampaign = async (campaignId: string, data: Partial<Campaign>): Promise<void> => {
  const patch: Database['public']['Tables']['campaigns']['Update'] = {
    updated_at: new Date().toISOString(),
  }
  if (data.name !== undefined) patch.name = data.name
  if (data.description !== undefined) patch.description = data.description
  if (data.briefFileUrl !== undefined) patch.brief_file_url = data.briefFileUrl
  if (data.trackingUrl !== undefined) patch.tracking_url = data.trackingUrl
  if (data.budget !== undefined) patch.budget = data.budget ?? undefined
  if (data.startDate !== undefined) patch.start_date = dateOnly(data.startDate)
  if (data.deadline !== undefined) patch.deadline = dateOnly(data.deadline)
  if (data.status !== undefined) patch.status = data.status

  const { error } = await sb().from('campaigns').update(patch).eq('id', campaignId)
  if (error) throw error

  // ชุดความสัมพันธ์ — ส่งมาเมื่อไหร่ถือว่าแทนที่ทั้งชุด (เหมือนเขียนทับ array เดิม)
  if (data.brands) {
    await sb().from('campaign_brands').delete().eq('campaign_id', campaignId)
    if (data.brands.length)
      await sb()
        .from('campaign_brands')
        .insert(data.brands.map((b) => ({ campaign_id: campaignId, brand_id: b })))
  }
  if (data.products) {
    await sb().from('campaign_products').delete().eq('campaign_id', campaignId)
    if (data.products.length)
      await sb()
        .from('campaign_products')
        .insert(data.products.map((p) => ({ campaign_id: campaignId, product_id: p })))
  }
  if (data.influencers) {
    await sb().from('campaign_influencers').delete().eq('campaign_id', campaignId)
    if (data.influencers.length)
      await sb()
        .from('campaign_influencers')
        .insert(
          data.influencers.map((i) => ({
            campaign_id: campaignId,
            influencer_id: i.influencerId,
            assigned_at: (i.assignedAt instanceof Date
              ? i.assignedAt
              : new Date(i.assignedAt ?? Date.now())
            ).toISOString(),
            submission_status: i.submissionStatus ?? 'pending',
            submission_link: i.submissionLink || generateSubmissionLink(i.influencerId),
          }))
        )
  }
}

export const updateCampaignStatus = async (
  campaignId: string,
  status: CampaignStatus
): Promise<void> => {
  const { error } = await sb()
    .from('campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
  if (error) throw error
}

export const cancelCampaign = async (campaignId: string): Promise<void> =>
  updateCampaignStatus(campaignId, 'cancelled' as CampaignStatus)

export const deleteCampaign = async (campaignId: string): Promise<void> => {
  const { error } = await sb().from('campaigns').delete().eq('id', campaignId)
  if (error) throw error
}

export const addInfluencerToCampaign = async (
  campaignId: string,
  influencer: CampaignInfluencer
): Promise<void> => {
  const { error } = await sb()
    .from('campaign_influencers')
    .upsert(
      {
        campaign_id: campaignId,
        influencer_id: influencer.influencerId,
        submission_status: influencer.submissionStatus ?? 'pending',
        submission_link: influencer.submissionLink || generateSubmissionLink(influencer.influencerId),
      },
      { onConflict: 'campaign_id,influencer_id' }
    )
  if (error) throw error
}

export const removeInfluencerFromCampaign = async (
  campaignId: string,
  influencerId: string
): Promise<void> => {
  const { error } = await sb()
    .from('campaign_influencers')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('influencer_id', influencerId)
  if (error) throw error
}

export const updateInfluencerSubmission = async (
  campaignId: string,
  influencerId: string,
  updates: Partial<CampaignInfluencer>
): Promise<void> => {
  const patch: Database['public']['Tables']['campaign_influencers']['Update'] = {}
  if (updates.submissionStatus !== undefined) patch.submission_status = updates.submissionStatus
  if (updates.submissionLink !== undefined) patch.submission_link = updates.submissionLink
  if (!Object.keys(patch).length) return

  const { error } = await sb()
    .from('campaign_influencers')
    .update(patch)
    .eq('campaign_id', campaignId)
    .eq('influencer_id', influencerId)
  if (error) throw error
}

/* ── สถิติ ───────────────────────────────────────────────────────────── */

export const getCampaignStats = async () => {
  const { data, error } = await sb().from('campaigns').select('status, budget')
  if (error) throw error
  const rows = data ?? []
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    totalBudget: rows.reduce((s, r) => s + (Number(r.budget) || 0), 0),
  }
}

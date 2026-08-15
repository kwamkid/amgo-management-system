// lib/services/submissionService.ts
//
// งานที่อินฟลูส่งเข้ามาผ่านลิงก์เฉพาะตัว — ย้ายจาก Firestore มา Supabase (15 ส.ค. 69)
//
// ลิงก์ส่งงาน (code) เก็บอยู่ที่ campaign_influencers.submission_link
// ตัวงานที่ส่ง + ลิงก์ผลงาน อยู่ที่ submissions / submitted_links
// ของเดิมยัดทุกอย่างไว้ใน array ของเอกสารแคมเปญ ซึ่งค้นด้วย code ไม่ได้ตรง ๆ
// (โค้ดเก่าต้องดึงแคมเปญมาทั้งคอลเล็กชันแล้วไล่หา) — ของใหม่ query ตรงจบ

import { createClient } from '@/lib/supabase/client'
import { DiscordNotificationService } from '@/lib/discord/notificationService'

const sb = () => createClient()

export interface SubmissionLink {
  id?: string
  url: string
  platform?: string
  addedAt?: Date | string
}

/* ── อ่านด้วยลิงก์ส่งงาน ─────────────────────────────────────────────── */

export const getSubmissionByCode = async (code: string) => {
  const { data: ci, error } = await sb()
    .from('campaign_influencers')
    .select(
      'campaign_id, influencer_id, submission_status, campaigns(name, description, deadline), influencers(full_name, nickname)'
    )
    .eq('submission_link', code)
    .maybeSingle()
  if (error) throw error
  if (!ci) return null

  const campaign = ci.campaigns as { name?: string; description?: string; deadline?: string } | null
  const influencer = ci.influencers as { full_name?: string; nickname?: string } | null

  const { data: sub } = await sb()
    .from('submissions')
    .select('*, submitted_links(id, url, platform, added_at)')
    .eq('code', code)
    .maybeSingle()

  return {
    campaign: {
      id: ci.campaign_id,
      name: campaign?.name ?? '',
      description: campaign?.description ?? '',
      deadline: campaign?.deadline ? new Date(campaign.deadline) : undefined,
      influencerId: ci.influencer_id,
      influencerName: influencer?.full_name ?? '',
      influencerNickname: influencer?.nickname ?? '',
    },
    submission: {
      status: sub?.status ?? ci.submission_status ?? 'pending',
      isDraft: sub?.is_draft ?? false,
      links: ((sub?.submitted_links as { id: string; url: string; platform: string | null; added_at: string }[]) ?? []).map(
        (l) => ({ id: l.id, url: l.url, platform: l.platform ?? '', addedAt: new Date(l.added_at) })
      ),
      reviewNotes: sub?.review_notes ?? undefined,
      reviewedAt: sub?.reviewed_at ? new Date(sub.reviewed_at) : undefined,
      reviewedBy: sub?.reviewed_by ?? undefined,
    },
  }
}

/* ── บันทึก/ส่งงาน ───────────────────────────────────────────────────── */

export const saveSubmission = async (code: string, links: SubmissionLink[], isDraft: boolean) => {
  const data = await getSubmissionByCode(code)
  if (!data) throw new Error('ลิงก์ส่งงานไม่ถูกต้อง')

  const wasRevision = data.submission.status === 'revision'
  const status = isDraft ? 'pending' : wasRevision ? 'resubmitted' : 'submitted'
  const now = new Date().toISOString()

  const { data: row, error } = await sb()
    .from('submissions')
    .upsert(
      {
        code,
        campaign_id: data.campaign.id,
        campaign_name: data.campaign.name,
        influencer_id: data.campaign.influencerId,
        influencer_name: data.campaign.influencerName,
        is_draft: isDraft,
        status,
        last_saved_at: now,
        submitted_at: isDraft ? null : now,
        updated_at: now,
      },
      { onConflict: 'code' }
    )
    .select('id')
    .single()
  if (error) throw error

  // ลิงก์ผลงาน — แทนที่ทั้งชุดทุกครั้งที่บันทึก (เหมือนเขียนทับ array เดิม)
  await sb().from('submitted_links').delete().eq('submission_id', row.id)
  if (links.length) {
    await sb().from('submitted_links').insert(
      links.map((l) => ({
        submission_id: row.id,
        url: l.url,
        platform: l.platform ?? '',
        added_at: now,
      }))
    )
  }

  await sb()
    .from('campaign_influencers')
    .update({ submission_status: status })
    .eq('campaign_id', data.campaign.id)
    .eq('influencer_id', data.campaign.influencerId)

  if (!isDraft) {
    await checkAndUpdateCampaignStatus(data.campaign.id)
    const payload = {
      campaignName: data.campaign.name,
      influencerName: data.campaign.influencerName,
      influencerNickname: data.campaign.influencerNickname,
      submissionCount: links.length,
      timestamp: new Date(),
    }
    if (wasRevision) await DiscordNotificationService.notifyResubmission(payload)
    else await DiscordNotificationService.notifySubmission({ campaignId: data.campaign.id, ...payload })
  }

  return true
}

export const submitFinal = async (code: string, links: SubmissionLink[]) =>
  saveSubmission(code, links, false)

/* ── ตรวจงาน ─────────────────────────────────────────────────────────── */

export const reviewSubmission = async (
  campaignId: string,
  influencerId: string,
  action: 'approve' | 'reject',
  reviewerName: string,
  notes?: string
) => {
  const newStatus = action === 'approve' ? 'approved' : 'revision'
  const now = new Date().toISOString()

  await sb()
    .from('campaign_influencers')
    .update({ submission_status: newStatus })
    .eq('campaign_id', campaignId)
    .eq('influencer_id', influencerId)

  await sb()
    .from('submissions')
    .update({
      status: newStatus,
      review_notes: notes ?? null,
      reviewed_at: now,
      reviewed_by: reviewerName,
      updated_at: now,
    })
    .eq('campaign_id', campaignId)
    .eq('influencer_id', influencerId)

  const { data: camp } = await sb().from('campaigns').select('name').eq('id', campaignId).maybeSingle()
  const { data: inf } = await sb()
    .from('influencers')
    .select('full_name, nickname')
    .eq('id', influencerId)
    .maybeSingle()

  const base = {
    campaignName: camp?.name ?? '',
    influencerName: inf?.full_name ?? '',
    influencerNickname: inf?.nickname ?? undefined,
    timestamp: new Date(),
  }
  if (action === 'approve') {
    await DiscordNotificationService.notifySubmissionApproved({ ...base, approvedBy: reviewerName })
  } else {
    await DiscordNotificationService.notifySubmissionRejected({
      ...base,
      rejectedBy: reviewerName,
      reason: notes || 'ไม่ระบุ',
    })
  }

  await checkAndUpdateCampaignStatus(campaignId)
  return true
}

/** ทุกคนส่งครบ+ผ่านหมด = ปิดแคมเปญให้อัตโนมัติ (กติกาเดิม) */
const checkAndUpdateCampaignStatus = async (campaignId: string) => {
  const { data: rows } = await sb()
    .from('campaign_influencers')
    .select('submission_status')
    .eq('campaign_id', campaignId)
  if (!rows?.length) return

  const all = rows.map((r) => r.submission_status)
  const done = all.every((s) => s === 'approved')
  if (done) {
    await sb()
      .from('campaigns')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', campaignId)
  }
}

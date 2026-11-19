'use client'

// เสียงประชุม → งาน (แอดมินเท่านั้น · plan: project/jobs/plans/voice-tasks.md)
// เข้าได้ 2 ทาง: วางลิงก์แชร์ของ Plaud · อัปโหลดไฟล์เสียง (.m4a จาก Voice Memos, .mp3, .wav, .ogg, .webm)
// ไฟล์อัปโหลดวิ่งจากเบราว์เซอร์ตรงเข้า Storage (signed upload URL) ไม่ผ่าน route เรา — Vercel รับ body ได้ 4.5 MB
// ถอดเสียง + ร่างงานวิ่งในคิวกลาง (lib/voice/pipeline.ts) · หน้า /tasks/voice/[id] แค่โชว์ความคืบหน้า

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { AudioLines, Link2, Upload } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, EmptyState, FilePickButton, Input, Progress, Spinner } from '@/components/aoo'
import { ListRow, ListRows, PageHeader, SectionCard, StatusBadge } from '@/components/shared'
import { createClient } from '@/lib/supabase/client'
import { SOURCE_LABEL, durationText, voiceFetch } from '@/lib/voice/format'

interface RecordingItem {
  id: string
  title: string
  recorded_at: string | null
  duration_sec: number | null
  source: string
  status: string
  error: string | null
  created_at: string
  audio_deleted_at: string | null
  drafts: { pending: number; accepted: number; total: number }
}

const ACCEPT = 'audio/*,.m4a,.mp3,.wav,.ogg,.opus,.webm'
const MAX_MB = 50


type Credits = { left: number; limit: number; used: number; resetAt: string | null }

export default function VoiceRecordingsPage() {
  const router = useRouter()
  const { userData, realRole } = useAuth()
  const { showToast } = useToast()
  const isAdmin = (realRole ?? userData?.role) === 'admin'

  const [items, setItems] = useState<RecordingItem[] | null>(null)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState<'plaud' | 'upload' | null>(null)
  const [progress, setProgress] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/voice/recordings', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json.error || 'โหลดรายการไม่สำเร็จ', 'error')
      setItems([])
      return
    }
    setItems(json.recordings)
  }, [showToast])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  // ElevenLabs credits left — once per page load (the API is rate-limited; server caches 5 min)
  const [credits, setCredits] = useState<Credits | null>(null)
  const loadCredits = useCallback(async () => {
    const res = await fetch('/api/voice/credits', { cache: 'no-store' }).catch(() => null)
    const json = res?.ok ? await res.json().catch(() => null) : null
    setCredits(json?.available ? json : null)
  }, [])
  useEffect(() => {
    if (isAdmin) void loadCredits()
  }, [isAdmin, loadCredits])

  const importPlaud = async () => {
    if (!link.trim()) return
    setBusy('plaud')
    setProgress('กำลังดึงเสียงจาก Plaud…')
    try {
      const r = await voiceFetch<{ id: string; existed: boolean }>('/api/voice/plaud', 'POST', { link: link.trim() })
      if (r.existed) showToast('ไฟล์นี้มีอยู่แล้ว — เปิดอันเดิมให้')
      router.push(`/tasks/voice/${r.id}`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ดึงเสียงไม่สำเร็จ', 'error')
      setBusy(null)
      setProgress('')
    }
  }

  const upload = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      showToast(`ไฟล์ใหญ่เกิน ${MAX_MB} MB`, 'error')
      return
    }
    setBusy('upload')
    setProgress(`กำลังอัปโหลด ${file.name}…`)
    try {
      const r = await voiceFetch<{ id: string; path: string; token: string; contentType: string }>('/api/voice/upload-url', 'POST', {
        filename: file.name,
        contentType: file.type,
        size: file.size,
        lastModified: file.lastModified,
      })
      // supabase-js sends a File as multipart using the File's own type, ignoring the contentType option —
      // a browser that reports "application/octet-stream" (or "") gets 415 from the bucket. Re-wrap with the
      // type the server picked from the extension.
      const body = file.type === r.contentType ? file : new File([file], file.name, { type: r.contentType })
      const { error } = await createClient()
        .storage.from('voice-audio')
        .uploadToSignedUrl(r.path, r.token, body, { contentType: r.contentType })
      if (error) {
        // ลบแถวที่ค้างไว้ ไม่ให้ cron ไปถอดเสียงไฟล์ที่ไม่มีอยู่
        await fetch(`/api/voice/recordings/${r.id}`, { method: 'DELETE' }).catch(() => {})
        throw new Error(`อัปโหลดไม่สำเร็จ: ${error.message}`)
      }
      // ไฟล์อยู่ใน Storage แล้ว → ลงคิวถอดเสียง (ทำฝั่งเซิร์ฟเวอร์ ปิดหน้าได้)
      await voiceFetch(`/api/voice/recordings/${r.id}/start`, 'POST')
      router.push(`/tasks/voice/${r.id}`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'อัปโหลดไม่สำเร็จ', 'error')
      setBusy(null)
      setProgress('')
    }
  }

  if (userData && !isAdmin) return <EmptyState title="เฉพาะแอดมิน" body="หน้านี้สำหรับผู้ดูแลระบบเท่านั้น" />

  return (
    <div className="space-y-4">
      <PageHeader
        title="เสียงประชุม → งาน"
        description="วางลิงก์ Plaud หรืออัปโหลดไฟล์เสียง ระบบถอดเสียงแล้วร่างงานให้ตรวจก่อนลงบอร์ด"
        icon={AudioLines}
        backHref="/tasks"
      />

      <SectionCard title="เพิ่มไฟล์เสียง">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="วางลิงก์แชร์ของ Plaud เช่น https://web.plaud.ai/s/pub_…"
              disabled={!!busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void importPlaud()
              }}
            />
          </div>
          <Button icon={Link2} onClick={importPlaud} loading={busy === 'plaud'} disabled={!link.trim() || !!busy}>
            ดึงจาก Plaud
          </Button>
          <FilePickButton accept={ACCEPT} icon={Upload} onPick={upload} loading={busy === 'upload'} disabled={!!busy}>
            อัปโหลดไฟล์เสียง
          </FilePickButton>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {progress || `รองรับ .m4a (Voice Memos) .mp3 .wav .ogg .webm ไม่เกิน ${MAX_MB} MB · เสียงเก็บ 90 วัน ข้อความถอดเสียงเก็บตลอด`}
        </p>
        {credits && (
          <div className="aoo-voice-credits">
            <div className="aoo-voice-credits__row">
              <span>เครดิตถอดเสียง (ElevenLabs) เหลือ</span>
              <strong>
                {credits.left.toLocaleString('th-TH')} / {credits.limit.toLocaleString('th-TH')}
              </strong>
            </div>
            <Progress
              value={credits.left}
              max={credits.limit}
              tone={credits.left / credits.limit > 0.3 ? 'success' : credits.left / credits.limit > 0.1 ? 'warning' : 'danger'}
              height={6}
              aria-label="เครดิตที่เหลือ"
            />
            {credits.resetAt && (
              <p className="aoo-voice-credits__hint">เติมใหม่ {format(new Date(credits.resetAt), 'd/M/yyyy')}</p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="ไฟล์เสียงทั้งหมด">
        {items === null ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState size="sm" title="ยังไม่มีไฟล์เสียง" body="วางลิงก์ Plaud หรืออัปโหลดไฟล์ด้านบน" />
        ) : (
          <ListRows>
            {items.map((r) => (
              <ListRow
                key={r.id}
                href={`/tasks/voice/${r.id}`}
                title={r.title || 'ไม่มีชื่อ'}
                meta={[
                  format(new Date(r.recorded_at ?? r.created_at), 'd/M/yyyy HH:mm'),
                  durationText(r.duration_sec),
                  SOURCE_LABEL[r.source] ?? r.source,
                  r.drafts.total ? `ร่างงาน ${r.drafts.total} · รับแล้ว ${r.drafts.accepted} · รอตรวจ ${r.drafts.pending}` : '',
                  r.status === 'failed' && r.error ? r.error : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={<StatusBadge status={r.status} kind="voice" />}
              />
            ))}
          </ListRows>
        )}
      </SectionCard>
    </div>
  )
}

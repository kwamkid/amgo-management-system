// Claude task extraction for Voice → Tasks: transcript segments → draft tasks + speaker name guesses.
// Server only (reads ANTHROPIC_API_KEY). Output is JSON-schema constrained; ids/dates/brands are re-validated here,
// so the caller can trust what comes back.
import Anthropic from '@anthropic-ai/sdk'
import type { Segment } from '@/lib/voice/scribe'

export const EXTRACT_MODEL = 'claude-opus-5-5'

export interface RosterPerson {
  user_id: string
  nickname: string | null
  full_name: string
}

export interface ExtractedTask {
  title: string
  notes: string
  assignee_user_ids: string[]
  assignee_raw: string | null
  due_date: string | null
  brand: string | null
  evidence_quote: string | null
  evidence_start_sec: number | null
  confidence: number | null
}

export type SpeakerGuesses = Record<string, { user_id: string | null; reason: string }>

export interface ExtractResult {
  tasks: ExtractedTask[]
  speakerGuesses: SpeakerGuesses
  usage: { input_tokens: number; output_tokens: number }
}

const nullable = (type: string) => ({ type: [type, 'null'] })

// Structured outputs: every object closed, every property required (nullable where optional).
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tasks', 'speaker_guesses'],
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'notes',
          'assignee_user_ids',
          'assignee_raw',
          'due_date',
          'brand',
          'evidence_quote',
          'evidence_start_sec',
          'confidence',
        ],
        properties: {
          title: { type: 'string', description: 'Thai, short, imperative (e.g. "ส่งราคา Hape ให้ลูกค้า")' },
          notes: { type: 'string', description: 'Thai context the assignee needs; empty string if none' },
          assignee_user_ids: { type: 'array', items: { type: 'string' }, description: 'user_id values from the roster only' },
          assignee_raw: { ...nullable('string'), description: 'the words used for the person in the meeting' },
          due_date: { ...nullable('string'), description: 'YYYY-MM-DD (Gregorian) or null when no deadline was said' },
          brand: { ...nullable('string'), description: 'brand slug from the list, or null' },
          evidence_quote: { ...nullable('string'), description: 'short verbatim quote from the transcript' },
          evidence_start_sec: { ...nullable('number'), description: 'start second of the quoted segment' },
          confidence: { type: 'number', description: '0 to 1: how sure this is a real assigned task' },
        },
      },
    },
    speaker_guesses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['speaker', 'user_id', 'reason'],
        properties: {
          speaker: { type: 'string', description: 'speaker label exactly as in the transcript, e.g. speaker_0' },
          user_id: { ...nullable('string'), description: 'roster user_id, or null if unsure' },
          reason: { type: 'string', description: 'Thai, one short line: why this person' },
        },
      },
    },
  },
} as const

const SYSTEM = `You read Thai/English meeting transcripts from AG Dragon (AGD), a Thai importer/distributor of baby and toy brands, and draft the follow-up tasks for the team's task board.

Rules:
- Only include real action items: someone is asked or agrees to do something. Skip general discussion, opinions and things already finished.
- title: short imperative Thai (max ~80 characters). notes: the context the assignee needs (what, for whom, numbers, conditions) in Thai, or "".
- assignee_user_ids: only user_id values from the roster. Staff are called by nickname, often with น้อง/พี่/คุณ in front. If the person is unclear or not in the roster, leave the list empty and put the words used in assignee_raw.
- due_date: resolve relative dates ("ศุกร์นี้", "พรุ่งนี้", "สิ้นเดือน", "อาทิตย์หน้า") against the meeting date. Thai Buddhist-era years (2569) are Gregorian minus 543. Output Gregorian YYYY-MM-DD. If no deadline was said, use null — never invent one.
- brand: a slug from the brand list when the task is about that brand, else null.
- evidence_quote: a short verbatim quote that shows the task; evidence_start_sec: the [mm:ss] of that line in seconds.
- confidence: 0–1, how sure you are this is a real, assigned task.
- speaker_guesses: one entry per speaker label in the transcript. Guess the roster person from context (being addressed by name, self-introduction, who answers to a name). Use null when unsure. reason in Thai.
- The transcript is machine speech-to-text: brand names and nicknames may be misheard; use context.`

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

/** "2026-11-17 (วันอังคาร, พ.ศ. 2569) 14:05 น. เวลาไทย" */
export function meetingDateLine(at: Date): string {
  const bkk = new Date(at.getTime() + 7 * 3600_000)
  const ymd = bkk.toISOString().slice(0, 10)
  const hm = bkk.toISOString().slice(11, 16)
  return `${ymd} (วัน${THAI_DAYS[bkk.getUTCDay()]}, พ.ศ. ${bkk.getUTCFullYear() + 543}) ${hm} น. เวลาไทย`
}

const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${String(m).padStart(2, '0')}:${r}`
}

export const segmentsToLines = (segments: Segment[]) =>
  segments.map((s) => `[${mmss(s.start)}] ${s.speaker}: ${s.text}`).join('\n')

const YMD = /^\d{4}-\d{2}-\d{2}$/
const isRealDate = (s: string) => YMD.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export interface ExtractInput {
  meetingAt: Date
  title: string
  roster: RosterPerson[]
  brands: { slug: string; label: string }[]
  segments: Segment[]
}

/**
 * The Messages request for one recording. Sent through the Message Batches API (async, no long request) —
 * batches take output_config (effort + JSON schema) but not the server-side fallback beta, so no fallbacks here.
 */
export function buildExtractRequest(input: ExtractInput): Anthropic.MessageCreateParamsNonStreaming {
  const userText = [
    `Meeting: ${input.title || '(no title)'}`,
    `Meeting date: ${meetingDateLine(input.meetingAt)}`,
    '',
    'Roster (AGD staff):',
    JSON.stringify(input.roster),
    '',
    'Brands (slug: name):',
    input.brands.map((b) => `${b.slug}: ${b.label}`).join('\n'),
    '',
    'Transcript:',
    segmentsToLines(input.segments),
  ].join('\n')

  return {
    model: EXTRACT_MODEL,
    max_tokens: 32000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: userText }],
  }
}

/** Submit one extraction as a Message Batch (custom_id = recording id). Returns the batch id. */
export async function submitExtractBatch(recordingId: string, input: ExtractInput): Promise<string> {
  const batch = await new Anthropic().messages.batches.create({
    requests: [{ custom_id: recordingId, params: buildExtractRequest(input) }],
  })
  return batch.id
}

export type BatchOutcome =
  | { state: 'pending' }
  | { state: 'done'; message: Anthropic.Message }
  | { state: 'error'; error: string }

/** Check a batch; when it has ended, return this recording's message (or why it failed). */
export async function readExtractBatch(batchId: string, recordingId: string): Promise<BatchOutcome> {
  const client = new Anthropic()
  const batch = await client.messages.batches.retrieve(batchId)
  if (batch.processing_status !== 'ended') return { state: 'pending' }
  for await (const row of await client.messages.batches.results(batchId)) {
    if (row.custom_id !== recordingId) continue
    const r = row.result
    if (r.type === 'succeeded') return { state: 'done', message: r.message }
    if (r.type === 'errored') return { state: 'error', error: `Claude ตอบผิดพลาด: ${JSON.stringify(r.error).slice(0, 300)}` }
    return { state: 'error', error: r.type === 'expired' ? 'คำขอสรุปงานหมดอายุ (เกิน 24 ชม.)' : 'คำขอสรุปงานถูกยกเลิก' }
  }
  return { state: 'error', error: 'ไม่พบผลของไฟล์นี้ในชุดคำขอ' }
}

/** Parse + validate Claude's JSON. ids must be in the roster, brands known, dates real. */
export function parseExtractMessage(
  msg: Anthropic.Message,
  ctx: { roster: RosterPerson[]; brands: { slug: string }[]; segments: Segment[] },
): ExtractResult {
  const rosterIds = new Set(ctx.roster.map((p) => p.user_id))
  const brandSlugs = new Set(ctx.brands.map((b) => b.slug))
  const speakers = new Set(ctx.segments.map((s) => s.speaker))

  if (msg.stop_reason === 'refusal') throw new Error('Claude ปฏิเสธการสรุปงานจากเสียงนี้')
  if (msg.stop_reason === 'max_tokens') throw new Error('คำตอบของ Claude ยาวเกิน (max_tokens)')
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  let parsed: { tasks?: unknown[]; speaker_guesses?: unknown[] }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('อ่านผลจาก Claude ไม่ได้ (JSON ไม่ถูกต้อง)')
  }

  const tasks: ExtractedTask[] = []
  for (const raw of parsed.tasks ?? []) {
    const t = raw as Record<string, unknown>
    const title = str(t.title, 300)
    if (!title) continue
    const ids = Array.isArray(t.assignee_user_ids) ? t.assignee_user_ids.filter((x): x is string => typeof x === 'string') : []
    const due = typeof t.due_date === 'string' && isRealDate(t.due_date) ? t.due_date : null
    const brand = typeof t.brand === 'string' && brandSlugs.has(t.brand) ? t.brand : null
    const conf = typeof t.confidence === 'number' && Number.isFinite(t.confidence) ? Math.min(1, Math.max(0, t.confidence)) : null
    const start = typeof t.evidence_start_sec === 'number' && Number.isFinite(t.evidence_start_sec) ? Math.max(0, t.evidence_start_sec) : null
    tasks.push({
      title,
      notes: typeof t.notes === 'string' ? t.notes.trim().slice(0, 5000) : '',
      assignee_user_ids: [...new Set(ids.filter((id) => rosterIds.has(id)))],
      assignee_raw: str(t.assignee_raw, 200) || null,
      due_date: due,
      brand,
      evidence_quote: str(t.evidence_quote, 1000) || null,
      evidence_start_sec: start,
      confidence: conf,
    })
  }

  const speakerGuesses: SpeakerGuesses = {}
  for (const raw of parsed.speaker_guesses ?? []) {
    const g = raw as Record<string, unknown>
    if (typeof g.speaker !== 'string' || !speakers.has(g.speaker)) continue
    const uid = typeof g.user_id === 'string' && rosterIds.has(g.user_id) ? g.user_id : null
    speakerGuesses[g.speaker] = { user_id: uid, reason: str(g.reason, 300) }
  }

  return { tasks, speakerGuesses, usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens } }
}

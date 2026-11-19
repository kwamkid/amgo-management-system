'use client'
// One speaker on the meeting page: colour badge + 2 short audio samples (owner 19 Nov 69:
// "ขึ้น ผู้พูด 1 อย่างนี้ผมไม่รู้จริงๆ — ให้ฟังสักท่อนสองท่อน") + the person picker.
import type { ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'
import { clock } from '@/lib/voice/format'

export type SpeakerSegment = { speaker: string; start: number; end: number; text: string }

/** Tupperware five — one colour per speaker, same colour on the transcript dots. */
const TONES = ['accent', 'success', 'grape', 'danger', 'neutral'] as const
export const speakerTone = (speaker: string) => {
  const n = Number(speaker.replace(/^speaker_/, ''))
  return TONES[(Number.isFinite(n) ? n : 0) % TONES.length]
}
export const speakerNo = (speaker: string) => {
  const n = Number(speaker.replace(/^speaker_/, ''))
  return Number.isFinite(n) ? n + 1 : '?'
}

/** Longest turns first, the second one at least 1 min away so the two samples sound different. */
export function pickSamples(segments: SpeakerSegment[], speaker: string, count = 2): SpeakerSegment[] {
  const mine = segments
    .filter((s) => s.speaker === speaker && s.end - s.start >= 2)
    .sort((a, b) => b.text.length - a.text.length)
  const out: SpeakerSegment[] = []
  for (const s of mine) {
    if (out.length >= count) break
    if (out.every((o) => Math.abs(o.start - s.start) >= 60)) out.push(s)
  }
  for (const s of mine) if (out.length < count && !out.includes(s)) out.push(s)
  return out.sort((a, b) => a.start - b.start)
}

export default function SpeakerRow({
  speaker,
  label,
  turns,
  samples,
  canPlay,
  playingAt,
  onPlay,
  avatar,
  help,
  children,
}: {
  speaker: string
  label: string
  turns: number
  samples: SpeakerSegment[]
  canPlay: boolean
  /** start second of the sample playing now (null = none of this speaker's) */
  playingAt: number | null
  onPlay: (s: SpeakerSegment) => void
  avatar?: ReactNode
  help?: string
  children: ReactNode
}) {
  return (
    <div className="aoo-speaker" data-tone={speakerTone(speaker)}>
      <div className="aoo-speaker__head">
        <span className="aoo-speaker__badge" aria-hidden>
          {speakerNo(speaker)}
        </span>
        <span className="aoo-speaker__label">{label}</span>
        <span className="aoo-speaker__count">พูด {turns} ช่วง</span>
        {avatar}
      </div>
      {samples.length > 0 && (
        <div className="aoo-speaker__clips">
          {samples.map((s) => {
            const playing = playingAt === s.start
            return (
              <button
                key={s.start}
                type="button"
                className="aoo-speaker__clip"
                aria-pressed={playing}
                disabled={!canPlay}
                onClick={() => onPlay(s)}
                title={canPlay ? 'ฟังท่อนนี้' : 'ไฟล์เสียงถูกลบแล้ว — อ่านข้อความแทน'}
              >
                {canPlay && (
                  <span className="aoo-speaker__play" aria-hidden>
                    {playing ? <Pause size={14} strokeWidth={2.5} /> : <Play size={14} strokeWidth={2.5} />}
                  </span>
                )}
                <span className="aoo-speaker__time">{clock(s.start)}</span>
                <span className="aoo-speaker__quote">“{s.text}”</span>
              </button>
            )
          })}
        </div>
      )}
      {children}
      {help && <p className="aoo-speaker__help">{help}</p>}
    </div>
  )
}

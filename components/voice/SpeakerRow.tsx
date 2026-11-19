'use client'
// One speaker on the meeting page: colour badge + 2 short audio samples (owner 19 Nov 69:
// "ขึ้น ผู้พูด 1 อย่างนี้ผมไม่รู้จริงๆ — ให้ฟังสักท่อนสองท่อน") + the person picker.
import type { ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'
import { clock } from '@/lib/voice/format'

export type SpeakerSegment = { speaker: string; start: number; end: number; text: string }

/** 20 animal avatars (public/voice-speakers, Higgsfield 19 Nov 69) — speaker n gets animal n.
 *  Circle colour picked per animal so the face never blends into it; the play buttons use the same tone. */
const ANIMALS = [
  ['cat', 'แมว', 'success'], ['dog', 'หมา', 'grape'], ['bear', 'หมี', 'danger'], ['rabbit', 'กระต่าย', 'accent'],
  ['fox', 'จิ้งจอก', 'success'], ['panda', 'แพนด้า', 'danger'], ['koala', 'โคอาล่า', 'accent'], ['lion', 'สิงโต', 'success'],
  ['tiger', 'เสือ', 'grape'], ['owl', 'นกฮูก', 'danger'], ['penguin', 'เพนกวิน', 'accent'], ['frog', 'กบ', 'grape'],
  ['monkey', 'ลิง', 'danger'], ['elephant', 'ช้าง', 'success'], ['pig', 'หมู', 'neutral'], ['raccoon', 'แรคคูน', 'accent'],
  ['hamster', 'แฮมสเตอร์', 'success'], ['sheep', 'แกะ', 'danger'], ['cow', 'วัว', 'grape'], ['duck', 'เป็ด', 'neutral'],
] as const
const indexOf = (speaker: string) => {
  const n = Number(speaker.replace(/^speaker_/, ''))
  return Number.isFinite(n) && n >= 0 ? n : 0
}
export const speakerTone = (speaker: string) => ANIMALS[indexOf(speaker) % ANIMALS.length][2]
export const speakerNo = (speaker: string) => indexOf(speaker) + 1
export const speakerAnimal = (speaker: string) => ANIMALS[indexOf(speaker) % ANIMALS.length][1]
export const speakerAvatarSrc = (speaker: string) => {
  const i = indexOf(speaker) % ANIMALS.length
  return `/voice-speakers/${String(i + 1).padStart(2, '0')}-${ANIMALS[i][0]}.webp`
}

/** Small round animal for transcript lines and pickers. */
export function SpeakerAvatar({ speaker, size = 22, className = '' }: { speaker: string; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 9 KB static webp, next/image adds nothing
    <img
      src={speakerAvatarSrc(speaker)}
      alt=""
      width={size}
      height={size}
      className={`aoo-speaker-avatar ${className}`}
      loading="lazy"
      decoding="async"
    />
  )
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
  picker,
  help,
}: {
  speaker: string
  label: string
  turns: number
  samples: SpeakerSegment[]
  canPlay: boolean
  /** start second of the sample playing now (null = none of this speaker's) */
  playingAt: number | null
  onPlay: (s: SpeakerSegment) => void
  /** person picker shown top-right (SelectMenu with an avatar trigger) */
  picker: ReactNode
  help?: string
}) {
  return (
    <div className="aoo-speaker" data-tone={speakerTone(speaker)}>
      <div className="aoo-speaker__head">
        <SpeakerAvatar speaker={speaker} size={40} />
        <span className="aoo-speaker__label">
          {label} <span className="aoo-speaker__animal">({speakerAnimal(speaker)})</span>
        </span>
        <span className="aoo-speaker__count">พูด {turns} ช่วง</span>
        {picker}
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
      {help && <p className="aoo-speaker__help">AI เดา: {help}</p>}
    </div>
  )
}

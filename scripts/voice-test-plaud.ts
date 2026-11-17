// One-off check: Plaud share link → ElevenLabs Scribe v3 (Thai, diarized) → readable transcript.
// Usage: node --env-file=.env.local scripts/voice-test-plaud.ts "<plaud share link>" <out-dir>
// Output holds private meeting content — write it outside the repo.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolvePlaudShare } from '../lib/voice/plaud.ts'
import { transcribeUrl } from '../lib/voice/scribe.ts'

const [link, outDir] = process.argv.slice(2)
if (!link || !outDir) {
  console.error('usage: voice-test-plaud.ts <plaud link> <out-dir>')
  process.exit(1)
}

// AGD brand names and common words the model may mishear.
const KEYTERMS = ['AGD', 'Hape', 'GB', 'Stokke', 'Taf Toys', 'Tommee Tippee', 'moodytiger', 'ABC the Baby', 'Shopee', 'Lazada', 'TikTok']

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const share = await resolvePlaudShare(link)
console.log(`Plaud: "${share.title}" · ${fmt(share.durationSec)} · recorded ${share.recordedAt.toISOString()}`)

const t0 = Date.now()
const tr = await transcribeUrl(share.audioUrl, { keyterms: KEYTERMS })
console.log(`Scribe: ${tr.segments.length} turns · language ${tr.languageCode} · ${Math.round((Date.now() - t0) / 1000)} s`)

const speakers = [...new Set(tr.segments.map((s) => s.speaker))]
const talk = speakers.map((sp) => {
  const secs = tr.segments.filter((s) => s.speaker === sp).reduce((a, s) => a + (s.end - s.start), 0)
  return `${sp}: ${fmt(secs)}`
})
console.log(`Speakers: ${talk.join(' · ')}`)

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'transcript.json'), JSON.stringify({ share: { ...share, audioUrl: undefined }, ...tr }, null, 1))
writeFileSync(
  join(outDir, 'transcript.txt'),
  `${share.title}\n\n` + tr.segments.map((s) => `[${fmt(s.start)}] ${s.speaker}: ${s.text}`).join('\n'),
)
console.log(`Saved to ${outDir}`)

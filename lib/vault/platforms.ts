// Groups the vault list. Known platforms get a logo and search words; anything else typed in the
// form is its own group. Text like "Shopee ABC" is still understood for older rows.

import { brandLabel } from '@/lib/constants/brands'
import type { VaultItem } from './types'

export interface VaultPlatform {
  key: string
  label: string
  /** Tile colour for platforms with no logo file */
  color: string
  logo?: string
  short?: string
  /** Thai and other spellings people search with */
  aliases: string
  match?: RegExp
}

const KNOWN: Omit<VaultPlatform, 'logo' | 'color'>[] = [
  { key: 'shopee', label: 'Shopee', aliases: 'ช้อปปี้ ชอปปี้ ช็อปปี้', match: /^shopee\b/i },
  { key: 'lazada', label: 'Lazada', aliases: 'ลาซาด้า', match: /^lazada\b/i },
  // before TikTok, or "Tiktok Seller" lands there
  { key: 'tiktokshop', label: 'TikTok Shop', aliases: 'ติ๊กต๊อกช้อป ติกตอกช็อป seller เซลเลอร์', match: /^tik\s?tok[\s-]*(seller|shop)\b/i },
  { key: 'tiktok', label: 'TikTok', aliases: 'ติ๊กต๊อก ติกตอก', match: /^tik\s?tok\b/i },
  { key: 'gmail', label: 'Gmail', aliases: 'จีเมล อีเมล email', match: /^(g-?mail|e-?mail)\b/i },
  { key: 'apple', label: 'Apple', aliases: 'แอปเปิล ไอคลาวด์ icloud', match: /^apple(\s*id)?\b/i },
  { key: 'canva', label: 'Canva', aliases: 'แคนวา', match: /^canva\b/i },
  { key: 'dropbox', label: 'Dropbox', aliases: 'ดรอปบ็อกซ์', match: /^dro[bp]box\b/i },
  { key: 'facebook', label: 'Facebook', aliases: 'เฟซบุ๊ก เฟส fb', match: /^(facebook|fb)\b/i },
  { key: 'instagram', label: 'Instagram', aliases: 'อินสตาแกรม ไอจี ig', match: /^(instagram|ig)\b/i },
  { key: 'line', label: 'LINE', aliases: 'ไลน์', match: /^line\b/i },
  { key: 'google', label: 'Google', aliases: 'กูเกิล', match: /^google\b/i },
]

const PLATFORMS: VaultPlatform[] = KNOWN.map((p) => ({ ...p, color: '', logo: `/platforms/${p.key}.svg` }))

export const PLATFORM_NAMES = PLATFORMS.map((p) => p.label)

/** A platform added by hand: its own group, with letters in place of a logo. */
const customPlatform = (text: string): VaultPlatform => ({
  key: text.trim().toLowerCase(),
  label: text.trim(),
  color: '#8A8178',
  short: text.trim().slice(0, 2).toUpperCase(),
  aliases: '',
})

/** "tiktok" → "TikTok" so one platform never splits into two groups. */
export const canonicalPlatform = (text: string) =>
  PLATFORMS.find((p) => p.match?.test(text))?.label ?? text.trim()

/** "Tiktok Seller GB" → TikTok Shop + GB. Unknown text: first word is the platform, the rest the shop. */
export function splitPlatform(text: string): { platform: string; name: string } {
  const known = PLATFORMS.find((p) => p.match?.test(text.trim()))
  if (known?.match) return { platform: known.label, name: text.trim().replace(known.match, '').trim() }
  const [platform = '', ...rest] = text.trim().split(/\s+/)
  return { platform, name: rest.join(' ') }
}

// Checked against the shop text first, then the login, so hapethailand@gmail.com is Hape.
const BRAND_WORDS: [RegExp, string][] = [
  [/\babc\b|abcthebaby/i, 'abcthebaby'],
  [/\bgb\b|goodbaby/i, 'gb'],
  [/hape/i, 'hape'],
  [/stokke/i, 'stokke'],
  [/taf\s?toys/i, 'taftoys'],
  [/tommee/i, 'tommeetippee'],
]

const brandOf = (text: string) => BRAND_WORDS.find(([re]) => re.test(text))?.[1] ?? null

export interface VaultRow {
  item: VaultItem
  platform: VaultPlatform
  /** Left over from accounts typed as "Shopee ABC"; empty once platform and shop are separate */
  shop: string
  brand: string | null
  search: string
}

export function toVaultRow(item: VaultItem): VaultRow {
  const platform = PLATFORMS.find((p) => p.match?.test(item.platform)) ?? customPlatform(item.platform)
  const shop = platform.match ? item.platform.replace(platform.match, '').trim() : ''
  const brand = brandOf(shop) ?? brandOf(item.name) ?? brandOf(item.username ?? '')
  const search = [item.platform, item.name, item.username, item.otpPhone, platform.label, platform.aliases, brand, brand && brandLabel(brand)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return { item, platform, shop, brand, search }
}

/** Every word must match, so "shopee abc" narrows instead of widening. */
export function matchesSearch(row: VaultRow, q: string) {
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((word) => row.search.includes(word))
}

export function groupByPlatform(rows: VaultRow[]) {
  const order = (r: VaultRow) => {
    const i = PLATFORMS.findIndex((p) => p.key === r.platform.key)
    return i < 0 ? PLATFORMS.length : i
  }
  const groups = new Map<string, VaultRow[]>()
  ;[...rows]
    .sort((a, b) => order(a) - order(b) || a.platform.label.localeCompare(b.platform.label) || Number(!a.brand) - Number(!b.brand) || (a.brand ?? '').localeCompare(b.brand ?? '') || a.shop.localeCompare(b.shop) || a.item.name.localeCompare(b.item.name))
    .forEach((r) => groups.set(r.platform.key, [...(groups.get(r.platform.key) ?? []), r]))
  return [...groups.values()]
}

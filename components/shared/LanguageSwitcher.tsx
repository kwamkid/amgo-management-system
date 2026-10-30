'use client'

// ปุ่มเปลี่ยนภาษาแบบตระกูล aoo (aoocommerce components/layout/LanguageSwitcher.tsx):
// ปุ่มกลมธงวงกลม → เมนูแถวละภาษา (ธง + ชื่อภาษาในภาษาตัวเอง + ✓ ที่ภาษาปัจจุบัน)
// ธงเป็น SVG ใน public/flags (ห้ามอีโมจิธง) · ใช้กับหน้าที่คนนอกเปิด เช่นหน้าฉลากของโรงงาน

import { Check } from 'lucide-react'
import { ActionMenu } from '@/components/aoo'

export type UiLang = 'th' | 'en' | 'zh'

export const LANG_LABEL: Record<UiLang, string> = { th: 'ไทย', en: 'English', zh: '中文' }

export function FlagIcon({ lang, size = 20 }: { lang: UiLang; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny SVG in public/ */}
      <img src={`/flags/${lang}.svg`} alt="" aria-hidden="true" className="h-full w-full object-cover" />
      <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/15" aria-hidden="true" />
    </span>
  )
}

export default function LanguageSwitcher({ value, onChange, langs = ['en', 'zh', 'th'] }: {
  value: UiLang
  onChange: (l: UiLang) => void
  langs?: UiLang[]
}) {
  return (
    <ActionMenu
      label={LANG_LABEL[value]}
      minWidth={170}
      trigger={({ onClick }) => (
        <button type="button" onClick={onClick} aria-label={`Language · ${LANG_LABEL[value]}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--bg-sunken)]">
          <FlagIcon lang={value} />
        </button>
      )}
      items={langs.map((l) => ({
        label: (
          <span className="flex w-full items-center gap-2">
            <FlagIcon lang={l} size={18} />
            <span>{LANG_LABEL[l]}</span>
            {l === value && <Check size={16} className="ml-auto text-[var(--accent)]" />}
          </span>
        ),
        onSelect: () => onChange(l),
      }))}
    />
  )
}

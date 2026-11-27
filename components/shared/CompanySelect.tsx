'use client'

// Company dropdown with logos — one look everywhere a company is picked (owner 27 Nov 2026)
import { Building2 } from 'lucide-react'
import { SelectMenu } from '@/components/aoo/select-menu'
import type { SelectOption } from '@/components/aoo/select-menu'

export type CompanyLite = { id: string; code: string; name_th: string; logo_url?: string | null }

function CompanyLogo({ src }: { src?: string | null }) {
  if (!src) return <Building2 size={16} className="text-gray-400" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-5 w-5 rounded object-contain" />
}

/** options for SelectMenu / FilterSelect: code + Thai name + logo */
export function companyOptions(companies: CompanyLite[]): SelectOption[] {
  return companies.map((c) => ({ value: c.id, label: c.code, hint: c.name_th, icon: <CompanyLogo src={c.logo_url} /> }))
}

export default function CompanySelect({
  companies,
  value,
  onChange,
  clearable = false,
  placeholder = 'เลือกบริษัท',
  disabled,
}: {
  companies: CompanyLite[]
  value: string | null
  onChange: (id: string | null) => void
  /** text of the "all companies" choice; false = must pick one */
  clearable?: string | false
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <SelectMenu
      value={value}
      options={companyOptions(companies)}
      onChange={onChange}
      clearable={clearable}
      placeholder={placeholder}
      disabled={disabled}
      ariaLabel="บริษัท"
    />
  )
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * หัวข้อหน้า — ของเดิมเขียนซ้ำอยู่ 38 หน้า แต่ละหน้าเยื้องไม่เท่ากัน
 *
 * <PageHeader title="จัดการสถานที่" description="..." icon={Building}
 *   actions={<Button>เพิ่มสถานที่</Button>} />
 */
export default function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  backHref,
  onBack,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  actions?: ReactNode
  /** ใส่แล้วจะมีปุ่มย้อนกลับด้านซ้าย */
  backHref?: string
  /** ถ้าอยากคุมการย้อนกลับเอง (เช่น เตือนก่อนทิ้งฟอร์ม) */
  onBack?: () => void
}) {
  const router = useRouter()
  const showBack = !!backHref || !!onBack

  const back = (
    <button
      onClick={onBack ?? (() => router.push(backHref!))}
      aria-label="ย้อนกลับ"
      data-button-fx="ghost"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500"
    >
      <ArrowLeft size={18} />
    </button>
  )

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {showBack && (backHref && !onBack ? <Link href={backHref}>{back}</Link> : back)}

        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <Icon size={20} className="text-red-600" strokeWidth={1.75} />
          </div>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
          {description && (
            <p className="mt-0.5 truncate text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

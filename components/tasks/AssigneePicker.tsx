'use client'

// เลือกผู้รับผิดชอบ — รูป + ชื่อเล่น · ใช้ทั้งตอนสร้างงานและแก้งาน

import { SelectMenu } from '@/components/aoo'
import { PersonChip, UserAvatar } from '@/components/shared'
import type { TaskPerson } from '@/lib/services/taskService'

export default function AssigneePicker({
  people,
  value,
  onChange,
  editable,
}: {
  people: TaskPerson[]
  value: string[]
  onChange: (ids: string[]) => void
  /** false = โชว์อย่างเดียว (มอบงานคนอื่นได้เฉพาะแอดมิน) */
  editable: boolean
}) {
  const byId = new Map(people.map((p) => [p.userId, p]))
  const options = people
    .filter((p) => !value.includes(p.userId))
    .map((p) => ({ value: p.userId, label: p.name, icon: <UserAvatar userId={p.userId} name={p.name} size="xs" /> }))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((id) => (
        <PersonChip
          key={id}
          userId={id}
          name={byId.get(id)?.name ?? '?'}
          onRemove={editable ? () => onChange(value.filter((x) => x !== id)) : undefined}
        />
      ))}
      {editable && (
        <div className="w-48">
          <SelectMenu value={null} options={options} onChange={(v) => v && onChange([...value, v])} placeholder="+ เพิ่มคน" size="md" />
        </div>
      )}
    </div>
  )
}

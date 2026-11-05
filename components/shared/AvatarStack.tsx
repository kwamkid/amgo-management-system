'use client'

import UserAvatar from './UserAvatar'

/** รูปคนซ้อนกันเป็นแถว เกินจำนวนขึ้น +N · ชี้แล้วเห็นชื่อ · เลือกคนใช้ PersonStrip สไตล์ .aoo-avatar-stack */
export default function AvatarStack({
  people,
  max = 5,
}: {
  people: { id: string; name: string }[]
  max?: number
}) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span className="aoo-avatar-stack" title={people.map((p) => p.name).join(', ')}>
      {shown.map((p) => (
        <UserAvatar key={p.id} userId={p.id} name={p.name} size="sm" className="aoo-avatar-stack__item" />
      ))}
      {extra > 0 && <span className="aoo-avatar-stack__more">+{extra}</span>}
    </span>
  )
}

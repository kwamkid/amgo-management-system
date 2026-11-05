'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Checkbox, IconButton, MultiSelectMenu } from '@/components/aoo'
import { ListRow, ListRows, PersonChip, UserAvatar } from '@/components/shared'
import { vaultPeople } from '@/lib/services/vaultService'
import { normalizeGrant, type VaultGrant, type VaultPerson } from '@/lib/vault/types'

type PermKey = 'canView' | 'canEdit' | 'canDelete'

const PERMS: [PermKey, string][] = [
  ['canView', 'ดู'],
  ['canEdit', 'แก้'],
  ['canDelete', 'ลบ'],
]

/** เลือกคน + ติ๊ก ดู/แก้/ลบ · ใช้ทั้งแท็บสิทธิ์รายบัญชี และตั้งสิทธิ์ทีละหลายบัญชี */
export default function GrantEditor({
  grants,
  onChange,
  empty,
}: {
  grants: VaultGrant[]
  onChange: (next: VaultGrant[]) => void
  empty: React.ReactNode
}) {
  const { showToast } = useToast()
  const [people, setPeople] = useState<VaultPerson[]>([])

  useEffect(() => {
    vaultPeople().then(setPeople).catch((e) => showToast(e.message, 'error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(
    () => people.map((p) => ({ value: p.id, label: p.name, icon: <UserAvatar userId={p.id} name={p.name} size="xs" /> })),
    [people]
  )

  // เลือกเพิ่ม = เริ่มที่ดูอย่างเดียว · เอาออกจากเมนู = ออกจากรายการ คนเดิมคงสิทธิ์ที่ติ๊กไว้
  const setPicked = (ids: string[]) => {
    const kept = grants.filter((g) => ids.includes(g.userId))
    const added = people
      .filter((p) => ids.includes(p.id) && !grants.some((g) => g.userId === p.id))
      .map((p) => ({ userId: p.id, name: p.name, canView: true, canEdit: false, canDelete: false }))
    onChange([...kept, ...added])
  }

  const toggle = (id: string, key: PermKey, on: boolean) =>
    onChange(
      grants.map((g) => {
        if (g.userId !== id) return g
        // เอา "ดู" ออก = เอาทุกอย่างออก · ติ๊กแก้/ลบ = ต้องดูได้ด้วย
        if (key === 'canView' && !on) return { ...g, canView: false, canEdit: false, canDelete: false }
        return { ...g, ...normalizeGrant({ ...g, [key]: on }), name: g.name }
      })
    )

  return (
    <div className="space-y-3">
      <MultiSelectMenu
        values={grants.map((g) => g.userId)}
        options={options}
        onChange={setPicked}
        placeholder="เลือกคน (ได้หลายคน)"
        summary={(n) => `เลือกแล้ว ${n} คน`}
      />

      {grants.length === 0 ? (
        empty
      ) : (
        <ListRows>
          {grants.map((g) => (
            <ListRow
              key={g.userId}
              title={<PersonChip userId={g.userId} name={g.name ?? ''} />}
              meta={
                <span className="mt-1 flex gap-4">
                  {PERMS.map(([key, label]) => (
                    <label key={key} className="inline-flex cursor-pointer items-center gap-1.5">
                      <Checkbox checked={g[key]} onChange={(on) => toggle(g.userId, key, on)} /> {label}
                    </label>
                  ))}
                </span>
              }
              trailing={
                <IconButton
                  icon={X}
                  aria-label={`เอา ${g.name} ออก`}
                  onClick={() => onChange(grants.filter((x) => x.userId !== g.userId))}
                />
              }
            />
          ))}
        </ListRows>
      )}
    </div>
  )
}

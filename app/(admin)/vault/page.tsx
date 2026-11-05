'use client'

// รหัสบัญชี (5 พ.ย. 69) — แทน Google Sheet ที่เก็บ user/pass ร้านค้า
// ล็อกทีละบัญชี: แอดมินทุกคนทำได้ทุกอย่าง และเลือกได้ว่าคนอื่นใคร ดู/แก้/ลบ บัญชีไหน · คนไม่มีสิทธิ์มองไม่เห็นว่าบัญชีนั้นมีอยู่
// ทุกการเปิดดูรหัสถูกบันทึก · ความลับออกจาก server ทีละบัญชีผ่าน /api/vault/[id]/reveal เท่านั้น

import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, EmptyState, Input } from '@/components/aoo'
import { ListRow, ListRows, PageHeader, SectionCard, TechLoader } from '@/components/shared'
import VaultDetailModal from '@/components/vault/VaultDetailModal'
import VaultFormModal from '@/components/vault/VaultFormModal'
import { permLabel } from '@/components/vault/vaultLabels'
import { addVault, listVault, type VaultForm } from '@/lib/services/vaultService'
import type { VaultItem } from '@/lib/vault/types'

export default function VaultPage() {
  const { userData, loading } = useAuth()
  const { showToast } = useToast()
  const [items, setItems] = useState<VaultItem[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await listVault()
      setItems(data.items)
      setIsAdmin(data.isAdmin)
    } catch (e) {
      showToast((e as Error).message, 'error')
      setItems([])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (userData) load()
  }, [userData, load])

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const hit = (items ?? []).filter((i) => `${i.platform} ${i.name}`.toLowerCase().includes(term))
    const byPlatform = new Map<string, VaultItem[]>()
    hit.forEach((i) => byPlatform.set(i.platform, [...(byPlatform.get(i.platform) ?? []), i]))
    return [...byPlatform.entries()]
  }, [items, q])

  const open = items?.find((i) => i.id === openId) ?? null

  const add = async (form: VaultForm) => {
    const { id } = await addVault(form)
    await load()
    setAdding(false)
    setOpenId(id) // ต่อไปคือเลือกคนที่เข้าถึงได้
  }

  if (loading || !userData || items === null) return <TechLoader />

  return (
    <div className="space-y-4">
      <PageHeader
        title="รหัสบัญชี"
        description="ล็อกทีละบัญชี เห็นเฉพาะบัญชีที่ได้รับสิทธิ์ และทุกการเปิดดูมีบันทึก"
        icon={KeyRound}
        actions={isAdmin ? <Button icon={Plus} onClick={() => setAdding(true)}>เพิ่มบัญชี</Button> : undefined}
      />

      {items.length > 0 && (
        <Input
          prefix={<Search size={16} />}
          placeholder="ค้นหาแพลตฟอร์มหรือชื่อบัญชี"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={<KeyRound />}
          title={items.length ? 'ไม่พบบัญชีนี้' : 'ยังไม่มีบัญชี'}
          body={isAdmin ? 'เพิ่มบัญชีแรก แล้วเลือกคนที่ดูหรือแก้ได้' : 'ให้แอดมินเพิ่มสิทธิ์ให้คุณก่อน'}
        />
      ) : (
        groups.map(([platform, rows]) => (
          <SectionCard key={platform} title={platform}>
            <ListRows>
              {rows.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.name}
                  meta={
                    isAdmin
                      ? item.access?.length
                        ? `เข้าถึงได้: ${item.access.map((g) => g.name).join(', ')}`
                        : 'เฉพาะแอดมิน'
                      : `สิทธิ์ของคุณ: ${permLabel(item.perm)}`
                  }
                  onClick={() => setOpenId(item.id)}
                />
              ))}
            </ListRows>
          </SectionCard>
        ))
      )}

      <VaultFormModal
        open={adding}
        title="เพิ่มบัญชี"
        platforms={[...new Set(items.map((i) => i.platform))]}
        onClose={() => setAdding(false)}
        onSubmit={add}
      />

      {open && (
        <VaultDetailModal
          key={open.id}
          item={open}
          isAdmin={isAdmin}
          platforms={[...new Set(items.map((i) => i.platform))]}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

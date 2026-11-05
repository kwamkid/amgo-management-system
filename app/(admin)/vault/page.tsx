'use client'

// รหัสบัญชี (5 พ.ย. 69) — แทน Google Sheet ที่เก็บ user/pass ร้านค้า
// ล็อกทีละบัญชี: แอดมินทุกคนทำได้ทุกอย่าง และเลือกได้ว่าคนอื่นใคร ดู/แก้/ลบ บัญชีไหน · คนไม่มีสิทธิ์มองไม่เห็นว่าบัญชีนั้นมีอยู่
// รายการแสดง User + เบอร์ OTP · รหัสผ่านและโน้ตออกจาก server ทีละบัญชีผ่าน /api/vault/[id]/reveal และมีบันทึก

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardPaste, KeyRound, LayoutGrid, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Checkbox, EmptyState, Input, useConfirm } from '@/components/aoo'
import AvatarStack from '@/components/shared/AvatarStack'
import IconFilter from '@/components/shared/IconFilter'
import { BrandLogo, ListRow, ListRows, PageHeader, SectionCard, TechLoader } from '@/components/shared'
import PlatformLogo from '@/components/vault/PlatformLogo'
import VaultBulkAccessModal from '@/components/vault/VaultBulkAccessModal'
import VaultDetailModal from '@/components/vault/VaultDetailModal'
import VaultFormModal from '@/components/vault/VaultFormModal'
import VaultImportModal from '@/components/vault/VaultImportModal'
import { permLabel } from '@/components/vault/vaultLabels'
import { addVault, deleteVaultBulk, importVault, listVault, saveVaultAccessBulk, type VaultForm } from '@/lib/services/vaultService'
import type { ImportRow } from '@/lib/vault/import'
import { groupByPlatform, matchesSearch, PLATFORM_NAMES, toVaultRow } from '@/lib/vault/platforms'
import type { VaultGrant, VaultItem, VaultPerson } from '@/lib/vault/types'

export default function VaultPage() {
  const { userData, loading } = useAuth()
  const { showToast } = useToast()
  const [items, setItems] = useState<VaultItem[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [admins, setAdmins] = useState<VaultPerson[]>([])
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const { confirm, dialog } = useConfirm()

  const load = useCallback(async () => {
    try {
      const data = await listVault()
      setItems(data.items)
      setIsAdmin(data.isAdmin)
      setAdmins(data.admins)
    } catch (e) {
      showToast((e as Error).message, 'error')
      setItems([])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (userData) load()
  }, [userData, load])

  const rows = useMemo(() => (items ?? []).map(toVaultRow), [items])

  const platformFilters = useMemo(
    () => [
      { key: 'all', label: 'ทั้งหมด', icon: <LayoutGrid size={20} /> },
      ...groupByPlatform(rows).map((g) => ({
        key: g[0].platform.key,
        label: g[0].platform.label,
        icon: <PlatformLogo platform={g[0].platform} size={26} />,
      })),
    ],
    [rows]
  )

  const groups = useMemo(
    () => groupByPlatform(rows.filter((r) => (filter === 'all' || r.platform.key === filter) && matchesSearch(r, q))),
    [rows, filter, q]
  )

  const platformNames = useMemo(
    () => [...new Set([...PLATFORM_NAMES, ...rows.map((r) => r.platform.label)])],
    [rows]
  )

  const open = items?.find((i) => i.id === openId) ?? null

  const add = async (form: VaultForm) => {
    const { id } = await addVault(form)
    await load()
    setAdding(false)
    setOpenId(id) // ต่อไปคือเลือกคนที่เข้าถึงได้
  }

  const pick = (ids: string[], on: boolean) =>
    setPicked((current) => {
      const next = new Set(current)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })

  const removeBulk = async () => {
    const ok = await confirm({
      title: `ลบ ${picked.size} บัญชี?`,
      description: 'รหัสที่เก็บไว้จะหายถาวร กู้คืนไม่ได้',
      confirmLabel: 'ลบบัญชี',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteVaultBulk([...picked])
      setPicked(new Set())
      await load()
      showToast('ลบแล้ว')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const saveBulk = async (grants: VaultGrant[]) => {
    await saveVaultAccessBulk([...picked], grants)
    await load()
    setBulkOpen(false)
    setPicked(new Set())
    showToast('บันทึกสิทธิ์แล้ว')
  }

  const bulk = async (rows: ImportRow[]) => {
    const { added, skipped } = await importVault(rows)
    await load()
    setImporting(false)
    showToast(skipped ? `นำเข้า ${added} บัญชี ข้าม ${skipped} บัญชีที่มีอยู่แล้ว` : `นำเข้า ${added} บัญชีแล้ว`)
  }

  if (loading || !userData || items === null) return <TechLoader />

  return (
    <div className="space-y-4">
      <PageHeader
        title="รหัสบัญชี"
        description="ล็อกทีละบัญชี เห็นเฉพาะบัญชีที่ได้รับสิทธิ์ และทุกการเปิดดูมีบันทึก"
        icon={KeyRound}
        actions={
          isAdmin ? (
            <>
              <Button variant="secondary" icon={ClipboardPaste} onClick={() => setImporting(true)}>นำเข้าจาก Sheet</Button>
              <Button icon={Plus} onClick={() => setAdding(true)}>เพิ่มบัญชี</Button>
            </>
          ) : undefined
        }
      />

      {items.length > 0 && (
        <Input
          prefix={<Search size={16} />}
          placeholder="ค้นหาแพลตฟอร์ม แบรนด์ อีเมล หรือเบอร์"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      {items.length > 0 && (
        <IconFilter ariaLabel="แพลตฟอร์ม" items={platformFilters} value={filter} onChange={setFilter} />
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={<KeyRound />}
          title={items.length ? 'ไม่พบบัญชีนี้' : 'ยังไม่มีบัญชี'}
          body={isAdmin ? 'เพิ่มบัญชีแรก แล้วเลือกคนที่ดูหรือแก้ได้' : 'ให้แอดมินเพิ่มสิทธิ์ให้คุณก่อน'}
        />
      ) : (
        <div className="aoo-masonry">
          {groups.map((group) => (
            <SectionCard
              key={group[0].platform.key}
              title={
                <span className="flex items-center gap-2.5">
                  <PlatformLogo platform={group[0].platform} />
                  {group[0].platform.label}
                  <span className="font-normal text-gray-400">{group.length}</span>
                  {isAdmin && (
                    <Checkbox
                      className="ml-auto"
                      size={18}
                      aria-label={`เลือกทุกบัญชีใน ${group[0].platform.label}`}
                      checked={group.every((r) => picked.has(r.item.id))}
                      indeterminate={group.some((r) => picked.has(r.item.id)) && !group.every((r) => picked.has(r.item.id))}
                      onChange={(on) => pick(group.map((r) => r.item.id), on)}
                    />
                  )}
                </span>
              }
            >
              <ListRows>
                {group.map(({ item, shop, brand }) => {
                  const login = item.username !== (shop || item.name) ? item.username : ''
                  return (
                    <ListRow
                      key={item.id}
                      leading={brand ? <BrandLogo brand={brand} /> : <span className="aoo-brand-logo" aria-hidden />}
                      title={shop || item.name}
                      meta={
                        <>
                          {(login || item.otpPhone) && (
                            <span className="block">{[login, item.otpPhone].filter(Boolean).join(' · ')}</span>
                          )}
                          {!isAdmin && `สิทธิ์ของคุณ: ${permLabel(item.perm)}`}
                        </>
                      }
                      trailing={
                        isAdmin ? (
                          <AvatarStack
                            people={[...admins, ...(item.access ?? []).map((g) => ({ id: g.userId, name: g.name ?? '' }))]}
                          />
                        ) : undefined
                      }
                      onClick={() => setOpenId(item.id)}
                      aside={
                        isAdmin ? (
                          <Checkbox
                            size={18}
                            aria-label={`เลือก ${item.platform} ${item.name}`}
                            checked={picked.has(item.id)}
                            onChange={(on) => pick([item.id], on)}
                          />
                        ) : undefined
                      }
                    />
                  )
                })}
              </ListRows>
            </SectionCard>
          ))}
        </div>
      )}

      {picked.size > 0 && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
          <span className="font-medium">เลือก {picked.size} บัญชี</span>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={() => setPicked(new Set())}>ล้าง</Button>
            <Button variant="danger" icon={Trash2} onClick={removeBulk}>ลบ</Button>
            <Button icon={ShieldCheck} onClick={() => setBulkOpen(true)}>ตั้งสิทธิ์</Button>
          </span>
        </div>
      )}

      <VaultBulkAccessModal open={bulkOpen} count={picked.size} onClose={() => setBulkOpen(false)} onSave={saveBulk} />

      <VaultFormModal
        open={adding}
        title="เพิ่มบัญชี"
        platforms={platformNames}
        onClose={() => setAdding(false)}
        onSubmit={add}
      />

      <VaultImportModal open={importing} existing={items} onClose={() => setImporting(false)} onImport={bulk} />

      {open && (
        <VaultDetailModal
          key={open.id}
          item={open}
          isAdmin={isAdmin}
          platforms={platformNames}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
      {dialog}
    </div>
  )
}

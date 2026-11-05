'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Field, Modal, SelectMenu, Textarea } from '@/components/aoo'
import { ListRow, ListRows } from '@/components/shared'
import { guessColumns, IMPORT_FIELDS, looksLikeHeader, parseSheet, toRows, vaultKey, type ImportField, type ImportRow } from '@/lib/vault/import'

/** วางข้อความที่ copy จาก Sheet → จับคู่คอลัมน์ → ดูตัวอย่าง (ปิดรหัส) → นำเข้า */
export default function VaultImportModal({
  open,
  existing,
  onClose,
  onImport,
}: {
  open: boolean
  existing: { platform: string; name: string }[]
  onClose: () => void
  onImport: (rows: ImportRow[]) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [hasHeader, setHasHeader] = useState(false)
  const [columns, setColumns] = useState<ImportField[]>([])
  const [dropped, setDropped] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) return
    setText('') // ไม่ทิ้งรหัสไว้ในหน้าจอหลังปิด
    setColumns([])
    setDropped(new Set())
    setError('')
  }, [open])

  const cells = useMemo(() => parseSheet(text), [text])

  const paste = (value: string) => {
    setText(value)
    const first = parseSheet(value)[0]
    const header = looksLikeHeader(first)
    setHasHeader(header)
    setColumns(guessColumns(first, header))
    setDropped(new Set())
  }

  const rows = useMemo(() => {
    const seen = new Set(existing.map(vaultKey))
    return cells
      .slice(hasHeader ? 1 : 0)
      .flatMap((c) => toRows(c, columns))
      .map((row, i) => {
        const key = vaultKey(row)
        const problem = !row.platform || !row.name ? 'ไม่มีแพลตฟอร์มหรือชื่อร้าน' : seen.has(key) ? 'มีบัญชีนี้แล้ว' : ''
        seen.add(key)
        return { i, row, problem }
      })
  }, [cells, columns, hasHeader, existing])

  const chosen = rows.filter((r) => !r.problem && !dropped.has(r.i))

  const toggle = (i: number, on: boolean) =>
    setDropped((d) => {
      const next = new Set(d)
      if (on) next.delete(i)
      else next.add(i)
      return next
    })

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      await onImport(chosen.map((r) => r.row))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="นำเข้าจาก Sheet"
      description="คัดลอกแถวจาก Google Sheet มาวางในช่องนี้ แถวละ 1 บัญชี"
      maxWidth={720}
      dismissOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} loading={saving} disabled={!chosen.length}>นำเข้า {chosen.length} บัญชี</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="ข้อมูลจาก Sheet" error={error || undefined}>
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => paste(e.target.value)}
            placeholder="Shopee ABC	user@gmail.com	รหัสผ่าน	0812345678	โน้ต"
            spellCheck={false}
            autoComplete="off"
          />
        </Field>

        {columns.length > 0 && (
          <>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <Checkbox checked={hasHeader} onChange={setHasHeader} /> แถวแรกเป็นหัวตาราง
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              {columns.map((field, i) => (
                <Field key={i} label={`คอลัมน์ ${i + 1}`}>
                  <SelectMenu
                    value={field}
                    options={IMPORT_FIELDS}
                    onChange={(v) => setColumns((c) => c.map((old, n) => (n === i ? ((v as ImportField) ?? 'skip') : old)))}
                  />
                </Field>
              ))}
            </div>

            <ListRows>
              {rows.map(({ i, row, problem }) => (
                <ListRow
                  key={i}
                  leading={
                    <Checkbox
                      checked={!problem && !dropped.has(i)}
                      disabled={!!problem}
                      onChange={(on) => toggle(i, on)}
                      aria-label={`เลือก ${row.platform} ${row.name}`}
                    />
                  }
                  title={`${row.platform} ${row.name}`.trim() || '(ว่าง)'}
                  meta={
                    problem ||
                    [row.secret.username, row.secret.password && '••••••', row.secret.otpPhone, row.secret.note && 'มีโน้ต']
                      .filter(Boolean)
                      .join(' · ')
                  }
                />
              ))}
            </ListRows>
          </>
        )}
      </div>
    </Modal>
  )
}

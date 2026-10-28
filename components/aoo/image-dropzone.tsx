'use client'

// กล่องรูปแบบลากวาง — ลากไฟล์มาวาง/กดเลือกได้หลายรูป · ลากเรียงลำดับได้ · รูปแรก = ปก (ถ้าตั้ง coverLabel)
// พอร์ตจาก MediaDropzone ของ aoosocial (เหลือแค่รูป ไม่มีวิดีโอ/ครอป/คลัง) · สไตล์อยู่ที่ .aoo-dropzone
//
// ตัวกล่องไม่อัปโหลดเอง — แม่เป็นเจ้าของ items และตัดสินใจว่าจะทำอะไรกับไฟล์
//   · อัปโหลดทันที (รูปของงาน): onFilesPicked → อัปแล้วโหลดใหม่ · ใส่ pending ระหว่างรอ
//   · เก็บไว้ก่อน (ฟอร์มที่ยังไม่บันทึก): สร้าง URL.createObjectURL เป็น url ชั่วคราว
//
// <ImageDropzone items={imgs} onFilesPicked={upload} onRemove={del} onReorder={reorder} coverLabel="ปก" />

import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { FileText, ImagePlus, Plus, X } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Spinner } from './spinner'

export interface ImageDropzoneItem {
  id: string
  /** รูปตัวอย่าง (signed URL หรือ blob:) */
  url?: string | null
  name?: string | null
  /** กำลังอัปโหลด — มีวงหมุนทับ ลากเรียงได้แต่ลบไม่ได้ */
  pending?: boolean
  /** ไฟล์ PDF — โชว์ไอคอน + ชื่อแทนรูป */
  isPdf?: boolean
}

export interface ImageDropzoneProps {
  items: ImageDropzoneItem[]
  /** ไฟล์ที่เพิ่งเลือก/ลากมา (ตัดให้ไม่เกิน maxItems แล้ว) */
  onFilesPicked?: (files: File[]) => void
  onRemove?: (id: string) => void
  /** ลำดับใหม่ทั้งชุด — ไม่ส่ง = ลากเรียงไม่ได้ */
  onReorder?: (orderedIds: string[]) => void
  /** ค่าเริ่มต้น 20 */
  maxItems?: number
  /** ดูอย่างเดียว — ไม่มีปุ่มเพิ่ม/ลบ/ลาก · กดรูปเปิดเต็มจอ */
  readOnly?: boolean
  disabled?: boolean
  /** ป้ายบนรูปแรก เช่น "ปก" — ไม่ส่ง = ไม่มีป้าย */
  coverLabel?: string
  /** ข้อความในกล่องว่าง — ค่าเริ่มต้น "ลากรูปมาวาง หรือกดเพื่อเลือก" */
  label?: string
  /** ขนาดช่อง: md = รูปของงาน · sm = แนบในฟอร์มเล็ก */
  size?: 'sm' | 'md'
  /** รับ PDF ด้วย (ใบเสร็จ · ใบรับรองแพทย์) */
  allowPdf?: boolean
  className?: string
}

// HEIC ต้องใส่ทั้ง mime และนามสกุล — macOS ส่ง HEIC มาเป็น mime ว่างในหน้าต่างเลือกไฟล์
const ACCEPT = 'image/*,image/heic,image/heif,.heic,.heif'

const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)
const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

export function ImageDropzone({
  items,
  onFilesPicked,
  onRemove,
  onReorder,
  maxItems = 20,
  readOnly,
  disabled,
  coverLabel,
  label = 'ลากรูปมาวาง หรือกดเพื่อเลือก',
  size = 'md',
  allowPdf,
  className,
}: ImageDropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const editable = !readOnly && !disabled
  const remaining = Math.max(0, maxItems - items.length)
  const canAdd = editable && !!onFilesPicked && remaining > 0
  const reorderEnabled = editable && !!onReorder && items.length > 1

  const sensors = useSensors(
    // 4px กันกดปุ่มลบแล้วกลายเป็นลาก · มือถือกดค้างนิดนึงก่อนลาก ไม่งั้นเลื่อนจอไม่ได้
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  )

  const pick = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list)
        .filter((f) => isImageFile(f) || (allowPdf && isPdfFile(f)))
        .slice(0, remaining)
      if (files.length) onFilesPicked?.(files)
    },
    [onFilesPicked, remaining, allowPdf]
  )

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    // ลากเรียงใช้ pointer ของ dnd-kit ไม่มีไฟล์ — ที่นี่รับเฉพาะไฟล์จากเครื่อง
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    if (canAdd) pick(e.dataTransfer.files)
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = items.map((it) => it.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from > -1 && to > -1) onReorder?.(arrayMove(ids, from, to))
  }

  if (readOnly && !items.length) return null
  const activeItem = activeId ? items.find((it) => it.id === activeId) : null

  return (
    <div className={className ? `aoo-dropzone ${className}` : 'aoo-dropzone'} data-size={size}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={allowPdf ? `${ACCEPT},application/pdf,.pdf` : ACCEPT}
        multiple={maxItems > 1}
        hidden
        disabled={!canAdd}
        onChange={(e) => {
          if (e.target.files) pick(e.target.files)
          e.target.value = '' // เลือกไฟล์เดิมซ้ำได้
        }}
      />
      <div
        className="aoo-dropzone__box"
        data-dragging={dragging || undefined}
        data-empty={!items.length || undefined}
        data-readonly={readOnly || undefined}
        onDrop={onDrop}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files') || !canAdd) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false)
        }}
      >
        {!items.length ? (
          <button type="button" className="aoo-dropzone__empty" disabled={!canAdd} onClick={() => inputRef.current?.click()}>
            <ImagePlus size={size === 'sm' ? 18 : 24} />
            <span>{label}</span>
          </button>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy} disabled={!reorderEnabled}>
              <div className="aoo-dropzone__grid">
                {items.map((it, i) => (
                  <SortableTile
                    key={it.id}
                    item={it}
                    cover={i === 0 ? coverLabel : undefined}
                    readOnly={readOnly}
                    reorderEnabled={reorderEnabled}
                    onRemove={editable && onRemove && !it.pending ? () => onRemove(it.id) : undefined}
                  />
                ))}
                {canAdd && (
                  <button
                    type="button"
                    className="aoo-dropzone__add"
                    onClick={() => inputRef.current?.click()}
                    aria-label="เพิ่มรูป"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeItem ? <Tile item={activeItem} overlay /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
      {reorderEnabled && <p className="aoo-dropzone__hint">ลากเพื่อเรียงลำดับ{coverLabel ? ` · รูปแรกเป็น${coverLabel}` : ''}</p>}
    </div>
  )
}

function SortableTile({
  item,
  cover,
  readOnly,
  reorderEnabled,
  onRemove,
}: {
  item: ImageDropzoneItem
  cover?: string
  readOnly?: boolean
  reorderEnabled: boolean
  onRemove?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !reorderEnabled,
  })
  return (
    <div
      ref={setNodeRef}
      // ตำแหน่งระหว่างลากคำนวณสด — ต้องเป็น style (CSS ทำแทนไม่ได้)
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...(reorderEnabled ? { ...attributes, ...listeners } : {})}
    >
      <Tile item={item} cover={cover} readOnly={readOnly} dragging={isDragging} draggable={reorderEnabled} onRemove={onRemove} />
    </div>
  )
}

function Tile({
  item,
  cover,
  readOnly,
  dragging,
  draggable,
  overlay,
  onRemove,
}: {
  item: ImageDropzoneItem
  cover?: string
  readOnly?: boolean
  dragging?: boolean
  draggable?: boolean
  overlay?: boolean
  onRemove?: () => void
}) {
  const img = item.isPdf ? (
    <span className="aoo-dropzone__file">
      <FileText size={22} />
      <span>{item.name ?? 'PDF'}</span>
    </span>
  ) : item.url ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL / blob: ใช้ next/image ไม่ได้
    <img src={item.url} alt={item.name ?? 'รูปแนบ'} loading="lazy" draggable={false} />
  ) : null
  return (
    <div
      className="aoo-dropzone__tile"
      data-dragging={dragging || undefined}
      data-overlay={overlay || undefined}
      data-draggable={draggable || undefined}
    >
      {readOnly && item.url ? (
        <a href={item.url} target="_blank" rel="noreferrer">
          {img}
        </a>
      ) : (
        img
      )}
      {cover && <span className="aoo-dropzone__cover">{cover}</span>}
      {item.pending && (
        <span className="aoo-dropzone__pending">
          <Spinner size="sm" />
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          className="aoo-dropzone__remove"
          // กันกดลบแล้ว dnd-kit จับเป็นการลาก
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          aria-label="ลบรูป"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  FileDropzone — ฟอร์มที่เก็บไฟล์ไว้ก่อนกดบันทึก (สลิป · ใบเสร็จ · ใบรับรองแพทย์)  */
/*  แม่ถือ File[] ตรง ๆ · ตัวนี้ทำรูปตัวอย่าง (blob:) และคืน URL ให้เองตอนเลิกใช้      */
/* ------------------------------------------------------------------ */

export interface FileDropzoneProps
  extends Pick<ImageDropzoneProps, 'maxItems' | 'disabled' | 'label' | 'size' | 'allowPdf' | 'className'> {
  files: File[]
  onChange: (files: File[]) => void
}

export function FileDropzone({ files, onChange, maxItems = 1, ...rest }: FileDropzoneProps) {
  const ids = useRef(new WeakMap<File, string>())
  const seq = useRef(0)
  const idOf = (f: File) => {
    let id = ids.current.get(f)
    if (!id) ids.current.set(f, (id = `f${++seq.current}`))
    return id
  }
  // สร้าง/คืน blob: ใน effect คู่กัน — StrictMode เรียก cleanup แล้วสร้างใหม่ได้ไม่พัง
  const [items, setItems] = useState<ImageDropzoneItem[]>([])
  useEffect(() => {
    const next = files.map((f) =>
      isPdfFile(f)
        ? { id: idOf(f), name: f.name, isPdf: true }
        : { id: idOf(f), name: f.name, url: URL.createObjectURL(f) }
    )
    setItems(next)
    return () => next.forEach((it) => it.url && URL.revokeObjectURL(it.url))
  }, [files]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ImageDropzone
      {...rest}
      maxItems={maxItems}
      items={items}
      onFilesPicked={(picked) => onChange(maxItems === 1 ? picked.slice(0, 1) : [...files, ...picked].slice(0, maxItems))}
      onRemove={(id) => onChange(files.filter((f) => idOf(f) !== id))}
      onReorder={maxItems > 1 ? (order) => onChange(order.map((id) => files.find((f) => idOf(f) === id)!)) : undefined}
    />
  )
}

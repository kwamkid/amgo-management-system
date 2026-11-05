'use client'

// รายละเอียดใบเบิกหนึ่งใบ — บัญชีกดแถวแล้วดูข้อมูลครบ + รูปใบเสร็จขนาดใหญ่ก่อนตัดสินใจ (เจ้าของ 3 พ.ย. 69)
// ปุ่มตามขั้น: รออนุมัติ = แก้ไข · ไม่อนุมัติ · อนุมัติ · รอโอน = โอนแล้ว · แนบสลิป
// หน้านี้แค่แสดง + เรียก callback — การอนุมัติจริงตรวจซ้ำในฟังก์ชัน SQL

import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Button, IconChip, Modal } from '@/components/aoo'
import { getBank } from '@/lib/constants/banks'
import {
  KIND_LABEL,
  SECTION_LABEL,
  formSectionOf,
  type ExpenseClaim,
} from '@/lib/services/expenseService'
import ExpenseStatusPill from './ExpenseStatusPill'
import ReceiptGallery from './ReceiptGallery'
import { KIND_VISUAL, SECTION_VISUAL, thb } from './expenseVisuals'

const day = (iso: string) => format(new Date(`${iso.slice(0, 10)}T00:00:00`), 'd MMM yyyy', { locale: th })
const at = (iso: string) => format(new Date(iso), 'd MMM yyyy HH:mm', { locale: th })
/** 0384699759 → 038-4-69975-9 */
export const fmtAcc = (a: string | null | undefined) => {
  const d = (a ?? '').replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9)}` : d
}

export interface ClaimCompany {
  code: string
  name_th: string
  scb_debit_account: string | null
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[108px_1fr] gap-3 py-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 text-gray-900">{children}</dd>
    </div>
  )
}

export default function ClaimDetailModal({
  claim,
  company,
  canApprove,
  canMarkPaid,
  busy,
  onClose,
  onApprove,
  onReject,
  onEdit,
  onMarkPaid,
}: {
  claim: ExpenseClaim | null
  company?: ClaimCompany
  /** บัญชี + ใบรออนุมัติ + ไม่ใช่ใบของตัวเอง */
  canApprove: boolean
  /** บัญชี + ใบส่งไฟล์แล้ว รอโอน */
  canMarkPaid: boolean
  busy?: boolean
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
  onMarkPaid: () => void
}) {
  if (!claim) return null
  const c = claim
  const sec = formSectionOf(c.category, c.vatAmount)
  const supplier = c.kind === 'supplier'
  const editable = canApprove || canMarkPaid || c.status === 'approved'

  const dest = supplier
    ? `${getBank(c.payeeBank)?.nameTh ?? c.payeeBank ?? ''} ${fmtAcc(c.payeeAccountNo)} · ${c.payeeName}`
    : c.bankName
      ? `${getBank(c.bankName)?.nameTh ?? c.bankName} ${fmtAcc(c.bankAccountNo)} · ${c.ownerFullName ?? c.userName}`
      : 'พนักงานยังไม่ได้ใส่บัญชีธนาคาร'

  const timeline = [
    { label: 'ยื่นใบ', when: c.createdAt },
    { label: 'บัญชีอนุมัติ', when: c.financeAt },
    { label: 'ส่งไฟล์ธนาคาร', when: c.exportedAt },
    { label: 'โอนแล้ว', when: c.paidAt },
  ].filter((t) => t.when)

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? `จ่าย ${c.payeeName}` : `ใบเบิกของ ${c.userName}`}
      maxWidth={980}
      footer={
        <>
          {editable && (
            <Button variant="ghost" icon="Pencil" onClick={onEdit} disabled={busy}>
              แก้ไข
            </Button>
          )}
          <span className="flex-1" />
          {canApprove ? (
            <>
              <Button variant="secondary" onClick={onReject} disabled={busy}>
                ไม่อนุมัติ
              </Button>
              <Button icon="Check" onClick={onApprove} loading={busy}>
                อนุมัติ
              </Button>
            </>
          ) : canMarkPaid ? (
            <Button icon="Check" onClick={onMarkPaid} disabled={busy}>
              โอนแล้ว · แนบสลิป
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              ปิด
            </Button>
          )}
        </>
      }
    >
      {/* ซ้าย = รูปใหญ่ (ดูชัดก่อนอนุมัติ) · ขวา = ข้อมูล · มือถือเรียงบนลงล่าง */}
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          {c.receiptPaths.length || c.slipPath ? (
            <ReceiptGallery paths={c.receiptPaths} slipPath={c.slipPath} />
          ) : (
            <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-1 rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-800">
              <span className="font-semibold">ไม่มีใบเสร็จ</span>
              {c.noReceiptReason && <span>{c.noReceiptReason}</span>}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-3">
            <IconChip icon={SECTION_VISUAL[sec].icon} tone={SECTION_VISUAL[sec].tone} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold text-gray-900">{thb(c.amount)}</p>
              <p className="text-base text-gray-600">{c.description}</p>
            </div>
          </div>
          <ExpenseStatusPill status={c.status} payout={c.payout} exportedAt={c.exportedAt} />

        <dl className="divide-y divide-gray-100 border-t border-gray-100">
          <Row label="แบบ">
            <span className="inline-flex items-center gap-1.5">
              <IconChip icon={KIND_VISUAL[c.kind].icon} tone={KIND_VISUAL[c.kind].tone} size={22} />
              {KIND_LABEL[c.kind]}
            </span>
          </Row>
          <Row label={supplier ? 'ขอโดย' : 'ผู้เบิก'}>{c.userName}</Row>
          <Row label={supplier ? 'วันที่ใบแจ้งหนี้' : 'วันที่จ่าย'}>{day(c.expenseDate)}</Row>
          <Row label="หมวด">{SECTION_LABEL[sec]}</Row>
          {(c.routeFrom || c.routeTo) && (
            <Row label="เส้นทาง">
              {c.routeFrom ?? '—'} → {c.routeTo ?? '—'}
              {c.distanceKm != null && ` · ${c.distanceKm} กม.`}
            </Row>
          )}
          {c.purpose && <Row label="วัตถุประสงค์">{c.purpose}</Row>}
          {c.attendees && <Row label="รับรอง">{c.attendees}</Row>}
          {c.vatAmount > 0 && (
            <Row label="VAT 7%">
              {thb(c.vatAmount)} · ก่อน VAT {thb(c.amount - c.vatAmount)}
            </Row>
          )}
          <Row label="โอนจาก">
            {company ? `${company.code} · ${company.name_th}` : '—'}
            {company?.scb_debit_account && ` (SCB ${fmtAcc(company.scb_debit_account)})`}
          </Row>
          <Row label={supplier ? 'เข้าบัญชีร้าน' : 'เข้าบัญชีพนักงาน'}>
            <span className="font-medium">{dest}</span>
          </Row>
          {c.rejectedReason && (
            <Row label="ไม่อนุมัติ">
              <span className="text-red-600">{c.rejectedReason}</span>
            </Row>
          )}
          {c.paidNote && <Row label="หมายเหตุโอน">{c.paidNote}</Row>}
          <Row label="ความคืบหน้า">
            <ol className="space-y-0.5">
              {timeline.map((t) => (
                <li key={t.label} className="text-sm text-gray-600">
                  <span className="font-medium text-gray-800">{t.label}</span> · {at(t.when!)}
                </li>
              ))}
            </ol>
          </Row>
          </dl>
        </div>
      </div>
    </Modal>
  )
}

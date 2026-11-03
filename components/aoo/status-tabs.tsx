"use client";

import type { PillTone } from "./pill";

/**
 * แท็บสถานะแบบกะทัดรัด: ป้ายชื่อ + ตัวเลขใหญ่ — ยกจาก aoocommerce (components/ui/StatusTabs.tsx หน้าคำสั่งซื้อ)
 * แทนการ์ดสถิติใหญ่ที่ใช้เป็นแท็บ (เจ้าของ 3 พ.ย. 69: การ์ดใหญ่เกิน)
 * ไม่ได้เลือก = พื้นอ่อนของสี · เลือกอยู่ = พื้นสีเต็ม ตัวหนังสือขาว · แถวเดียวเลื่อนซ้าย-ขวาได้
 * สีจาก [data-tone] ใน globals.css · สไตล์ .aoo-status-tab
 */
export interface StatusTab {
  key: string;
  label: string;
  count?: number | string;
  /** บรรทัดเล็กใต้ตัวเลข เช่น ยอดเงินรวม */
  hint?: string;
  tone?: PillTone;
  /** โลโก้เล็กหน้าป้ายชื่อ (เช่น แท็บบริษัท) */
  image?: string | null;
}

export function StatusTabs({
  tabs,
  activeKey,
  onSelect,
  ariaLabel,
  compact = false,
  fill = false,
}: {
  tabs: StatusTab[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  ariaLabel?: string;
  /** บรรทัดเดียว: ป้ายชื่อ + ตัวเลขในวงเล็บ — แท็บย่อยในการ์ด (เช่น เลือกบริษัท) */
  compact?: boolean;
  /** กว้างเท่ากันเต็มแถว (แท็บหลักของหน้า) */
  fill?: boolean;
}) {
  return (
    <div className={fill ? "aoo-status-tabs aoo-status-tabs--fill" : "aoo-status-tabs"} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={activeKey === t.key}
          aria-pressed={activeKey === t.key}
          data-tone={t.tone ?? "accent"}
          className={compact ? "aoo-status-tab aoo-status-tab--compact" : "aoo-status-tab"}
          onClick={() => onSelect(t.key)}
        >
          <span className="aoo-status-tab__label">
            {t.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.image} alt="" className="aoo-status-tab__image" />
            )}
            {t.label}
          </span>
          {compact ? (
            t.count !== undefined && <span className="aoo-status-tab__badge">{t.count}</span>
          ) : (
            <>
              {t.count !== undefined && <span className="aoo-status-tab__count">{t.count}</span>}
              {t.hint && <span className="aoo-status-tab__hint">{t.hint}</span>}
            </>
          )}
        </button>
      ))}
    </div>
  );
}

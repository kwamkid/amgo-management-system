"use client";

import React, { type CSSProperties } from "react";
import { IconChip } from "./icon-chip";
import type { PillTone } from "./pill";

export interface ChoiceTile {
  value: string;
  label: React.ReactNode;
  /** บรรทัดเล็กใต้ชื่อ */
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone?: PillTone;
  /** รูปแทนไอคอน เช่น โลโก้บริษัท */
  image?: string | null;
}

/**
 * ปุ่มเลือกแบบการ์ดมีไอคอน/โลโก้ — เลือกได้ 1 ตัว (แทน dropdown เมื่อตัวเลือกน้อยและอยากให้เห็นภาพ)
 * ตัวที่เลือก = กรอบสีแบรนด์ + พื้นอ่อน (แบบ RadioCardGroup) · สไตล์อยู่ .aoo-tile ใน globals.css
 * columns = จำนวนคอลัมน์บนจอกว้าง · mobileColumns = บนมือถือ
 */
export function ChoiceTiles({
  options,
  value,
  onChange,
  columns = 3,
  mobileColumns = 2,
  stacked = false,
  scroll = false,
  ariaLabel,
}: {
  options: ChoiceTile[];
  value: string | null;
  onChange: (value: string) => void;
  columns?: number;
  mobileColumns?: number;
  /** ไอคอนอยู่บน ชื่ออยู่ล่าง (ช่องแคบ ตัวเลือกเยอะ) */
  stacked?: boolean
  /** แถวเดียว เลื่อนซ้าย-ขวาได้ แทนการบีบให้พอดี (ตัวเลือกเยอะ กดง่ายกว่า) — ไม่สน columns
   *  ไม่มีกรอบ ไอคอนใหญ่ (เจ้าของ 3 พ.ย. 69) · ตัวที่เลือก = พื้นอ่อน + กรอบแบรนด์ */
  scroll?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      className={scroll ? "aoo-tiles aoo-tiles--scroll" : "aoo-tiles"}
      role="radiogroup"
      aria-label={ariaLabel}
      style={{ "--tiles-cols": columns, "--tiles-cols-sm": mobileColumns } as CSSProperties}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-pressed={value === o.value}
          className={stacked ? "aoo-tile aoo-tile--stacked" : "aoo-tile"}
          onClick={() => onChange(o.value)}
        >
          {o.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.image} alt="" className="aoo-tile__image" />
          ) : o.icon ? (
            <IconChip icon={o.icon} tone={o.tone ?? "accent"} size={scroll ? 56 : stacked ? 34 : 32} />
          ) : null}
          <span className="aoo-tile__text">
            <span className="aoo-tile__label">{o.label}</span>
            {o.hint && <span className="aoo-tile__hint">{o.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

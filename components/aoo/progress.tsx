"use client";

import type { CSSProperties } from "react";

/**
 * `<Progress>` — แถบความคืบหน้า 0–100 (ใช้แทน progress ของ shadcn ที่หน้าเก่าใช้)
 * สีตาม tone ([data-tone] ใน globals.css) · สูง 8px ปรับได้ด้วย prop height
 */
export type ProgressTone =
  | "accent" | "success" | "warning" | "danger" | "info" | "neutral"
  | "sky" | "pink" | "grape" | "plum";

export interface ProgressProps {
  /** 0–100 (หรือ 0–max) */
  value: number;
  max?: number;
  tone?: ProgressTone;
  /** ความสูงแถบ (px) ค่าเริ่มต้น 8 */
  height?: number;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export function Progress({ value, max = 100, tone = "accent", height, className, style, ...aria }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={aria["aria-label"]}
      data-tone={tone}
      className={className ? `aoo-progress ${className}` : "aoo-progress"}
      style={height ? { height, ...style } : style}
    >
      {/* ความกว้างคำนวณสด — inline ที่จำเป็น */}
      <div className="aoo-progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

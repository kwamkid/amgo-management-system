"use client";

import type { CSSProperties } from "react";

/**
 * `<Progress>` — แถบความคืบหน้า 0–100 (ใช้แทน progress ของ shadcn ที่หน้าเก่าใช้)
 * สีตาม tone · ความสูงตั้งผ่าน className (เช่น h-2) — ค่าเริ่มต้น 8px
 */
export type ProgressTone = "accent" | "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<ProgressTone, string> = {
  accent: "var(--brand-coral-500)",
  success: "var(--leaf-500)",
  warning: "var(--sun-500)",
  danger: "var(--ruby-500)",
  info: "var(--grape-500)",
  neutral: "var(--warm-400)",
};

export interface ProgressProps {
  /** 0–100 (หรือ 0–max) */
  value: number;
  max?: number;
  tone?: ProgressTone;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export function Progress({ value, max = 100, tone = "accent", className, style, ...aria }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={aria["aria-label"]}
      className={className}
      style={{ height: 8, width: "100%", borderRadius: 9999, background: "var(--warm-150)", overflow: "hidden", ...style }}
    >
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 9999, background: TONES[tone], transition: "width var(--dur-med) var(--ease-out)" }} />
    </div>
  );
}

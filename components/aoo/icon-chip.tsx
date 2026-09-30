import React, { type CSSProperties } from "react";
import type { PillTone } from "./pill";

/**
 * ชิปสีหลังไอคอน — แทน `<span className="aoo-title-icon" data-tone>` /
 * วงไอคอนไล่สีที่เคยเขียนเองตามหน้า · สีจาก [data-tone] ใน globals.css
 */
export function IconChip({
  icon: Icon,
  tone = "accent",
  size = 40,
  solid,
  className,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone?: PillTone;
  /** ขนาดกล่อง (px) ไอคอนครึ่งหนึ่ง */
  size?: number;
  /** พื้นสีเต็ม ไอคอนขาว */
  solid?: boolean;
  className?: string;
}) {
  return (
    <span
      className={className ? `aoo-icon-chip ${className}` : "aoo-icon-chip"}
      data-tone={tone}
      data-solid={solid || undefined}
      style={{ "--chip-size": `${size}px` } as CSSProperties}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}

import React, { type CSSProperties, type ReactNode } from "react";

/* ==========================================================================
 *  EmptyState — centered "nothing here yet" placeholder
 *
 *  Replaces the ~10+ hand-rolled `padding: 32-48px; textAlign: center;
 *  display: grid; gap: 8-10px; justifyItems: center` blocks scattered
 *  across dashboard, posts, media, ads, and settings pages. Sizes drifted
 *  (32 / 40 / 48px padding) — canonicalises them.
 *
 *  Usage:
 *    <EmptyState
 *      icon={<Inbox size={28} />}
 *      title="ยังไม่มีโพสต์ที่ตั้งเวลาไว้"
 *      body="สร้างโพสต์แรก แล้วระบบจะแสดงรายการที่นี่"
 *      action={<Button variant="primary">สร้างโพสต์</Button>}
 *    />
 *
 *  Density via `size`:
 *    - "sm": padding 24px, gap 6px      (inside cards / sidebars)
 *    - "md": padding 40px, gap 10px     (default — main panels)
 *    - "lg": padding 64px, gap 14px     (full-page empty states)
 * ========================================================================== */

export type EmptyStateSize = "sm" | "md" | "lg";

export interface EmptyStateProps {
  /** Lucide icon (or any node) shown above the title. Optional. */
  icon?: ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  /** Optional CTA(s) below the body. */
  action?: ReactNode;
  size?: EmptyStateSize;
  className?: string;
  style?: CSSProperties;
}

const SIZE: Record<EmptyStateSize, { padding: number; gap: number }> = {
  sm: { padding: 24, gap: 6 },
  md: { padding: 40, gap: 10 },
  lg: { padding: 64, gap: 14 },
};

export function EmptyState({
  icon,
  title,
  body,
  action,
  size = "md",
  className,
  style,
}: EmptyStateProps) {
  const { padding, gap } = SIZE[size];
  return (
    <div
      className={className}
      style={{
        padding,
        textAlign: "center",
        display: "grid",
        gap,
        justifyItems: "center",
        color: "var(--fg-3)",
        ...style,
      }}
    >
      {icon && (
        <span
          aria-hidden="true"
          style={{
            color: "var(--fg-4)",
            opacity: 0.7,
            display: "inline-flex",
            marginBottom: 2,
          }}
        >
          {icon}
        </span>
      )}
      {title && (
        <div
          style={{
            fontSize: size === "lg" ? "var(--fs-h4)" : "var(--fs-body)",
            fontWeight: 600,
            color: "var(--fg-1)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
      )}
      {body && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-small)",
            color: "var(--fg-3)",
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}

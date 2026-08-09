import React, { type CSSProperties } from "react";
import { LoadingDots } from "./loading-dots";

/* ------------------------------------------------------------------ */
/*  Status Badge                                                      */
/* ------------------------------------------------------------------ */

export type BadgeStatus =
  | "draft"
  | "scheduled"
  | "uploading"
  | "publishing"
  | "published"
  | "partial_success"
  | "failed";

interface StatusTokens {
  bg: string;
  fg: string;
  dot: string;
  pulse?: boolean;
}

const STATUS_MAP: Record<BadgeStatus, StatusTokens> = {
  draft: {
    bg: "var(--warm-150)",
    fg: "var(--warm-700)",
    dot: "var(--warm-500)",
  },
  scheduled: {
    bg: "var(--grape-50)",
    fg: "var(--grape-700)",
    dot: "var(--grape-500)",
  },
  uploading: {
    bg: "var(--sky-50, var(--grape-50))",
    fg: "var(--sky-700, var(--grape-700))",
    dot: "var(--sky-500, var(--grape-500))",
    pulse: true,
  },
  publishing: {
    bg: "var(--sun-50)",
    fg: "var(--sun-700)",
    dot: "var(--sun-500)",
    pulse: true,
  },
  published: {
    bg: "var(--leaf-50)",
    fg: "var(--leaf-700)",
    dot: "var(--leaf-500)",
  },
  partial_success: {
    bg: "var(--sun-50)",
    fg: "var(--sun-700)",
    dot: "var(--sun-500)",
  },
  failed: {
    bg: "var(--ruby-50)",
    fg: "var(--ruby-700)",
    dot: "var(--ruby-500)",
  },
};

const LABELS: Record<BadgeStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  uploading: "Uploading",
  publishing: "Publishing",
  published: "Published",
  partial_success: "Partial",
  failed: "Failed",
};

export interface BadgeProps {
  status: BadgeStatus;
  className?: string;
  style?: CSSProperties;
}

export function Badge({ status, className, style: styleProp }: BadgeProps) {
  const t = STATUS_MAP[status];

  const rootStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: 22,
    paddingInline: 8,
    borderRadius: 999,
    background: t.bg,
    color: t.fg,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
    ...styleProp,
  };

  const dotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: t.dot,
    flexShrink: 0,
    ...(t.pulse
      ? { animation: "aooPulse 1.4s ease-in-out infinite" }
      : {}),
  };

  // In-progress states get an animated ellipsis after the label
  // (Uploading… / Publishing…) so the row reads as actively working.
  const inProgress = status === "uploading" || status === "publishing";

  return (
    <span className={className} style={rootStyle}>
      <span style={dotStyle} />
      {LABELS[status]}
      {inProgress && <LoadingDots color={t.fg} size={3} />}
    </span>
  );
}

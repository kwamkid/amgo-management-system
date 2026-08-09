import React, { type CSSProperties, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";

/* ==========================================================================
 *  Alert — colored callout box
 *
 *  Replaces the ~15+ inline "ruby-50 + ruby-100 border + ruby-700 text"
 *  blocks scattered across settings, ads, and posts pages. One component,
 *  four tones, identical geometry — so a tweak to padding/border-radius
 *  doesn't have to be applied in 15 places by hand.
 *
 *  Tones map to the existing palette (matches Badge tones):
 *    - info     → warm/neutral (default)
 *    - success  → leaf (publish confirmations, healthy state)
 *    - warning  → sun (deprecation notices, soft warnings)
 *    - error    → ruby (failed actions, validation errors)
 *
 *  Usage:
 *    <Alert tone="error">บันทึกไม่สำเร็จ — {error}</Alert>
 *    <Alert tone="warning" title="กำลังจะหมดอายุ">รีเฟรช token ภายใน 7 วัน</Alert>
 *
 *  The icon is auto-chosen per tone but can be hidden via `hideIcon` for
 *  ultra-compact callers. Pass `compact` for a slimmer pad (8px vs 12px)
 *  used inside dense forms.
 * ========================================================================== */

export type AlertTone = "info" | "success" | "warning" | "error";

export interface AlertProps {
  tone?: AlertTone;
  /** Bold label shown above the body. Optional. */
  title?: ReactNode;
  /** Main body content. */
  children?: ReactNode;
  /** Hide the leading icon. Default: false. */
  hideIcon?: boolean;
  /** Slim padding for dense forms (8px instead of 12px). */
  compact?: boolean;
  /** Optional inline action(s) at the right end (link/button). */
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const TONE_STYLES: Record<
  AlertTone,
  { bg: string; border: string; fg: string; Icon: React.FC<{ size: number }> }
> = {
  info: {
    bg: "var(--warm-100)",
    border: "var(--border-1)",
    fg: "var(--fg-2)",
    Icon: Info,
  },
  success: {
    bg: "var(--leaf-50)",
    border: "var(--leaf-100)",
    fg: "var(--leaf-700)",
    Icon: CheckCircle2,
  },
  warning: {
    bg: "var(--sun-50)",
    border: "var(--sun-100)",
    fg: "var(--sun-700)",
    Icon: AlertTriangle,
  },
  error: {
    bg: "var(--ruby-50)",
    border: "var(--ruby-100)",
    fg: "var(--ruby-700)",
    Icon: AlertCircle,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  hideIcon = false,
  compact = false,
  action,
  className,
  style,
}: AlertProps) {
  const t = TONE_STYLES[tone];
  const Icon = t.Icon;

  return (
    <div
      role="alert"
      className={className}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: compact ? "8px 10px" : "12px 14px",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--r-md)",
        color: t.fg,
        fontSize: "var(--fs-small)",
        lineHeight: 1.5,
        ...style,
      }}
    >
      {!hideIcon && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            flexShrink: 0,
            // Nudge down ½ line so the icon optically centers with text
            // when there's no title; with a title it lands on the title row.
            marginTop: title ? 2 : 1,
          }}
        >
          <Icon size={16} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontWeight: 700,
              marginBottom: children ? 4 : 0,
            }}
          >
            {title}
          </div>
        )}
        {children}
      </div>
      {action && (
        <div style={{ flexShrink: 0, marginLeft: 4 }}>{action}</div>
      )}
    </div>
  );
}

/** Compact inline error message — convenience wrapper around Alert. */
export function ErrorAlert({
  children,
  ...rest
}: Omit<AlertProps, "tone">) {
  return (
    <Alert tone="error" {...rest}>
      {children}
    </Alert>
  );
}

// Silence: XCircle is imported above for future use as an alternate error
// icon (e.g. when paired with a dismiss button) — keep the import warm so
// adding the variant doesn't require touching imports again.
void XCircle;

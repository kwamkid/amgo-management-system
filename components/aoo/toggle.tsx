"use client";

import React, { type CSSProperties } from "react";

export interface ToggleProps {
  /** Current state. */
  checked: boolean;
  /** Called when the user clicks the toggle. */
  onChange?: (next: boolean) => void;
  /** Disabled — no clicks, muted colors. */
  disabled?: boolean;
  /** Loading — shows a spinner inside the knob and ignores clicks. */
  loading?: boolean;
  /** Tooltip text. */
  title?: string;
  /** Accessibility label (for screen readers). */
  "aria-label"?: string;
  /** Visual size. Default "md". */
  size?: "sm" | "md";
  /** Optional style escape hatch. */
  style?: CSSProperties;
}

/**
 * iOS-style on/off toggle switch. Matches the Facebook Ads Manager
 * On/Off control. Always pair with a server action that owns the source
 * of truth — never use this as uncontrolled state for a remote object.
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  loading = false,
  title,
  "aria-label": ariaLabel,
  size = "md",
  style,
}: ToggleProps) {
  const w = size === "sm" ? 32 : 40;
  const h = size === "sm" ? 18 : 22;
  const knob = size === "sm" ? 14 : 18;
  const offset = 2;

  const handleClick = () => {
    if (disabled || loading) return;
    onChange?.(!checked);
  };

  const bg = disabled
    ? "var(--border-1)"
    : checked
      ? "var(--accent)"
      : "var(--warm-300)";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (checked ? "On" : "Off")}
      title={title}
      onClick={handleClick}
      disabled={disabled || loading}
      style={{
        position: "relative",
        width: w,
        height: h,
        background: bg,
        border: "none",
        borderRadius: h,
        cursor: disabled || loading ? "default" : "pointer",
        padding: 0,
        transition: "background 150ms ease",
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: offset,
          left: checked ? w - knob - offset : offset,
          width: knob,
          height: knob,
          background: "#fff",
          borderRadius: "50%",
          transition: "left 150ms ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading && (
          <span
            style={{
              width: knob * 0.55,
              height: knob * 0.55,
              border: "1.5px solid var(--fg-3)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "aoo-toggle-spin 0.6s linear infinite",
            }}
          />
        )}
      </span>
      <style jsx>{`
        @keyframes aoo-toggle-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
}

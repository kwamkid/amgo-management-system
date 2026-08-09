"use client";

import React, { type CSSProperties } from "react";

export interface CheckboxProps {
  /** Current state. */
  checked: boolean;
  /** Fires with the next checked value. Omit for a read-only/display box. */
  onChange?: (next: boolean) => void;
  /** Passthrough click handler — use for `e.stopPropagation()` when the box
   *  sits inside a separately-clickable row. */
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  /** Disabled — no clicks, muted + not-allowed cursor. */
  disabled?: boolean;
  /** form field name (for uncontrolled native submit when used in a <form>). */
  name?: string;
  /** Visual box size in px. Default 16. */
  size?: number;
  /** Accessibility label. */
  "aria-label"?: string;
  title?: string;
  /** Escape hatch for layout (margin etc.) — avoid restyling the box itself. */
  style?: CSSProperties;
}

/**
 * Shared checkbox primitive. Replaces the hand-rolled `<input type="checkbox">`
 * blocks scattered across dialogs + override grids so the box style (size,
 * accent, disabled cursor) lives in ONE place. Uses the native input with
 * `accentColor` so it stays accessible + form-submittable; the only styling is
 * size + cursor, driven by tokens.
 *
 * For an on/off SETTING use <Toggle>; this is for multi-select / "tick to
 * include" lists where a checkbox is the right affordance.
 */
export function Checkbox({
  checked,
  onChange,
  onClick,
  disabled = false,
  name,
  size = 16,
  "aria-label": ariaLabel,
  title,
  style,
}: CheckboxProps) {
  return (
    <input
      type="checkbox"
      name={name}
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      onChange={(e) => onChange?.(e.target.checked)}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        accentColor: "var(--accent)",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    />
  );
}

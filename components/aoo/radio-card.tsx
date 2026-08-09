"use client";

import React, { type CSSProperties } from "react";

export interface RadioCardOption {
  value: string;
  label: React.ReactNode;
  /** Secondary line under the label. */
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioCardGroupProps {
  /** Submitted field name — each card renders a native `<input type="radio">`
   *  with this name, so the group works in a plain `<form>` submit. */
  name: string;
  options: RadioCardOption[];
  /** Controlled selection. Omit + pass `defaultValue` for uncontrolled. */
  value?: string;
  /** Uncontrolled initial selection. */
  defaultValue?: string;
  /** Fires with the newly-selected value (controlled usage). */
  onChange?: (value: string) => void;
  /** Layout gap between cards. Default 8. */
  gap?: number;
  /** Lay the cards out in this many equal columns instead of a vertical stack.
   *  e.g. columns={2} puts two cards side-by-side on one row. Default: 1 (stack). */
  columns?: number;
  style?: CSSProperties;
}

/**
 * Vertical stack of selectable cards backed by native radios. Replaces the
 * hand-rolled `<label style={radioCardStyle}><input type=radio>…` blocks
 * (onboarding package picker, profile theme picker) so the card chrome +
 * selected-state highlight (accent border + soft fill) live in ONE place.
 *
 * Works controlled (`value` + `onChange`) OR uncontrolled (`defaultValue`,
 * native form submit). Selected highlight is CSS-driven via `:has()` for the
 * uncontrolled case and the `value` prop for the controlled case.
 */
export function RadioCardGroup({
  name,
  options,
  value,
  defaultValue,
  onChange,
  gap = 8,
  columns = 1,
  style,
}: RadioCardGroupProps) {
  // Controlled = the caller drives selection via onChange (NOT "value is
  // currently set"). A controlled group can legitimately start with NO
  // selection (value === undefined) — e.g. TikTok privacy, which forbids a
  // default. Deriving `controlled` from `value !== undefined` made such a
  // group fall back to uncontrolled: onChange was never attached, so the first
  // click only lit the native radio (CSS) and never updated React state, and
  // the group stayed stuck unselected forever. Tie it to onChange instead, so
  // an uncontrolled group is strictly one using `defaultValue` with no
  // onChange. (Passing both value and onChange remains the controlled path.)
  const controlled = onChange !== undefined || value !== undefined;

  return (
    <div
      role="radiogroup"
      // Controlled groups highlight via data-selected ONLY (single source of
      // truth). Without this marker the CSS also lit whichever card had a
      // :checked native radio — and React's controlled radios don't reliably
      // keep the DOM :checked in sync when only `checked` flips, so the OLD
      // card could stay highlighted (theme picker stuck on "System" after
      // choosing "Light"). The CSS scopes :has(:checked) to NON-controlled.
      data-controlled={controlled ? "true" : undefined}
      style={{
        display: "grid",
        gap,
        gridTemplateColumns:
          columns > 1 ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
        ...style,
      }}
    >
      {options.map((opt) => {
        const selected = controlled ? value === opt.value : undefined;
        return (
          <label
            key={opt.value}
            className="aoo-radio-card"
            data-selected={selected ? "true" : undefined}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: 12,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border-1)",
              background: "var(--bg-app)",
              cursor: opt.disabled ? "not-allowed" : "pointer",
              opacity: opt.disabled ? 0.55 : 1,
              transition:
                "border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
            }}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              disabled={opt.disabled}
              {...(controlled
                ? {
                    checked: value === opt.value,
                    onChange: () => onChange?.(opt.value),
                  }
                : { defaultChecked: defaultValue === opt.value })}
              style={{ marginTop: 2, accentColor: "var(--accent)" }}
            />
            <div style={{ minWidth: 0 }}>
              <div className="t-body-strong">{opt.label}</div>
              {opt.description != null && (
                <div className="t-small">{opt.description}</div>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}

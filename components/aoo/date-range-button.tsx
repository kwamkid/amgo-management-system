"use client";

import { useRef, useState } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import {
  DateRangePicker,
  type DateRangeValue,
} from "./date-range-picker";

/**
 * `<DateRangeButton>` — compact trigger that opens `<DateRangePicker>`.
 *
 * Use this on filter bars where the previous pattern was a pair of
 * `<input type="date">` boxes joined by a "to" word. The button keeps the
 * filter bar narrow (one chip-shaped control instead of two date inputs
 * + a separator) and the picker UX is consistent with the date filter
 * elsewhere in the app.
 *
 * Value is the SAME shape as `<DateRangePicker>` — `{ since, until }` ISO
 * dates, or `null` when no range is selected.
 *
 * Clearing: when a range is set, an "x" icon appears inside the button.
 * Clicking it (stopping propagation so the popover doesn't open) calls
 * `onChange(null)`.
 */
export interface DateRangeButtonProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  /** Placeholder shown when no range is selected. Defaults to Thai
   *  "เลือกช่วงวันที่". */
  placeholder?: string;
  disabled?: boolean;
  /** Optional accessibility label for the trigger; defaults to the
   *  placeholder. */
  "aria-label"?: string;
  /** Forwarded to the trigger button so callers can size it
   *  consistently with sibling filter controls. */
  style?: React.CSSProperties;
  /** Forwarded to the underlying picker. */
  maxDate?: Date;
  minDate?: Date;
}

export function DateRangeButton({
  value,
  onChange,
  placeholder,
  disabled,
  style,
  maxDate,
  minDate,
  ...aria
}: DateRangeButtonProps) {
  // ภาษาไทยล้วน ไม่ได้ใช้ i18n
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const resolvedPlaceholder = placeholder ?? "เลือกช่วงวันที่";
  const hasValue = value !== null;
  const label = hasValue ? `${formatDay(value.since)} → ${formatDay(value.until)}` : resolvedPlaceholder;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={aria["aria-label"] ?? resolvedPlaceholder}
        data-button-fx="secondary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: open ? "var(--bg-sunken)" : "transparent",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--r-md)",
          color: hasValue ? "var(--fg-2)" : "var(--fg-3)",
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          ...style,
        }}
      >
        <Calendar size={14} style={{ color: "var(--fg-3)", flexShrink: 0 }} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {label}
        </span>
        {hasValue ? (
          // Clear affordance — replaces the chevron when a range is set.
          <span
            role="button"
            tabIndex={-1}
            aria-label="ล้างช่วงวันที่"
            title="ล้างช่วงวันที่"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 16,
              height: 16,
              borderRadius: "50%",
              color: "var(--fg-3)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLSpanElement).style.background =
                "var(--bg-sunken)";
              (e.currentTarget as HTMLSpanElement).style.color = "var(--fg-1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLSpanElement).style.background =
                "transparent";
              (e.currentTarget as HTMLSpanElement).style.color = "var(--fg-3)";
            }}
          >
            <X size={11} />
          </span>
        ) : (
          <ChevronDown size={14} style={{ color: "var(--fg-3)", flexShrink: 0 }} />
        )}
      </button>

      <DateRangePicker
        open={open}
        anchorEl={triggerRef.current}
        value={value}
        onApply={(range) => {
          onChange(range);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        maxDate={maxDate}
        minDate={minDate}
      />
    </>
  );
}

function formatDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

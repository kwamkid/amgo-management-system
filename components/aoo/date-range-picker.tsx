"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { Z } from './z-layers'

/**
 * `<DateRangePicker>` — calendar-based custom date range selector.
 *
 * Renders two months side-by-side (current + previous) by default. User
 * clicks a day to set the range start, clicks another to set the end. A
 * highlight band visually connects the two while hovering over candidate
 * end-dates so the range is obvious before committing.
 *
 * Mobile (< 640 px) collapses to one month at a time with arrows to
 * paginate. Apply/Cancel pinned at the bottom — selection isn't
 * committed until Apply.
 *
 * Anchored to `anchorEl` (the element that opened the picker) via a
 * portal, so it escapes table cells / cards that clip overflow.
 *
 * Date values are passed/returned as `YYYY-MM-DD` ISO strings (no time,
 * no timezone) — what Meta's `time_range` API expects.
 */
export type DateRangeValue = { since: string; until: string } | null;

export interface DateRangePickerProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  /** Initial range. `null` = nothing selected; picker still opens on
   *  the previous-month / current-month pair. */
  value: DateRangeValue;
  /** Called when the user clicks Apply with a valid range. */
  onApply: (range: { since: string; until: string }) => void;
  /** Called on Cancel / Esc / backdrop click. */
  onClose: () => void;
  /** Latest selectable day — defaults to today. Most analytics use
   *  cases don't want users picking future dates. */
  maxDate?: Date;
  /** Earliest selectable day — useful when an upstream API has a
   *  hard floor (e.g. Meta Insights goes back ~37 months). */
  minDate?: Date;
}

export function DateRangePicker({
  open,
  anchorEl,
  value,
  onApply,
  onClose,
  maxDate = new Date(),
  minDate,
}: DateRangePickerProps) {
  // ภาษาไทยล้วน ไม่ได้ใช้ i18n
  // The two-state range: `start` is set on first click, `end` on second.
  // Hovering between clicks updates `hoveredEnd` so the highlight band
  // tracks the cursor.
  const initial = useMemo(() => parseRangeValue(value), [value]);
  const [start, setStart] = useState<Date | null>(initial.start);
  const [end, setEnd] = useState<Date | null>(initial.end);
  const [hoveredEnd, setHoveredEnd] = useState<Date | null>(null);

  // Re-sync on open if the prop changed externally (e.g. user opened
  // the picker, applied a date, then opened it again — the previously
  // applied range should be the starting point).
  useEffect(() => {
    if (!open) return;
    setStart(initial.start);
    setEnd(initial.end);
    setHoveredEnd(null);
  }, [open, initial.start, initial.end]);

  // Anchor the picker to the calling button. `viewMonth` is the LEFT
  // month shown (the right month is +1). Initialised to "last month"
  // so the current month is on the right — matches most date-range
  // picker UX (Linear, Notion, Stripe).
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const anchor = initial.end ?? initial.start ?? new Date();
    return startOfMonth(addMonths(anchor, -1));
  });

  // Portal position (mirrors DatePresetMenu / ActionMenu pattern).
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Narrow viewport → one month visible (paginated by ChevronLeft/Right).
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = () => setIsNarrow(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;
    function reposition() {
      const rect = anchorEl!.getBoundingClientRect();
      const m = pickerRef.current;
      const menuWidth = m?.offsetWidth ?? (isNarrow ? 280 : 560);
      const menuHeight = m?.offsetHeight ?? 360;
      const pad = 8;

      let left = rect.left;
      if (left + menuWidth > window.innerWidth - pad) {
        left = Math.max(pad, window.innerWidth - menuWidth - pad);
      }
      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight - pad) {
        // Flip above
        top = Math.max(pad, rect.top - menuHeight - 4);
      }
      setPos({ top, left });
    }
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, anchorEl, isNarrow]);

  // Click-outside + Esc to close. Pointer events let us catch touch + mouse.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (pickerRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorEl]);

  // --- Selection logic ----------------------------------------------------
  const handleDayClick = useCallback(
    (day: Date) => {
      if (!start || (start && end)) {
        // Fresh selection — set start, clear end
        setStart(day);
        setEnd(null);
        setHoveredEnd(null);
        return;
      }
      // start is set, end is null → set the second endpoint.
      // Normalise so end >= start.
      if (day < start) {
        setEnd(start);
        setStart(day);
      } else {
        setEnd(day);
      }
      setHoveredEnd(null);
    },
    [start, end],
  );

  // The effective end-of-range while hovering pre-commit — drives the
  // highlight band so users see what they're about to select.
  const previewEnd = end ?? hoveredEnd;

  const canApply = !!start && !!end;
  const handleApply = () => {
    if (!start || !end) return;
    onApply({ since: toIsoDate(start), until: toIsoDate(end) });
  };

  // Month navigation
  const goPrev = () => setViewMonth((m) => addMonths(m, -1));
  const goNext = () => setViewMonth((m) => addMonths(m, 1));
  const leftMonth = viewMonth;
  const rightMonth = addMonths(viewMonth, 1);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="เลือกช่วงวันที่"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: Z.dropdownInModal,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-md)",
        padding: 12,
        width: isNarrow ? 280 : 560,
        maxWidth: "calc(100vw - 16px)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        visibility: pos ? "visible" : "hidden",
        animation: "aooDropdownIn 120ms var(--ease-out)",
      }}
    >
      {/* Range summary + month nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingBottom: 8,
          borderBottom: "1px solid var(--border-1)",
        }}
      >
        <button
          type="button"
          onClick={goPrev}
          aria-label="เดือนก่อนหน้า"
          style={navBtnStyle}
        >
          <ChevronLeft size={14} />
        </button>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 13,
            color: "var(--fg-2)",
            fontWeight: 500,
          }}
        >
          {formatRangeSummary(start, previewEnd)}
        </div>
        <button
          type="button"
          onClick={goNext}
          aria-label="เดือนถัดไป"
          style={navBtnStyle}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Months */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
          gap: 16,
        }}
      >
        <MonthGrid
          month={leftMonth}
          start={start}
          previewEnd={previewEnd}
          maxDate={maxDate}
          minDate={minDate}
          onDayClick={handleDayClick}
          onDayHover={(d) => start && !end && setHoveredEnd(d)}
        />
        {!isNarrow && (
          <MonthGrid
            month={rightMonth}
            start={start}
            previewEnd={previewEnd}
            maxDate={maxDate}
            minDate={minDate}
            onDayClick={handleDayClick}
            onDayHover={(d) => start && !end && setHoveredEnd(d)}
          />
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--border-1)",
        }}
      >
        <Button variant="ghost" size="sm" onClick={onClose}>
          {"ยกเลิก"}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!canApply}
          onClick={handleApply}
        >
          {"ตกลง"}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/*  MonthGrid — one calendar month                                     */
/* ------------------------------------------------------------------ */

function MonthGrid({
  month,
  start,
  previewEnd,
  maxDate,
  minDate,
  onDayClick,
  onDayHover,
}: {
  month: Date;
  start: Date | null;
  previewEnd: Date | null;
  maxDate?: Date;
  minDate?: Date;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date) => void;
}) {
  const monthLabel = month.toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  });
  const days = buildMonthDays(month);

  // Effective range bounds (sorted) for highlight calculation.
  const [rangeLow, rangeHigh] = useMemo(() => {
    if (!start) return [null, null] as [Date | null, Date | null];
    if (!previewEnd) return [start, start];
    return start <= previewEnd ? [start, previewEnd] : [previewEnd, start];
  }, [start, previewEnd]);

  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--fg-1)",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        {monthLabel}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
          fontSize: 11,
          color: "var(--fg-4)",
          marginBottom: 4,
        }}
      >
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: "center", padding: "2px 0" }}>
            {w}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
        }}
      >
        {days.map((d, i) => {
          if (!d) return <div key={i} aria-hidden="true" />;
          const isStart = !!start && sameDay(d, start);
          const isEnd = !!previewEnd && !!start && sameDay(d, previewEnd) && !sameDay(d, start);
          const inRange =
            !!rangeLow &&
            !!rangeHigh &&
            d >= rangeLow &&
            d <= rangeHigh &&
            !isStart &&
            !isEnd;
          const isOutOfBounds =
            (maxDate && d > stripTime(maxDate)) ||
            (minDate && d < stripTime(minDate));
          const isToday = sameDay(d, new Date());

          // Selection bar styling — the start and end have a solid
          // accent pill; intermediate days share a softer band so the
          // run-of-dates reads as a unit.
          const background = isStart || isEnd
            ? "var(--accent)"
            : inRange
              ? "color-mix(in srgb, var(--accent) 18%, transparent)"
              : "transparent";
          const color = isStart || isEnd
            ? "var(--fg-on-brand)"
            : isOutOfBounds
              ? "var(--fg-4)"
              : "var(--fg-1)";

          return (
            <button
              key={i}
              type="button"
              disabled={isOutOfBounds}
              onClick={() => onDayClick(d)}
              onMouseEnter={() => onDayHover(d)}
              style={{
                aspectRatio: "1 / 1",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: isToday && !isStart && !isEnd
                  ? "1px solid var(--accent)"
                  : "1px solid transparent",
                borderRadius: "var(--r-sm)",
                background,
                color,
                fontSize: 12,
                fontWeight: isStart || isEnd ? 600 : 500,
                fontFamily: "var(--font-sans)",
                cursor: isOutOfBounds ? "not-allowed" : "pointer",
                opacity: isOutOfBounds ? 0.4 : 1,
                transition: "background var(--dur-fast) var(--ease-out)",
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function parseRangeValue(v: DateRangeValue): { start: Date | null; end: Date | null } {
  if (!v) return { start: null, end: null };
  return { start: fromIsoDate(v.since), end: fromIsoDate(v.until) };
}

function fromIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Build the calendar grid for `month`. Returns 42 cells (6 weeks);
 *  blanks before day 1 / after the last day are `null`. Starts on Sunday. */
function buildMonthDays(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const padLeft = first.getDay(); // Sun = 0
  const totalCells = 42; // 6 rows × 7
  const cells: (Date | null)[] = [];
  for (let i = 0; i < padLeft; i++) cells.push(null);
  for (let i = 1; i <= last.getDate(); i++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), i));
  }
  while (cells.length < totalCells) cells.push(null);
  return cells;
}

function formatRangeSummary(start: Date | null, end: Date | null): string {
  if (!start) return "เลือกวันเริ่มต้น";
  if (!end) return `${formatDay(start)} → เลือกวันสิ้นสุด`;
  return `${formatDay(start)} → ${formatDay(end)}`;
}

/** รูปแบบวันที่ไทย — ปี พ.ศ. ตามที่คนไทยใช้จริง (th-TH ใช้ปฏิทินพุทธเป็นค่าเริ่มต้น) */
export function formatDay(d: Date): string {
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const navBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  background: "transparent",
  border: "1px solid var(--border-1)",
  borderRadius: "var(--r-sm)",
  color: "var(--fg-2)",
  cursor: "pointer",
} as const;

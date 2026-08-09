"use client";

// components/aoo/date-picker.tsx
//
// เลือกวันเดียว — ใช้แทน <input type="date"> ของเบราว์เซอร์ทั้งระบบ
//
// ทำไมต้องมี: input type="date" หน้าตาไม่เหมือนกันเลยในแต่ละเบราว์เซอร์/ระบบ
// ปฏิทินที่เด้งขึ้นมาเป็นของ OS แสดงเป็นภาษาอังกฤษ ค.ศ. และไม่รับสไตล์เรา
// (Chrome ขึ้น "August 2026" ปนกับหน้าจอไทยทั้งหน้า)
//
// ตัวนี้ใช้ปฏิทินตัวเดียวกับ DateRangePicker แต่เลือกได้วันเดียว
// แสดงผลเป็น พ.ศ. ส่วนค่าที่ส่งออกยังเป็น YYYY-MM-DD (ค.ศ.) เหมือนเดิม

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export interface DatePickerProps {
  /** YYYY-MM-DD (ค.ศ.) */
  value: string;
  onChange: (value: string) => void;
  /** จำกัดไม่ให้เลือกเกินวันนี้ ฯลฯ — YYYY-MM-DD */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "เลือกวันที่",
  disabled,
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(parseIso(value) ?? new Date()));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const selected = parseIso(value);

  useEffect(() => {
    if (open && selected) setMonth(startOfMonth(selected));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // วางปฏิทินใต้ปุ่ม — ใช้ portal เพื่อไม่ให้โดน overflow ของ card ตัดหาย
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = 300;
    setPos({
      top: r.bottom + 6,
      left: Math.min(r.left, window.innerWidth - width - 12),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // หน่วง 1 tick ไม่งั้นคลิกที่เปิดเมนูจะปิดทันที
    const t = setTimeout(() => document.addEventListener("mousedown", close), 0);
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const days = useMemo(() => buildMonthDays(month), [month]);
  const minD = parseIso(min);
  const maxD = parseIso(max);

  const outOfRange = (d: Date) =>
    (minD ? stripTime(d) < stripTime(minD) : false) ||
    (maxD ? stripTime(d) > stripTime(maxD) : false);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors hover:border-gray-300 focus:border-red-400 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 ${className}`}
      >
        <CalendarIcon size={15} className="shrink-0 text-gray-400" />
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ? formatThai(selected) : placeholder}
        </span>
      </button>

      {open && pos &&
        createPortal(
          <div
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 300, zIndex: 70 }}
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="เดือนก่อนหน้า"
                onClick={() => setMonth(addMonths(month, -1))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-sm font-semibold text-gray-900">
                {MONTHS_TH[month.getMonth()]} {month.getFullYear() + 543}
              </div>
              <button
                type="button"
                aria-label="เดือนถัดไป"
                onClick={() => setMonth(addMonths(month, 1))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-xs font-medium text-gray-400">
                  {w}
                </div>
              ))}

              {days.map((d, i) => {
                if (!d) return <div key={i} />;
                const isSelected = selected ? sameDay(d, selected) : false;
                const isToday = sameDay(d, new Date());
                const blocked = outOfRange(d);

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      onChange(toIso(d));
                      setOpen(false);
                    }}
                    className={[
                      "h-9 rounded-lg text-sm transition-colors",
                      blocked
                        ? "cursor-not-allowed text-gray-300"
                        : isSelected
                          ? "bg-red-500 font-semibold text-white"
                          : isToday
                            ? "bg-red-50 font-semibold text-red-600 hover:bg-red-100"
                            : "text-gray-700 hover:bg-gray-100",
                    ].join(" ")}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex justify-end border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  if (!outOfRange(today)) {
                    onChange(toIso(today));
                    setOpen(false);
                  }
                }}
                className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                วันนี้
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/* ── ตัวช่วยวันที่ ─────────────────────────────────────────────────── */

function parseIso(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ต้องประกอบเอง ห้ามใช้ toISOString() — มันแปลงเป็น UTC แล้ววันเพี้ยน */
export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatThai(d: Date): string {
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
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

function buildMonthDays(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const out: (Date | null)[] = Array(first.getDay()).fill(null);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let i = 1; i <= last; i++) {
    out.push(new Date(month.getFullYear(), month.getMonth(), i));
  }
  return out;
}

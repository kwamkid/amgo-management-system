"use client";

import React, { type CSSProperties } from "react";
import { IconButton } from "./button";
import { useMediaQuery } from "@/lib/use-media-query";

/* ==========================================================================
 *  Pagination — page-number control for server-driven lists
 *
 *  Prev / 1 … 4 [5] 6 … 20 / Next. Renders nothing when there's a single
 *  page. On narrow viewports it collapses to Prev / "X / Y" / Next (no number
 *  row). Page numbers are 1-based. Stateless — the parent owns the current
 *  page (usually from a URL param) and navigates in onPageChange.
 * ========================================================================== */

export interface PaginationProps {
  /** 1-based current page. */
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Pages shown on each side of the current one before collapsing. Default 1. */
  siblingCount?: number;
  /** Disable all controls (e.g. during a pending transition). */
  disabled?: boolean;
  style?: CSSProperties;
}

/** Build the list of page tokens: numbers + "ellipsis" gaps. Always shows
 *  page 1 and the last page. */
function buildPages(
  current: number,
  count: number,
  siblings: number,
): (number | "…")[] {
  const total = siblings * 2 + 5; // first, last, current, 2 ellipses, siblings
  if (count <= total) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, count);
  const showLeftDots = left > 2;
  const showRightDots = right < count - 1;
  const pages: (number | "…")[] = [1];
  if (showLeftDots) pages.push("…");
  for (let p = showLeftDots ? left : 2; p <= (showRightDots ? right : count - 1); p++) {
    pages.push(p);
  }
  if (showRightDots) pages.push("…");
  pages.push(count);
  return pages;
}

export function Pagination({
  currentPage,
  pageCount,
  onPageChange,
  siblingCount = 1,
  disabled = false,
  style,
}: PaginationProps) {
  // โปรเจกต์นี้ภาษาไทยอย่างเดียว ไม่ได้ใช้ i18n
  const compact = useMediaQuery("(max-width: 639px)");
  if (pageCount <= 1) return null;

  const go = (p: number) => {
    if (disabled) return;
    const clamped = Math.min(Math.max(p, 1), pageCount);
    if (clamped !== currentPage) onPageChange(clamped);
  };

  const wrap: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "12px 0",
    ...style,
  };

  const pageBtn = (active: boolean): CSSProperties => ({
    minWidth: 32,
    height: 32,
    padding: "0 8px",
    border: `1px solid ${active ? "var(--accent)" : "var(--border-1)"}`,
    borderRadius: "var(--r-md)",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "var(--fg-on-brand, #fff)" : "var(--fg-2)",
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    cursor: active || disabled ? "default" : "pointer",
  });

  return (
    <div style={wrap}>
      <IconButton
        icon="ChevronLeft"
        title={"ก่อนหน้า"}
        size={32}
        disabled={disabled || currentPage <= 1}
        onClick={() => go(currentPage - 1)}
      />

      {compact ? (
        <span
          style={{
            padding: "0 10px",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--fg-3)",
          }}
        >
          {currentPage} / {pageCount}
        </span>
      ) : (
        buildPages(currentPage, pageCount, siblingCount).map((p, i) =>
          p === "…" ? (
            <span
              key={`dots-${i}`}
              style={{
                minWidth: 24,
                textAlign: "center",
                color: "var(--fg-4)",
                fontSize: 13,
              }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === currentPage ? "page" : undefined}
              onClick={() => go(p)}
              disabled={disabled}
              style={pageBtn(p === currentPage)}
            >
              {p}
            </button>
          ),
        )
      )}

      <IconButton
        icon="ChevronRight"
        title={"ถัดไป"}
        size={32}
        disabled={disabled || currentPage >= pageCount}
        onClick={() => go(currentPage + 1)}
      />
    </div>
  );
}

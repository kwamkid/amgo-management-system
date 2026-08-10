"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Z } from './z-layers'

/* ========================================================================== */
/*  <Popover/> — shared floating menu primitive                                */
/*                                                                            */
/*  Use for click-triggered dropdowns where the menu body is custom content   */
/*  (avatar + handle, multi-select rows, ad-hoc forms). For lists of simple   */
/*  label-and-action rows, prefer <ActionMenu/> — it composes Popover with    */
/*  the row UI baked in.                                                      */
/*                                                                            */
/*  Why this exists                                                           */
/*  ----------------------------------------------------------------------    */
/*  Every page that needed a dropdown was reinventing: positioning,           */
/*  outside-click dismiss, Escape, viewport clamping, portal-vs-inline,       */
/*  and surface tokens. The recurring bug was inconsistent background —       */
/*  half the dropdowns used `var(--bg-card)` (undefined → transparent) and    */
/*  half used `var(--bg-surface)` (defined). Centralising the surface here    */
/*  fixes all of them at once.                                                */
/*                                                                            */
/*  Behaviour                                                                 */
/*  ----------------------------------------------------------------------    */
/*   - Portal to document.body so the menu can escape ancestors with          */
/*     `overflow: hidden` (table cells, scrolling cards).                     */
/*   - Position: fixed in viewport coords, repositioned on scroll/resize so   */
/*     it follows the anchor as the page moves.                               */
/*   - Outside pointerdown + Escape close the menu.                           */
/*   - Vertical fallback: if the menu would overflow the bottom of the        */
/*     viewport, flip above the anchor.                                       */
/*   - Horizontal align: "start" (left edge of menu = left edge of anchor)    */
/*     or "end" (right edge = right edge of anchor).                          */
/*                                                                            */
/*  What this is NOT                                                          */
/*   - Not a hover popover. Hover-popovers need mouse-bridge handling that    */
/*     this primitive doesn't model. CaptionCell (analytics + posts) keeps    */
/*     its own hover implementation.                                          */
/*   - Not a modal. Modals trap focus + render a scrim — use <Modal/>.        */
/* ========================================================================== */

export interface PopoverProps {
  /** Controlled open state. */
  open: boolean;
  /** Called when the user dismisses (outside click, Escape). */
  onClose: () => void;
  /**
   * Anchor element. We read its bounding box to position the menu. Pass
   * the `current` of a ref pointing at your trigger button (or the
   * trigger button itself, if you have it).
   */
  anchor: HTMLElement | null;
  /** Menu body. Whatever you want inside the surface. */
  children: ReactNode;
  /** Horizontal alignment — default "start" (left edges align). */
  align?: "start" | "end";
  /** Minimum width in px. Default 220. */
  minWidth?: number;
  /** Maximum height in px before the inner content scrolls. Default 360. */
  maxHeight?: number;
  /** Internal padding inside the surface. Default 4. */
  padding?: number;
  /** ARIA label for the floating surface. */
  ariaLabel?: string;
  /** Extra style merged onto the surface. */
  style?: CSSProperties;
  /** z-index, default 300 — same as ActionMenu. */
  zIndex?: number;
}

export function Popover({
  open,
  onClose,
  anchor,
  children,
  align = "start",
  minWidth = 220,
  maxHeight = 360,
  padding = 4,
  ariaLabel,
  style,
  zIndex = Z.dropdownInModal,
}: PopoverProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  // Vertical placement is decided ONCE per open and then held stable. Without
  // this lock the flip test re-ran on every scroll event against the live
  // surface height, so a tall (scrolling) popover oscillated above↔below the
  // anchor as the page moved. Captured on first reposition, reset on close.
  const placementRef = useRef<"below" | "above" | null>(null);

  const close = useCallback(() => {
    onClose();
    setPos(null);
    placementRef.current = null;
  }, [onClose]);

  // Position the surface — runs on open + on every scroll/resize so the
  // menu stays glued to its anchor while the page moves. useLayoutEffect
  // so the first paint is already positioned (no flash at 0,0).
  useLayoutEffect(() => {
    if (!open || !anchor) return;
    // Fresh open → re-decide placement on the next reposition.
    placementRef.current = null;
    function reposition() {
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const s = surfaceRef.current;
      const surfaceWidth = s?.offsetWidth ?? minWidth;
      const measured = s?.offsetHeight ?? 0;
      const pad = 8;

      let left = align === "end" ? rect.right - surfaceWidth : rect.left;
      left = Math.max(pad, Math.min(left, window.innerWidth - surfaceWidth - pad));

      // Decide above-vs-below ONCE, then hold it stable (re-running the flip
      // test on every scroll is what made tall popovers oscillate). BUT the
      // first reposition fires before the surface has painted, so `measured`
      // is 0 → it would wrongly conclude "fits below" and lock the wrong side.
      // Guard: only LOCK the placement once we have a real measured height; on
      // the pre-paint frame, fall back to the worst-case height (the capped
      // `maxHeight`) so even the first paint lands on the correct side, and
      // re-decide on the next frame once measured.
      const estHeight = measured || maxHeight;
      if (placementRef.current === null || measured === 0) {
        const roomBelow = window.innerHeight - rect.bottom - pad;
        const roomAbove = rect.top - pad;
        // Prefer below; flip above only when it won't fit below AND above has
        // more room. Compare against the (estimated) height so a tall popover
        // near the bottom edge flips up immediately.
        const fitsBelow = estHeight <= roomBelow;
        const side =
          !fitsBelow && roomAbove > roomBelow ? "above" : "below";
        if (measured > 0) placementRef.current = side; // lock once real
        else {
          // pre-paint: use the estimate for THIS frame but don't lock yet
          const top =
            side === "above"
              ? Math.max(pad, rect.top - estHeight - 4)
              : rect.bottom + 4;
          setPos({ top, left });
          return;
        }
      }

      const top =
        placementRef.current === "above"
          ? Math.max(pad, rect.top - measured - 4)
          : rect.bottom + 4;

      setPos({ top, left });
    }
    reposition();
    // Re-run after paint so the surface is measured and the placement locks
    // against its REAL height (the first synchronous call ran pre-paint).
    const raf = requestAnimationFrame(reposition);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, anchor, align, minWidth, maxHeight]);

  // Outside pointerdown + Escape close. We stop the close-on-pointerdown
  // when the click lands inside the surface OR the anchor (re-clicking
  // the trigger should toggle, which is the caller's job — not ours).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (surfaceRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchor, close]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={surfaceRef}
      role="menu"
      aria-label={ariaLabel}
      // Stop propagation so clicks inside the surface don't bubble to
      // row-click handlers on ancestors (table rows, card-as-link, etc.)
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        minWidth,
        maxHeight,
        overflowY: "auto",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-lg)",
        padding,
        zIndex,
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

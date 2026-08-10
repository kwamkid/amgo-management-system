"use client";

import React, {
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
/*  <HelpTooltip/> — hover-triggered rich tooltip                              */
/*                                                                            */
/*  Use this for inline help text on column headers, metric labels, and       */
/*  anywhere a native `title=""` would be readable but ugly — `title` only    */
/*  takes a plain string, looks like a system tooltip (jarring next to a      */
/*  custom design system), and has no styling control.                        */
/*                                                                            */
/*  Use the click-popover <Popover/> instead when:                            */
/*   - the content is interactive (form, multi-select rows, links)            */
/*   - the user needs the popover to stay open while they read                */
/*   - touch input matters (hover doesn't translate to mobile)                */
/*                                                                            */
/*  Behaviour                                                                 */
/*  ----------------------------------------------------------------------    */
/*   - Portal to <body> so the tooltip can escape ancestors with              */
/*     `overflow: hidden` (table cells, scrolling cards).                     */
/*   - Mouse-bridge: hovering the tooltip surface itself keeps it open so     */
/*     the user can mouse across the gap to read.                             */
/*   - Closes on any outside scroll/resize — keeps it anchored without        */
/*     reposition-on-scroll thrash (rare in practice; user moves on quickly). */
/*   - Default trigger styling = dotted underline (`cursor: help`). Override  */
/*     via `triggerStyle` when wrapping an existing icon/badge.               */
/*                                                                            */
/*  Pattern lifted from analytics/posts-list HelpTooltip + CaptionCell —      */
/*  same mouse-bridge + outer-scroll-dismiss heuristics.                      */
/* ========================================================================== */

export interface HelpTooltipProps {
  /** What the user hovers — usually a label or icon. */
  children: ReactNode;
  /** Tooltip body. JSX or string; rich content welcome. */
  content: ReactNode;
  /** Popover width in px. Default 320. Pick ≥320 for multi-paragraph help.
   *  Ignored by `variant="tooltip"` (which sizes to its content). */
  width?: number;
  /** Horizontal alignment — "start" pins left edges, "end" pins right. */
  align?: "start" | "end";
  /**
   * `"help"` (default) = rich light popover for multi-line help text.
   * `"tooltip"` = compact dark chip (black bg / white text) that hugs its
   * content — for short labels on icon buttons.
   */
  variant?: "help" | "tooltip";
  /** Hover delay before showing, in ms. Default 2000 — long enough that a
   *  quick pass-through never flashes the chip; only an intentional rest
   *  on the trigger reveals it. Pass 0 for instant. */
  delay?: number;
  /**
   * Override styling of the trigger span. Default = dotted underline +
   * `cursor: help`. Pass an empty object to remove the underline (useful
   * when wrapping an icon that's already its own affordance).
   */
  triggerStyle?: CSSProperties;
}

export function HelpTooltip({
  children,
  content,
  width = 320,
  align = "start",
  variant = "help",
  delay = 2000,
  triggerStyle,
}: HelpTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const isChip = variant === "tooltip";
  // Hover-delay timer. Cleared on leave so a quick pass-through never shows.
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearShowTimer = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  };
  const openWithDelay = () => {
    if (delay <= 0) {
      setOpen(true);
      return;
    }
    clearShowTimer();
    showTimer.current = setTimeout(() => setOpen(true), delay);
  };
  const closeNow = () => {
    clearShowTimer();
    setOpen(false);
  };
  useEffect(() => () => clearShowTimer(), []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const pad = 8;
    if (isChip) {
      // Chip sizes to content — measure the rendered surface (if present yet)
      // to keep it on-screen; center under the trigger.
      const w = popoverRef.current?.offsetWidth ?? 0;
      let left = rect.left + rect.width / 2 - w / 2;
      left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
      setPos({
        top: rect.bottom + 6 + window.scrollY,
        left: left + window.scrollX,
      });
      return;
    }
    let left = align === "end" ? rect.right - width : rect.left;
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
    setPos({
      top: rect.bottom + 6 + window.scrollY,
      left: left + window.scrollX,
    });
  }, [open, width, align, isChip]);

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      // Scrolls INSIDE the tooltip itself shouldn't close it — the user
      // is trying to read overflowing content.
      const target = e.target as Node | null;
      if (target && popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const defaultTriggerStyle: CSSProperties = {
    cursor: "help",
    borderBottom: "1px dotted var(--fg-4)",
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={openWithDelay}
        onMouseLeave={closeNow}
        style={{ ...defaultTriggerStyle, ...triggerStyle }}
      >
        {children}
      </span>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            onMouseEnter={() => {
              // The dark chip is a passive label — don't keep it open on
              // hover (would block clicks under it). The rich help popover
              // keeps the mouse-bridge so the user can read across the gap.
              if (!isChip) setOpen(true);
            }}
            onMouseLeave={closeNow}
            onWheel={(e) => e.stopPropagation()}
            style={
              isChip
                ? {
                    position: "absolute",
                    top: pos.top,
                    left: pos.left,
                    maxWidth: "calc(100vw - 16px)",
                    width: "max-content",
                    padding: "5px 9px",
                    background: "var(--warm-900, #1a1411)",
                    color: "#fff",
                    borderRadius: "var(--r-sm)",
                    boxShadow: "var(--shadow-md)",
                    zIndex: Z.tooltip,
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: "var(--font-sans)",
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }
                : {
                    position: "absolute",
                    top: pos.top,
                    left: pos.left,
                    width,
                    maxWidth: "calc(100vw - 16px)",
                    maxHeight: 480,
                    overflowY: "auto",
                    padding: "12px 14px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-2)",
                    borderRadius: "var(--r-md)",
                    boxShadow: "var(--shadow-lg)",
                    zIndex: Z.tooltip,
                    fontSize: 13,
                    fontWeight: 400,
                    color: "var(--fg-1)",
                    fontFamily: "var(--font-sans)",
                    lineHeight: 1.5,
                    textTransform: "none",
                    letterSpacing: 0,
                    textAlign: "left",
                  }
            }
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

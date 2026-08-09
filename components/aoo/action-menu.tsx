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
import { IconButton, LucideIcon, type IconButtonProps } from "./button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ActionMenuItem =
  | {
      kind?: "item";
      /** Label shown in the menu. */
      label: ReactNode;
      /** Lucide icon name (left of the label). Optional. */
      icon?: string;
      /** Click handler. The menu auto-closes after onSelect returns. */
      onSelect: () => void;
      /** Tone — "danger" gets a red-tinted text. */
      tone?: "default" | "danger";
      /** Disable selection. */
      disabled?: boolean;
    }
  | {
      kind: "divider";
    };

export interface ActionMenuProps {
  /** Items to render. Use `{ kind: "divider" }` for a separator row. */
  items: ActionMenuItem[];
  /** Accessible label for the trigger button. */
  label?: string;
  /**
   * Override the trigger button. Receives an `onClick` handler and an
   * `open` boolean. Use this when the default `IconButton` doesn't fit.
   * The trigger must render inside the returned element — ActionMenu wraps
   * it in a positioning span so it can read getBoundingClientRect.
   */
  trigger?: (props: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
    open: boolean;
  }) => ReactNode;
  /** Trigger icon when using the default `IconButton`. Default: MoreHorizontal. */
  triggerIcon?: string;
  /** Trigger size when using the default `IconButton`. Default: 28. */
  triggerSize?: number;
  /** Trigger tone. */
  triggerTone?: IconButtonProps["tone"];
  /** Menu min-width in px. Default 180. */
  minWidth?: number;
  /** Preferred horizontal alignment relative to the trigger. Default "end". */
  align?: "start" | "end";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ActionMenu({
  items,
  label: labelProp,
  trigger,
  triggerIcon = "MoreHorizontal",
  triggerSize = 28,
  triggerTone,
  minWidth = 180,
  align = "end",
}: ActionMenuProps) {
  // โปรเจกต์นี้ภาษาไทยอย่างเดียว ไม่ได้ใช้ i18n
  const label = labelProp ?? "เปิดเมนู";
  const [open, setOpen] = useState(false);
  // Portal-positioned in viewport coordinates so the menu can escape clipping
  // ancestors (table cells with overflow:hidden, card with overflow:auto…).
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // We wrap the trigger in a span so we can read its rect without forcing
  // every caller's trigger to forward a ref.
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  const toggle = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen((v) => !v);
  }, []);

  // Position the floating menu when it opens.
  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const w = wrapRef.current;
      if (!w) return;
      const rect = w.getBoundingClientRect();
      const m = menuRef.current;
      const menuWidth = m?.offsetWidth ?? minWidth;
      const menuHeight = m?.offsetHeight ?? 0;
      const pad = 8;

      let left = align === "end" ? rect.right - menuWidth : rect.left;
      left = Math.max(pad, Math.min(left, window.innerWidth - menuWidth - pad));

      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight - pad) {
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
  }, [open, align, minWidth, items.length]);

  // Click-outside + Escape to close.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (wrapRef.current?.contains(target)) return;
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
  }, [open, close]);

  // Default trigger gets a dedicated class (`aoo-action-trigger`) so the
  // hover/active visuals stand apart from generic row-hover. Without this,
  // a "…" button sitting inside a hoverable table row reads as ambient
  // chrome — users don't realise it's clickable until they hit it.
  const triggerNode = trigger ? (
    trigger({ onClick: toggle, open })
  ) : (
    <IconButton
      icon={triggerIcon}
      size={triggerSize}
      tone={triggerTone}
      title={label}
      onClick={toggle}
      className={`aoo-action-trigger${open ? " is-open" : ""}`}
    />
  );

  return (
    <>
      <span
        ref={wrapRef}
        style={{ display: "inline-flex" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {triggerNode}
      </span>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              minWidth,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-lg)",
              padding: 4,
              zIndex: 300,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item, i) => {
              if (item.kind === "divider") {
                return (
                  <div
                    key={`d-${i}`}
                    role="separator"
                    style={{
                      height: 1,
                      background: "var(--border-1)",
                      margin: "4px 0",
                    }}
                  />
                );
              }
              return <MenuItem key={i} item={item} onAfterSelect={close} />;
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  MenuItem                                                           */
/* ------------------------------------------------------------------ */

function MenuItem({
  item,
  onAfterSelect,
}: {
  item: Exclude<ActionMenuItem, { kind: "divider" }>;
  onAfterSelect: () => void;
}) {
  const danger = item.tone === "danger";
  const color = danger ? "var(--ruby-700)" : "var(--fg-1)";

  // Hover/active visuals live in globals.css under `.action-menu-item`
  // (and `--tone="danger"`) so the swap on light/dark uses the right
  // token without re-rendering through React state. Inline JS hover bg
  // would freeze on the value resolved at render time and not respond
  // to a theme toggle while the menu is open.
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    border: "none",
    background: "transparent",
    color: item.disabled ? "var(--fg-4)" : color,
    borderRadius: "var(--r-sm)",
    fontSize: 13,
    fontWeight: 500,
    cursor: item.disabled ? "not-allowed" : "pointer",
    textAlign: "left",
    width: "100%",
  };

  return (
    <button
      type="button"
      role="menuitem"
      className="action-menu-item"
      data-tone={danger ? "danger" : "default"}
      disabled={item.disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (item.disabled) return;
        item.onSelect();
        onAfterSelect();
      }}
      style={style}
    >
      {item.icon && (
        <span
          style={{
            display: "inline-flex",
            color: item.disabled ? "var(--fg-4)" : color,
            lineHeight: 0,
          }}
        >
          <LucideIcon name={item.icon} size={14} />
        </span>
      )}
      <span style={{ flex: 1 }}>{item.label}</span>
    </button>
  );
}

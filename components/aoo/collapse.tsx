"use client";

import React, { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface CollapseProps {
  /** Header content — the clickable summary row. */
  title: ReactNode;
  /** Optional content on the right of the header (badge, status). */
  headerExtra?: ReactNode;
  /** Body, revealed when open. */
  children: ReactNode;
  /** Uncontrolled initial open state. Default false. */
  defaultOpen?: boolean;
  /** Controlled open state — pair with onOpenChange. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Visual accent (e.g. active card border). */
  accent?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Disclosure / accordion primitive — a header row that expands a body on click.
 * One place owns the chevron rotation, border, and reveal animation so callers
 * stop hand-rolling `useState` + a chevron + a div everywhere (super-admin
 * payment key cards, settings sections, FAQ-style lists).
 *
 * Works controlled (`open` + `onOpenChange`) or uncontrolled (`defaultOpen`).
 * Renders on the shared surface tokens so it inherits dark mode + the
 * super-admin scope automatically.
 */
export function Collapse({
  title,
  headerExtra,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  accent,
  className,
  style,
}: CollapseProps) {
  const controlled = open !== undefined;
  const [internal, setInternal] = useState(defaultOpen);
  const isOpen = controlled ? open : internal;
  const bodyId = useId();

  function toggle() {
    const next = !isOpen;
    if (!controlled) setInternal(next);
    onOpenChange?.(next);
  }

  return (
    <div
      className={className}
      style={{
        border: accent
          ? "2px solid var(--accent)"
          : "1px solid var(--border-1)",
        borderRadius: "var(--r-lg, 14px)",
        background: "var(--bg-surface)",
        overflow: "hidden",
        ...style,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--fg-1)",
          textAlign: "left",
        }}
      >
        <span className="t-body-strong" style={{ flex: 1, minWidth: 0 }}>
          {title}
        </span>
        {headerExtra}
        <ChevronDown
          size={18}
          style={{
            flexShrink: 0,
            color: "var(--fg-3)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--dur-fast) var(--ease-out)",
          }}
        />
      </button>

      {isOpen && (
        <div
          id={bodyId}
          style={{
            padding: "4px 18px 18px",
            display: "grid",
            gap: 14,
            animation: "aooFadeIn var(--dur-fast) var(--ease-out)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

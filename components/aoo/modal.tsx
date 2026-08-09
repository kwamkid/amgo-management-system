"use client";

import React, {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { X } from "lucide-react";

export interface ModalProps {
  /** Whether the modal is rendered. */
  open: boolean;
  /** Called on backdrop click, Escape key, or close button. */
  onClose: () => void;
  /** Title shown in the header. */
  title?: ReactNode;
  /** Optional subtitle/description shown below the title. */
  description?: ReactNode;
  /** Body content. */
  children: ReactNode;
  /** Buttons rendered at the bottom (right-aligned by default). */
  footer?: ReactNode;
  /** Max width in px. Default 480. */
  maxWidth?: number;
  /** Hide the close (×) button. */
  hideCloseButton?: boolean;
  /** When false, clicking the backdrop won't dismiss. */
  dismissOnBackdrop?: boolean;
}

/**
 * Centered modal with warm-ink scrim. Closes on Esc and backdrop click.
 * Body scroll locked while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 480,
  hideCloseButton = false,
  dismissOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // โปรเจกต์นี้ภาษาไทยอย่างเดียว ไม่ได้ใช้ i18n

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while open. We also pad the body by the scrollbar
  // width so removing it doesn't reflow the page horizontally (otherwise
  // everything beneath the backdrop shifts a few pixels right when the
  // scrollbar disappears, then snaps back on close). innerWidth -
  // documentElement.clientWidth is the scrollbar width on platforms that
  // reserve space for it (Windows, Linux); on macOS overlay scrollbars it
  // evaluates to 0 and the padding is a no-op.
  useEffect(() => {
    if (!open) return;
    const scrollbarW =
      window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPadRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarW > 0) {
      document.body.style.paddingRight = `${scrollbarW}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadRight;
    };
  }, [open]);

  // Focus the panel on open so keyboard users can immediately Tab to controls.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleBackdropClick = useCallback(() => {
    if (dismissOnBackdrop) onClose();
  }, [dismissOnBackdrop, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "aoo-modal-title" : undefined}
      style={scrimStyle}
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{ ...panelStyle, maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || !hideCloseButton) && (
          <header style={headerStyle}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && (
                <h2 id="aoo-modal-title" className="t-h4" style={titleStyle}>
                  {title}
                </h2>
              )}
              {description && (
                <div className="t-small" style={descriptionStyle}>
                  {description}
                </div>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label={"ปิด"}
                style={closeButtonStyle}
              >
                <X size={18} />
              </button>
            )}
          </header>
        )}

        <div style={bodyStyle}>{children}</div>

        {footer && <footer style={footerStyle}>{footer}</footer>}
      </div>
    </div>
  );
}

const scrimStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(26, 20, 17, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // 12px on phones (more usable real estate); the panel never exceeds maxWidth
  // so on a desktop you'll still see consistent breathing room around it.
  padding: "clamp(12px, 3vw, 24px)",
  zIndex: 200,
  animation: "aooModalFade var(--dur-med) var(--ease-out)",
};

const panelStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  background: "var(--bg-surface)",
  borderRadius: "var(--r-xl)",
  border: "1px solid var(--border-1)",
  boxShadow: "var(--shadow-xl)",
  outline: "none",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  // Cap the panel at the scrim's content box (scrim is full-viewport
  // with `clamp(12, 3vw, 24)px` padding, so this is `100vh - 2 ×
  // scrim padding`). Using `100%` instead of the old hardcoded
  // `100vh - 24` makes the cap track the scrim's actual padding —
  // important on wide viewports where scrim padding is 24×2 = 48,
  // and the old value let the panel overflow the scrim by 24px.
  // Without an effective cap, the body's overflowY:auto never sees
  // a constrained height and scroll-on-tall-content silently fails.
  maxHeight: "100%",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "18px 20px 12px",
  borderBottom: "1px solid var(--border-1)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--fg-1)",
};

const descriptionStyle: CSSProperties = {
  marginTop: 4,
  color: "var(--fg-3)",
};

const closeButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: "var(--r-sm)",
  border: "none",
  background: "transparent",
  color: "var(--fg-3)",
  cursor: "pointer",
  flexShrink: 0,
};

const bodyStyle: CSSProperties = {
  padding: 20,
  // `overlay` (was `auto`) so the scroll affordance is visible whenever
  // the content is taller than the body — macOS's default auto
  // scrollbars hide until you start scrolling, which on a modal
  // containing an opaque embedded iframe (FB post embed) reads as "the
  // modal is just the wrong size" rather than "scroll for more". The
  // `overflow-y: auto` fallback below handles browsers that don't grok
  // the modern keyword (Firefox, Safari < 18).
  overflowY: "auto",
  scrollbarGutter: "stable",
  // `flex: 1, minHeight: 0` is what makes overflowY actually scroll
  // INSIDE the modal instead of growing the panel past its 100vh-24
  // maxHeight. Without these, content taller than the viewport pushes
  // the panel down, the body never sees an overflow, and the page
  // scrolls instead — which on a modal-locked page (body
  // overflow:hidden) feels like nothing is scrollable at all.
  flex: 1,
  minHeight: 0,
};

const footerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  padding: "12px 20px 16px",
  borderTop: "1px solid var(--border-1)",
};

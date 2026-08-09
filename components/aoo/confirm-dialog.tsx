"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { Button, type ButtonVariant } from "./button";

/* ============================================================================
 *  ConfirmDialog — modal replacement for `window.confirm()`
 *
 *  Two ways to use:
 *
 *  1) Declarative (controlled by parent state) — best when the dialog needs
 *     to render dynamic content:
 *
 *       <ConfirmDialog
 *         open={open}
 *         title="ลบไฟล์?"
 *         description="ไฟล์นี้จะถูกย้ายไปแท็บ Deleted"
 *         confirmLabel="ลบ"
 *         tone="danger"
 *         onConfirm={() => { ... }}
 *         onClose={() => setOpen(false)}
 *       />
 *
 *  2) Imperative (hook) — drop-in replacement for `if (!confirm(...))`:
 *
 *       const { confirm, dialog } = useConfirm();
 *       // ...
 *       async function handleDelete() {
 *         const ok = await confirm({
 *           title: 'ลบโพสต์นี้?',
 *           tone: 'danger',
 *           confirmLabel: 'ลบ',
 *         });
 *         if (!ok) return;
 *         // ...
 *       }
 *       return (<>{dialog}<button onClick={handleDelete}>...</button></>);
 *
 *  The imperative version is what most existing `confirm()` call-sites want
 *  because they already live inside event handlers where you can't easily
 *  hoist a state-driven modal.
 * ========================================================================== */

export type ConfirmTone = "danger" | "primary" | "neutral";

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** Body content above the buttons — overrides description if provided. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Called when the user confirms. Can be async — buttons disable while it runs. */
  onConfirm: () => void | Promise<void>;
  /** Called when the user cancels (button, Esc, or backdrop). */
  onClose: () => void;
  /** When false, hide the cancel button (only "OK" remains). */
  showCancel?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  onConfirm,
  onClose,
  showCancel = true,
}: ConfirmDialogProps) {
  // โปรเจกต์นี้ภาษาไทยอย่างเดียว ไม่ได้ใช้ i18n
  const [busy, setBusy] = useState(false);

  const resolvedConfirmLabel = confirmLabel ?? "ยืนยัน";
  const resolvedCancelLabel = cancelLabel ?? "ยกเลิก";

  // Reset busy whenever the dialog reopens, so a fresh action doesn't
  // inherit "disabled" from a previous cycle.
  useEffect(() => {
    if (open) setBusy(false);
  }, [open]);

  const handleConfirm = useCallback(async () => {
    if (busy) return;
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }, [busy, onConfirm]);

  const confirmVariant: ButtonVariant =
    tone === "danger" ? "danger" : tone === "neutral" ? "secondary" : "primary";

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      maxWidth={440}
      dismissOnBackdrop={!busy}
      footer={
        <>
          {showCancel && (
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={busy}
            >
              {resolvedCancelLabel}
            </Button>
          )}
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={busy}
            autoFocus
          >
            {resolvedConfirmLabel}
          </Button>
        </>
      }
    >
      {children ?? (
        <p className="t-body" style={{ margin: 0, color: "var(--fg-2)" }}>
          {description}
        </p>
      )}
    </Modal>
  );
}

/* ----------------------------------------------------------------------------
 *  useConfirm — imperative API
 * -------------------------------------------------------------------------- */

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Returns:
 *  - `confirm(opts)`: opens the dialog, resolves `true` if user confirmed,
 *    `false` if they cancelled / dismissed.
 *  - `dialog`: the JSX element to render somewhere in the component tree.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  // Keep latest pending in a ref so the confirm() callback identity is stable
  // even when the user reopens the dialog mid-flow.
  const pendingRef = useRef<PendingConfirm | null>(null);
  pendingRef.current = pending;

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      // If something was already pending (shouldn't normally happen, but
      // defend against double-clicks), resolve the old one as cancelled
      // before showing the new one.
      const prev = pendingRef.current;
      if (prev) prev.resolve(false);
      setPending({ ...opts, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    p.resolve(true);
    setPending(null);
  }, []);

  const handleClose = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    p.resolve(false);
    setPending(null);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.title ?? ""}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      tone={pending?.tone}
      onConfirm={handleConfirm}
      onClose={handleClose}
    >
      {pending?.children}
    </ConfirmDialog>
  );

  return { confirm, dialog };
}

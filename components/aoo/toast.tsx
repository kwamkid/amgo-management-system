"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, type LucideProps } from "lucide-react";
import { Z } from './z-layers'

/* ------------------------------------------------------------------ */
/*  Toast — single bubble. The shared layer is the Provider/Stack     */
/*  below; <Toast> is exported for ad-hoc cases (custom positioning). */
/* ------------------------------------------------------------------ */

export type ToastTone = "ok" | "err" | "info";

export interface ToastProps {
  children: React.ReactNode;
  tone?: ToastTone;
  visible?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface ToneConfig {
  icon: React.FC<LucideProps>;
  iconColor: string;
}

const TONE_MAP: Record<ToastTone, ToneConfig> = {
  ok: { icon: CheckCircle2, iconColor: "var(--leaf-300)" },
  err: { icon: AlertCircle, iconColor: "var(--ruby-300)" },
  info: { icon: Info, iconColor: "var(--brand-coral-300)" },
};

export function Toast({
  children,
  tone = "info",
  visible = true,
  className,
  style: styleProp,
}: ToastProps) {
  const t = TONE_MAP[tone];
  const IconComp = t.icon;

  const rootStyle: CSSProperties = {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: visible
      ? "translateX(-50%) translateY(0)"
      : "translateX(-50%) translateY(16px)",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    paddingInline: 16,
    paddingBlock: 10,
    borderRadius: "var(--r-lg)",
    background: "var(--warm-900)",
    color: "var(--fg-on-dark)",
    fontSize: "var(--fs-small)",
    fontWeight: 500,
    boxShadow: "var(--shadow-lg)",
    zIndex: Z.toast,
    transition: `opacity var(--dur-med) var(--ease-out), transform var(--dur-med) var(--ease-out)`,
    ...styleProp,
  };

  return (
    <div className={className} style={rootStyle} role="status" aria-live="polite">
      <IconComp size={18} style={{ color: t.iconColor, flexShrink: 0 }} />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ToastProvider + useToast hook                                     */
/*                                                                    */
/*  Mount <ToastProvider> once near the root (see src/app/layout.tsx) */
/*  and call `pushToast(tone, message)` from anywhere via useToast(). */
/*  The provider owns the bottom-right stack, the auto-dismiss timer, */
/*  and ID generation, so callers don't reinvent any of it.           */
/* ------------------------------------------------------------------ */

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: ReactNode;
}

interface ToastContextValue {
  pushToast: (tone: ToastTone, message: ReactNode, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Default auto-dismiss in ms. Callers can override per push. */
const DEFAULT_TTL = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Monotonic id source — useRef so re-renders don't reset the counter
  // (would cause key collisions when two toasts fire within the same
  // millisecond after a state update batch).
  const nextIdRef = useRef(1);

  const pushToast = useCallback(
    (tone: ToastTone, message: ReactNode, durationMs = DEFAULT_TTL) => {
      const id = nextIdRef.current++;
      setToasts((prev) => [...prev, { id, tone, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <ToastStack toasts={toasts} />
    </ToastContext.Provider>
  );
}

/** Hook for any client component to push a toast. Throws if called
 *  outside the provider so missing wiring surfaces in dev, not silently. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast() called outside <ToastProvider>. Wrap the app root in <ToastProvider>.",
    );
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  ToastStack — bottom-right stack. Newest at the bottom (visually   */
/*  stacked upward via column-reverse) so the eye lands on the most   */
/*  recent without the older ones jumping.                             */
/* ------------------------------------------------------------------ */

function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "flex-end",
        gap: 8,
        zIndex: Z.toast,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          tone={t.tone}
          style={{
            position: "static",
            transform: "none",
            pointerEvents: "auto",
            maxWidth: 420,
          }}
        >
          {t.message}
        </Toast>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FlashToastBridge — translates ?flash=… search params into toasts. */
/*                                                                    */
/*  Server actions that redirect after success/error often append a   */
/*  `?flash=<key>` query string. This client component reads them on  */
/*  mount, fires a toast, and strips the params from the URL so a     */
/*  refresh doesn't replay the toast.                                 */
/*                                                                    */
/*  Usage: mount in any client tree (typically once per page) and     */
/*  pass a `messages` map that resolves a flash key → toast content.  */
/* ------------------------------------------------------------------ */

export interface FlashToastBridgeProps {
  /** Map of flash key → { tone, message } resolved on mount. Pass any
   *  keys your route emits via `?flash=`. */
  messages: Record<string, { tone: ToastTone; message: ReactNode }>;
}

export function FlashToastBridge({ messages }: FlashToastBridgeProps) {
  const { pushToast } = useToast();
  // Fire-once guard so React StrictMode double-mount doesn't double-toast.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const flash = url.searchParams.get("flash");
    if (!flash) return;
    const entry = messages[flash];
    if (entry) {
      pushToast(entry.tone, entry.message);
    }
    firedRef.current = true;
    // Strip the param so a refresh doesn't re-toast.
    url.searchParams.delete("flash");
    window.history.replaceState({}, "", url.toString());
  }, [messages, pushToast]);

  return null;
}

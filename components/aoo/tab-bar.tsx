import { type CSSProperties, type ReactNode } from "react";
import { Spinner } from "./spinner";

/**
 * Shared pill-style tab bar (active tab = solid accent pill; was an
 * underline strip until 30 Sep 2026).
 *
 * Why a dedicated component instead of inline `<button>`s with
 * `aria-selected`: the same tab pattern shows up in every
 * "page-level section navigator" — Ads page tabs, the prototype's
 * "which question?" jump, and (soon) more. Defining it once means a
 * future style tweak hits all of them at the same time.
 *
 * Layout:
 *   <TabBar>
 *     <TabItem active={t === "a"} onClick={() => setT("a")} label="A" />
 *     <TabItem ... />
 *     <TabBar.Right>  ← optional right-side slot for filters
 *       <DatePicker />
 *     </TabBar.Right>
 *   </TabBar>
 */
export interface TabBarProps {
  children: ReactNode;
  /** ARIA: must be set when this strip is a tab list. */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function TabBar({ children, ariaLabel, className, style }: TabBarProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        ...style,
      }}
    >
      {/* Left-aligned tab buttons. overflowX: auto lets long tab lists
          scroll horizontally on narrow viewports; overflowY: hidden stops
          a phantom vertical scrollbar. */}
      <div
        style={{
          display: "flex",
          gap: 6,
          minWidth: 0,
          flex: "1 1 auto",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        {extractTabs(children)}
      </div>
      {/* Right slot — any <TabBar.Right> child renders here. */}
      {extractRight(children)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TabItem                                                            */
/* ------------------------------------------------------------------ */

export interface TabItemProps {
  active: boolean;
  onClick: () => void;
  /** Visible text (or React node — e.g. icon + label). */
  label: ReactNode;
  /** Render a small spinner next to the label while the tab's view
   *  is loading. Useful when switching tabs triggers a fetch. */
  loading?: boolean;
  /** Disable click (e.g. tab points at an empty bucket). */
  disabled?: boolean;
  /** Optional sub-text rendered under the label, smaller + muted. */
  sub?: ReactNode;
  /** Extra ARIA target. Defaults to no id. */
  id?: string;
  /** ARIA-controls the tabpanel id, if any. */
  controls?: string;
}

export function TabItem({
  active,
  onClick,
  label,
  loading,
  disabled,
  sub,
  id,
  controls,
}: TabItemProps) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      data-tab-fx
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        flexDirection: sub ? "column" : "row",
        alignItems: sub ? "flex-start" : "center",
        gap: sub ? 2 : 6,
        padding: sub ? "8px 16px 10px" : "8px 16px",
        background: active ? "var(--accent)" : "var(--bg-surface)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border-1)"}`,
        borderRadius: sub ? 12 : 999,
        color: active
          ? "var(--fg-on-brand)"
          : disabled
            ? "var(--fg-4)"
            : "var(--fg-3)",
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.6 : 1,
        textAlign: "left",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {label}
        {loading && <Spinner size="xs" tone={active ? "on-brand" : "brand"} />}
      </span>
      {sub && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: active ? "var(--fg-on-brand)" : "var(--fg-3)",
            opacity: active ? 0.85 : 1,
          }}
        >
          {sub}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  TabBar.Right — optional right-aligned slot                         */
/* ------------------------------------------------------------------ */

interface TabBarRightProps {
  children: ReactNode;
}

function TabBarRight({ children }: TabBarRightProps) {
  return (
    <div style={{ flexShrink: 0, display: "flex", gap: 8 }}>
      {children}
    </div>
  );
}

// Tag the component so the parent can split children into tabs vs.
// the right slot at render time. Using a marker symbol on the type
// keeps the API clean — no need for context.
(TabBarRight as { displayName?: string }).displayName = "TabBar.Right";
(TabBar as unknown as { Right: typeof TabBarRight }).Right = TabBarRight;

export { TabBarRight };

/* ------------------------------------------------------------------ */
/*  Children splitter                                                  */
/* ------------------------------------------------------------------ */

/** Walk children, keep everything that isn't a <TabBar.Right>. */
function extractTabs(children: ReactNode): ReactNode {
  if (!Array.isArray(children)) {
    return isRightSlot(children) ? null : children;
  }
  return children.filter((c) => !isRightSlot(c));
}

/** Walk children, return the first <TabBar.Right> if present. */
function extractRight(children: ReactNode): ReactNode {
  if (!Array.isArray(children)) {
    return isRightSlot(children) ? children : null;
  }
  return children.find((c) => isRightSlot(c)) ?? null;
}

function isRightSlot(node: ReactNode): boolean {
  if (!node || typeof node !== "object" || !("type" in node)) return false;
  const type = (node as { type: unknown }).type;
  if (typeof type === "function" || (typeof type === "object" && type !== null)) {
    return (type as { displayName?: string }).displayName === "TabBar.Right";
  }
  return false;
}

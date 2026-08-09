import { type CSSProperties, type ReactNode } from "react";
import { Spinner } from "./spinner";

/**
 * Shared underline-style tab bar.
 *
 * Why a dedicated component instead of inline `<button>`s with
 * `aria-selected`: the underline pattern (border-bottom 2px accent,
 * fg-3 → fg-1 on active, full-row bottom border) shows up in every
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
 *
 * The container draws the bottom border so the active tab's underline
 * sits flush with it (the -1px margin-bottom on TabItem is what makes
 * the two borders overlap).
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
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        borderBottom: "1px solid var(--border-1)",
        ...style,
      }}
    >
      {/* Left-aligned tab buttons. overflowX: auto lets long tab lists
          scroll horizontally on narrow viewports; overflowY: hidden is
          critical — without it, the TabItem's `marginBottom: -1` (which
          pulls the underline onto the parent border) makes the browser
          think the row needs vertical scroll and a phantom scrollbar
          appears in the gutter between the tabs and TabBar.Right
          content. Locking the vertical axis hides that scrollbar. */}
      <div
        style={{
          display: "flex",
          gap: 2,
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
        padding: sub ? "10px 16px 12px" : "10px 16px",
        background: "transparent",
        border: "none",
        borderBottom: active
          ? "2px solid var(--accent)"
          : "2px solid transparent",
        color: active
          ? "var(--fg-1)"
          : disabled
            ? "var(--fg-4)"
            : "var(--fg-3)",
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        marginBottom: -1,
        whiteSpace: "nowrap",
        opacity: disabled ? 0.6 : 1,
        textAlign: "left",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {label}
        {loading && <Spinner size="xs" tone="brand" />}
      </span>
      {sub && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--fg-3)",
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
    <div style={{ flexShrink: 0, paddingBottom: 6, display: "flex", gap: 8 }}>
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

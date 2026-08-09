import React, { type CSSProperties } from "react";

/* ------------------------------------------------------------------ */
/*  Card                                                              */
/* ------------------------------------------------------------------ */

export interface CardProps {
  children: React.ReactNode;
  padding?: number;
  /**
   * Mark the card as clickable — gets a hover lift (deeper shadow + 1px
   * upward translate) and a press settle (back to flat + accent border).
   * Pair with `onClick` / wrap the contents in a Link for navigation.
   * Default false; non-interactive cards never animate.
   */
  hoverable?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
}

export function Card({
  children,
  padding,
  hoverable = false,
  onClick,
  className,
  style: styleProp,
}: CardProps) {
  // Baseline visuals (surface, border, radius, default padding 20) live in
  // `.aoo-card` in globals.css — keeps the DOM clean of repeated inline
  // border-* longhands per instance. Only non-default values fall through
  // as inline styles via the escape hatch below.
  const rootStyle: CSSProperties = {
    ...(padding !== undefined ? { padding } : {}),
    ...(onClick || hoverable ? { cursor: "pointer" } : {}),
    ...styleProp,
  };

  const classes = ["aoo-card", className].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={rootStyle}
      onClick={onClick}
      data-card-fx={hoverable || onClick ? "" : undefined}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatCard                                                          */
/* ------------------------------------------------------------------ */

export interface StatCardProps {
  /** Small uppercase label above the value */
  eyebrow: string;
  /** Main large value (e.g. "1,204" or "$890") */
  value: string | number;
  /** Change delta, e.g. +12.5 or -3 */
  delta?: number;
  /** Small text below everything */
  foot?: string;
  className?: string;
  style?: CSSProperties;
}

export function StatCard({
  eyebrow,
  value,
  delta,
  foot,
  className,
  style: styleProp,
}: StatCardProps) {
  const isPositive = delta !== undefined && delta >= 0;
  const deltaColor = delta === undefined
    ? undefined
    : isPositive
      ? "var(--leaf-500)"
      : "var(--ruby-500)";
  const deltaArrow = delta === undefined ? "" : isPositive ? "\u25B2" : "\u25BC";

  return (
    <Card className={className} style={styleProp}>
      <div
        style={{
          fontSize: "var(--fs-micro)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-caps)",
          color: "var(--fg-3)",
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </div>

      <div
        style={{
          fontSize: "var(--fs-h2)",
          fontWeight: 700,
          lineHeight: "var(--lh-tight)",
          color: "var(--fg-1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>

      {delta !== undefined && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 4,
            fontSize: "var(--fs-meta)",
            fontWeight: 600,
            color: deltaColor,
          }}
        >
          <span style={{ fontSize: 9 }}>{deltaArrow}</span>
          {Math.abs(delta).toFixed(2)}%
        </div>
      )}

      {foot && (
        <div
          style={{
            marginTop: 8,
            fontSize: "var(--fs-meta)",
            color: "var(--fg-4)",
          }}
        >
          {foot}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  StorageBar                                                        */
/* ------------------------------------------------------------------ */

export interface StorageBarProps {
  /** Used GB */
  used: number;
  /** Total quota GB */
  total: number;
  className?: string;
  style?: CSSProperties;
}

export function StorageBar({
  used,
  total,
  className,
  style: styleProp,
}: StorageBarProps) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  let barColor: string;
  if (pct > 90) barColor = "var(--ruby-500)";
  else if (pct > 80) barColor = "var(--sun-500)";
  else barColor = "var(--leaf-500)";

  const trackStyle: CSSProperties = {
    width: "100%",
    height: 8,
    borderRadius: "var(--r-pill)",
    background: "var(--warm-150)",
    overflow: "hidden",
  };

  const fillStyle: CSSProperties = {
    width: `${pct}%`,
    height: "100%",
    borderRadius: "var(--r-pill)",
    background: barColor,
    transition: `width var(--dur-slow) var(--ease-out)`,
  };

  return (
    <div className={className} style={styleProp}>
      <div style={trackStyle}>
        <div style={fillStyle} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          fontSize: "var(--fs-meta)",
          color: "var(--fg-3)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>
          {used.toFixed(1)} GB / {total.toFixed(1)} GB
        </span>
        <span style={{ color: barColor, fontWeight: 600 }}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

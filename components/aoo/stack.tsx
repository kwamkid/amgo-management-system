import React, { type CSSProperties, type ElementType } from "react";

export interface StackProps {
  /** Main axis. Default "column" (vertical). */
  direction?: "column" | "row";
  /** Gap between children, in px. Default 12. */
  gap?: number;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  /** Allow wrapping (row stacks). */
  wrap?: boolean;
  /** Render element. Default "div". */
  as?: ElementType;
  className?: string;
  /** Escape hatch for the rare extra (margin, width, grid override). */
  style?: CSSProperties;
  children?: React.ReactNode;
}

/**
 * Flexbox layout primitive — the single home for the `display:flex` +
 * direction + gap pattern that was inlined ~85× across the app. Vertical by
 * default (forms/lists); pass `direction="row"` for inline rows. Keeps
 * `minWidth: 0` off by default — add it via `style` on a child that needs to
 * truncate (the well-known flex shrink trap).
 */
export function Stack({
  direction = "column",
  gap = 12,
  align,
  justify,
  wrap = false,
  as: Tag = "div",
  className,
  style,
  children,
}: StackProps) {
  return (
    <Tag
      className={className}
      style={{
        display: "flex",
        flexDirection: direction,
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

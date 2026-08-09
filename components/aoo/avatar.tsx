import React, { type CSSProperties } from "react";
import { AvatarImage } from "./avatar-image";

/* ------------------------------------------------------------------ */
/*  Avatar                                                            */
/* ------------------------------------------------------------------ */

export interface AvatarProps {
  initials?: string;
  /** A CSS color value or CSS variable, e.g. "var(--brand-coral-500)".
   *  When omitted, a deterministic brand color is picked from `initials`
   *  so each person gets a stable, distinct background. */
  color?: string;
  size?: number;
  /** Render with rounded-square shape instead of circle */
  square?: boolean;
  /** Image URL — shown on top of the initials; falls back to initials on
   *  load error (Google avatar 429/404, deleted photo, referrer block…). */
  src?: string;
  className?: string;
  style?: CSSProperties;
}

// Deterministic palette — same initials always map to the same color, so a
// person's fallback avatar is stable across renders/pages.
const FALLBACK_COLORS = [
  "var(--brand-coral-500)",
  "var(--brand-plum-500)",
  "var(--leaf-500)",
  "var(--grape-500)",
  "var(--sun-500)",
  "var(--ruby-500)",
];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length]!;
}

export function Avatar({
  initials,
  color,
  size = 28,
  square = false,
  src,
  className,
  style: styleProp,
}: AvatarProps) {
  const borderRadius = square ? Math.min(8, size * 0.25) : "50%";
  const fontSize = Math.max(10, Math.round(size * 0.4));
  const bg = color ?? colorFor(initials || "?");

  const rootStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    boxSizing: "border-box",
    borderRadius,
    // Always paint the colored initials background. When `src` loads it covers
    // this; when it errors (AvatarImage hides itself) the initials show through
    // with no layout shift.
    background: bg,
    color: "#fff",
    fontSize,
    fontWeight: 600,
    lineHeight: 1,
    textTransform: "uppercase",
    overflow: "hidden",
    flexShrink: 0,
    userSelect: "none",
    position: "relative",
    ...styleProp,
  };

  return (
    <span className={className} style={rootStyle}>
      {/* Initials sit underneath — the fallback when there's no image or it
          fails to load. */}
      <span aria-hidden={src ? "true" : undefined}>{initials?.slice(0, 2)}</span>
      {src && (
        <AvatarImage
          src={src}
          alt={initials ?? ""}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "inherit",
            display: "block",
          }}
        />
      )}
    </span>
  );
}

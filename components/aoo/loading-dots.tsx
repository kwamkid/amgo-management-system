import React, { type CSSProperties } from "react";

/**
 * Animated ellipsis — three dots that fade in one-by-one then reset
 * (. → .. → ... → .), for "working / waiting" inline states. Pair it after a
 * label: `กำลังอัปโหลด<LoadingDots />`. Pure CSS (no JS state), so it's cheap
 * to mount many at once (e.g. one per uploading row).
 *
 * Each dot is staggered by 1/3 of the cycle via animation-delay, so they ripple
 * on and off. `gap` keeps them tight against the preceding text.
 */

export interface LoadingDotsProps {
  /** Dot color. Defaults to currentColor so it inherits the label's color. */
  color?: string;
  /** Full animation cycle in ms. Default 1200. */
  speed?: number;
  /** Dot diameter in px. Default 3. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Screen-reader text (the dots themselves are aria-hidden). Defaults to the translated "loading" label. */
  ariaLabel?: string;
}

export function LoadingDots({
  color = "currentColor",
  speed = 1200,
  size = 3,
  className,
  style,
  ariaLabel,
}: LoadingDotsProps) {
  // โปรเจกต์นี้ภาษาไทยอย่างเดียว ไม่ได้ใช้ i18n
  const label = ariaLabel ?? "กำลังโหลด";
  const dot: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    display: "inline-block",
    animation: `aooLoadingDot ${speed}ms ease-in-out infinite`,
  };

  return (
    <span
      className={className}
      role="status"
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(2, Math.round(size * 0.6)),
        marginLeft: 4,
        verticalAlign: "baseline",
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ ...dot, animationDelay: "0ms" }} />
      <span
        aria-hidden="true"
        style={{ ...dot, animationDelay: `${Math.round(speed / 3)}ms` }}
      />
      <span
        aria-hidden="true"
        style={{ ...dot, animationDelay: `${Math.round((speed / 3) * 2)}ms` }}
      />
      <style>{`
        @keyframes aooLoadingDot {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
      `}</style>
    </span>
  );
}

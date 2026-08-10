import React, { type CSSProperties } from "react";

/**
 * AooSocial-branded loading indicator: the logo glyph spinning on its center.
 *
 * Sizes are intentionally limited so loading states stay consistent across
 * the app. Pass `label` to render a short caption underneath (vertical
 * stack); leave it out for inline use next to other content.
 */

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpinnerTone = "brand" | "on-brand";

const SIZE_PX: Record<SpinnerSize, number> = {
  xs: 16,
  sm: 24,
  md: 40,
  lg: 64,
  xl: 96,
};

export interface SpinnerProps {
  size?: SpinnerSize;
  /**
   * "brand"   — render the logo in its native coral colors (default,
   *             use on neutral backgrounds).
   * "on-brand" — render as monochrome white. Use inside coral buttons,
   *             toasts, or any surface where the logo's coral would clash.
   */
  tone?: SpinnerTone;
  /** Caption rendered beneath the glyph. Omit for inline use. */
  label?: string;
  /** Override caption color. Defaults to --fg-3. */
  labelColor?: string;
  className?: string;
  style?: CSSProperties;
}

export function Spinner({
  size = "md",
  tone = "brand",
  label,
  labelColor,
  className,
  style,
}: SpinnerProps) {
  const px = SIZE_PX[size];

  const wrapper: CSSProperties = {
    display: "inline-flex",
    flexDirection: label ? "column" : "row",
    alignItems: "center",
    justifyContent: "center",
    gap: label ? 12 : 0,
    ...style,
  };

  const glyph: CSSProperties = {
    width: px,
    height: px,
    animation: "aooSpinnerRotate 1.1s linear infinite",
    transformOrigin: "50% 50%",
    display: "block",
    flexShrink: 0,
    ...(tone === "on-brand"
      ? { filter: "brightness(0) invert(1)" }
      : {}),
  };

  return (
    <span className={className} style={wrapper} role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        // โลโก้ของโปรเจกต์นี้อยู่ที่ /amgo-logo.svg — ตอนก๊อปคอมโพเนนต์มา
        // ยังชี้ไปพาธของ aoosocial อยู่ ทำให้ยิง 404 ทุกครั้งที่ขึ้นตัวหมุน
        src="/amgo-logo.svg"
        alt=""
        style={glyph}
        draggable={false}
        aria-hidden="true"
      />
      {label && (
        <span
          style={{
            fontSize: 13,
            color: labelColor ?? "var(--fg-3)",
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {label}
        </span>
      )}
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {label ?? "Loading…"}
      </span>
    </span>
  );
}

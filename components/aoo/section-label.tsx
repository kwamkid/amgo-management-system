import React, { type CSSProperties } from "react";

export interface SectionLabelProps {
  children: React.ReactNode;
  style?: CSSProperties;
}

/**
 * Small uppercase heading that groups a block of fields/rows (e.g. "โควต้า",
 * "ความสามารถ", "ราคา"). Replaces the per-file `sectionTitle` inline-style
 * objects (~20× across forms) so the treatment is consistent in one place.
 */
export function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--fg-3)",
        margin: "8px 0 4px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

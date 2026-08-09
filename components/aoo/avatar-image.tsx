"use client";

import { useState, type CSSProperties } from "react";

/**
 * <img> with an onError fallback. When the src fails to load (Google avatar
 * 429/404, referrer block, deleted photo…) it hides itself so the parent
 * Avatar's initials layer shows through instead of a broken-image box.
 *
 * Lives as its own client component because Server Components can't attach
 * onError handlers. The parent <Avatar> renders the initials underneath this
 * absolutely-positioned image, so "hiding on error" reveals the fallback with
 * zero layout shift.
 */
export function AvatarImage({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      style={style}
    />
  );
}

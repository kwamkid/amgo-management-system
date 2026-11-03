"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Z } from "./z-layers";

/**
 * ดูรูป/วิดีโอเต็มจอ — ยกจาก aoosocial (components/ui/lightbox.tsx) ตัดภาษาหลายภาษาออก
 * ส่ง media หลายชิ้น + index → เลื่อนด้วยลูกศรซ้าย/ขวาได้
 * ปิด: กดพื้นหลัง · Esc (ฟังช่วง capture ให้ถึงก่อน video ที่โฟกัสอยู่กลืนปุ่ม) · ปุ่ม X
 * สไตล์อยู่ .aoo-lightbox ใน globals.css
 */

export interface LightboxItem {
  url: string;
  kind?: "image" | "video";
  alt?: string;
  /** ข้อความสั้นใต้รูป */
  note?: string;
}

export interface LightboxProps {
  open: boolean;
  onClose: () => void;
  media: LightboxItem[];
  index: number;
  onIndexChange?: (next: number) => void;
}

export function Lightbox({ open, onClose, media, index, onIndexChange }: LightboxProps) {
  const count = media.length;
  const safeIndex = Math.max(0, Math.min(index, Math.max(0, count - 1)));
  const item = media[safeIndex];

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (count <= 1) return;
      if (e.key === "ArrowLeft") onIndexChange?.((safeIndex - 1 + count) % count);
      else if (e.key === "ArrowRight") onIndexChange?.((safeIndex + 1) % count);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose, onIndexChange, safeIndex, count]);

  // ล็อกการเลื่อนหน้าระหว่างเปิด
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !item || typeof document === "undefined") return null;

  const go = (step: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onIndexChange?.((safeIndex + step + count) % count);
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="ดูรูป" className="aoo-lightbox" style={{ zIndex: Z.lightbox }} onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="ปิด" className="aoo-lightbox__btn aoo-lightbox__close">
        <X size={20} />
      </button>

      {count > 1 && (
        <>
          <button type="button" onClick={go(-1)} aria-label="รูปก่อนหน้า" className="aoo-lightbox__btn aoo-lightbox__nav aoo-lightbox__nav--prev">
            <ChevronLeft size={24} />
          </button>
          <button type="button" onClick={go(1)} aria-label="รูปถัดไป" className="aoo-lightbox__btn aoo-lightbox__nav aoo-lightbox__nav--next">
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div className="aoo-lightbox__content" onClick={(e) => e.stopPropagation()}>
        {item.kind === "video" ? (
          <video src={item.url} controls autoPlay className="aoo-lightbox__media" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.alt ?? ""} className="aoo-lightbox__media" draggable={false} />
        )}
        {item.note && (
          <div role="note" className="aoo-lightbox__note">
            {item.note}
          </div>
        )}
      </div>

      {count > 1 && (
        <div className="aoo-lightbox__counter">
          {safeIndex + 1} / {count}
        </div>
      )}
    </div>,
    document.body
  );
}

"use client";

import React, { type CSSProperties, type ButtonHTMLAttributes } from "react";
import NextLink from "next/link";
import { Spinner } from "./spinner";
import {
  Wallet,
  Plus,
  Search,
  Bell,
  ChevronDown,
  ChevronsUpDown,
  Check,
  X,
  Save,
  Eye,
  Calendar,
  CalendarClock,
  CalendarX,
  Clock,
  Send,
  UploadCloud,
  Download,
  RefreshCw,
  MoreHorizontal,
  Filter,
  Inbox,
  Construction,
  Info,
  AlertCircle,
  CheckCircle2,
  Play,
  Link,
  LogOut,
  User,
  Building2,
  Settings2,
  Users,
  Image,
  BarChart3,
  LayoutDashboard,
  LayoutGrid,
  Gem,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  Menu,
  UserPlus,
  UserCheck,
  UserX,
  History,
  MessageSquareText,
  GripVertical,
  type LucideProps,
  Printer,
  FileDown,
  FileText,
  Undo2,
  Smartphone,
  ArrowLeft,
  ArrowRight,
  Home,
  Upload,
  Camera,
  Share2,
  BellRing,
  ClipboardPaste,
  RadioTower,
  PlayCircle,
  RotateCcw,
  Terminal,
  ClipboardCopy,
  ListChecks,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Icon map — avoids dynamic imports, keeps tree-shaking manageable  */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  Plus,
  Search,
  Bell,
  ChevronDown,
  ChevronsUpDown,
  Check,
  X,
  Save,
  Eye,
  Calendar,
  CalendarClock,
  CalendarX,
  Clock,
  Send,
  UploadCloud,
  Download,
  RefreshCw,
  MoreHorizontal,
  Filter,
  Inbox,
  Construction,
  Info,
  AlertCircle,
  CheckCircle2,
  Play,
  Link,
  LogOut,
  User,
  Building2,
  Settings2,
  Users,
  Image,
  BarChart3,
  LayoutDashboard,
  LayoutGrid,
  Gem,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  Menu,
  UserPlus,
  UserCheck,
  UserX,
  History,
  MessageSquareText,
  GripVertical,
  Wallet,
  // เอกสารบริษัท — เมนู ⋯ ในตารางและปุ่มดาวน์โหลด (เพิ่ม 21 ส.ค.)
  Printer,
  FileDown,
  FileText,
  Undo2,
  Smartphone,
  ArrowLeft,
  ArrowRight,
  Home,
  Upload,
  Camera,
  Share2,
  BellRing,
  ClipboardPaste,
  RadioTower,
  PlayCircle,
  RotateCcw,
  Terminal,
  ClipboardCopy,
  ListChecks,
};

/* ------------------------------------------------------------------ */
/*  LucideIcon — render an icon by name string                        */
/* ------------------------------------------------------------------ */

export interface LucideIconProps extends LucideProps {
  name: string;
}

export function LucideIcon({ name, ...rest }: LucideIconProps) {
  const Icon = ICON_MAP[name];
  if (!Icon) {
    // ชื่อที่ไม่มีในตารางเคยหายเงียบ ๆ — เมนูขึ้นแต่ตัวหนังสือ ไม่มีอะไรฟ้อง
    // ว่าพิมพ์ชื่อผิดหรือลืมเพิ่มไอคอน (เจอกับเมนูเอกสารบริษัท 21 ส.ค.)
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[LucideIcon] ไม่มีไอคอนชื่อ "${name}" ใน ICON_MAP — เพิ่มที่ components/aoo/button.tsx`,
      );
    }
    return null;
  }
  return <Icon {...rest} />;
}

/* ------------------------------------------------------------------ */
/*  Button                                                            */
/*                                                                    */
/*  Composes `.aoo-btn` + variant/size modifier classes defined in    */
/*  globals.css. NO inline styles, NO React state — pure CSS handles  */
/*  hover/press/disabled/focus. DevTools shows a clean class list.    */
/*                                                                    */
/*  Callers can still pass `className` (merged) and `style` (escape   */
/*  hatch for one-off geometry like marginTop). Internal visuals are  */
/*  in CSS — change them by editing the .aoo-btn--* rules.            */
/* ------------------------------------------------------------------ */

type IconComponent = React.ComponentType<{ size?: number; strokeWidth?: number }>;

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** ชื่อใน ICON_MAP หรือ component ของ lucide เช่น icon={Camera} */
  icon?: string | IconComponent;
  iconRight?: string | IconComponent;
  /** ใส่แล้วปุ่มเป็นลิงก์ (next/link) หน้าตาเดิม — แทน <Link><Button/></Link> */
  href?: string;
  /** Shows a spinner in place of the icon and disables the button. */
  loading?: boolean;
  /** Escape hatch for one-off geometry (margins, width, etc). Internal
   *  visuals live in globals.css. */
  style?: CSSProperties;
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

function renderIcon(icon: string | IconComponent | undefined, size: number) {
  if (!icon) return null;
  return typeof icon === "string"
    ? <LucideIcon name={icon} size={size} />
    : React.createElement(icon, { size, strokeWidth: 2 });
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    icon,
    iconRight,
    href,
    loading,
    disabled,
    className,
    style: styleProp,
    ...rest
  },
  ref,
) {
  const iconSz = ICON_SIZE[size];
  const classes = [
    "aoo-btn",
    `aoo-btn--${variant}`,
    `aoo-btn--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {loading ? (
        <Spinner size="xs" tone={variant === "primary" || variant === "danger" ? "on-brand" : "brand"} />
      ) : (
        renderIcon(icon, iconSz)
      )}
      {children}
      {renderIcon(iconRight, iconSz)}
    </>
  );

  if (href && !disabled && !loading) {
    return (
      <NextLink href={href} className={classes} style={styleProp} onClick={rest.onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}>
        {content}
      </NextLink>
    );
  }

  return (
    <button ref={ref} {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={classes} style={styleProp}>
      {content}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  IconButton                                                        */
/*                                                                    */
/*  Square button for a single icon. Geometry is controlled via the   */
/*  `--icon-size` CSS variable so any pixel size works without us     */
/*  needing a class per width.                                        */
/* ------------------------------------------------------------------ */

export type IconButtonTone = "ghost" | "sunken" | "danger";

export interface IconButtonProps {
  /** ชื่อใน ICON_MAP หรือส่ง component ของ lucide มาตรง ๆ เช่น icon={Trash2} */
  icon: string | IconComponent;
  /** ป้ายสำหรับ screen reader (ถ้าไม่มี title) */
  "aria-label"?: string;
  type?: "button" | "submit";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  size?: number;
  tone?: IconButtonTone;
  title?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  icon,
  onClick,
  size = 32,
  tone = "ghost",
  title,
  disabled,
  className,
  style: styleProp,
  "aria-label": ariaLabel,
  type = "button",
}, ref) {
  const toneClass =
    tone === "sunken" ? "aoo-btn--icon-sunken"
    : tone === "danger" ? "aoo-btn--ghost aoo-btn--icon-danger"
    : "aoo-btn--ghost";
  const classes = ["aoo-btn", "aoo-btn--icon", toneClass, className]
    .filter(Boolean)
    .join(" ");

  // The icon size scales with the button — half the box, but always at
  // least 14px so a 24px button still has a readable glyph.
  const glyphSize = Math.max(14, Math.round(size * 0.5));

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel ?? title}
      title={title}
      disabled={disabled}
      className={classes}
      style={{
        // `--icon-size` is the one inline declaration we keep — it tells
        // the .aoo-btn--icon class what square dimensions to use.
        ["--icon-size" as string]: `${size}px`,
        ...styleProp,
      }}
      onClick={onClick}
    >
      {typeof icon === "string" ? (
        <LucideIcon name={icon} size={glyphSize} />
      ) : (
        React.createElement(icon, { size: glyphSize, strokeWidth: 2 })
      )}
    </button>
  );
});

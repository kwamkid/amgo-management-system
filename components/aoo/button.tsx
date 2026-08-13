"use client";

import React, { type CSSProperties, type ButtonHTMLAttributes } from "react";
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
} from "lucide-react";

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
};

/* ------------------------------------------------------------------ */
/*  LucideIcon — render an icon by name string                        */
/* ------------------------------------------------------------------ */

export interface LucideIconProps extends LucideProps {
  name: string;
}

export function LucideIcon({ name, ...rest }: LucideIconProps) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
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

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  /** Escape hatch for one-off geometry (margins, width, etc). Internal
   *  visuals live in globals.css. */
  style?: CSSProperties;
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  className,
  style: styleProp,
  ...rest
}: ButtonProps) {
  const iconSz = ICON_SIZE[size];
  const classes = [
    "aoo-btn",
    `aoo-btn--${variant}`,
    `aoo-btn--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...rest} className={classes} style={styleProp}>
      {icon && <LucideIcon name={icon} size={iconSz} />}
      {children}
      {iconRight && <LucideIcon name={iconRight} size={iconSz} />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  IconButton                                                        */
/*                                                                    */
/*  Square button for a single icon. Geometry is controlled via the   */
/*  `--icon-size` CSS variable so any pixel size works without us     */
/*  needing a class per width.                                        */
/* ------------------------------------------------------------------ */

export type IconButtonTone = "ghost" | "sunken";

export interface IconButtonProps {
  icon: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  size?: number;
  tone?: IconButtonTone;
  title?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function IconButton({
  icon,
  onClick,
  size = 32,
  tone = "ghost",
  title,
  disabled,
  className,
  style: styleProp,
}: IconButtonProps) {
  const toneClass =
    tone === "sunken" ? "aoo-btn--icon-sunken" : "aoo-btn--ghost";
  const classes = ["aoo-btn", "aoo-btn--icon", toneClass, className]
    .filter(Boolean)
    .join(" ");

  // The icon size scales with the button — half the box, but always at
  // least 14px so a 24px button still has a readable glyph.
  const glyphSize = Math.max(14, Math.round(size * 0.5));

  return (
    <button
      type="button"
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
      <LucideIcon name={icon} size={glyphSize} />
    </button>
  );
}

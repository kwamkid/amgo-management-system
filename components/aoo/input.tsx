"use client";

import React, {
  type CSSProperties,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Shared tokens                                                      */
/*  Every form control inherits the same height + padding so that      */
/*  Inputs, Selects, and Textareas align in a grid.                    */
/* ------------------------------------------------------------------ */

const CONTROL_HEIGHT = 40;
const CONTROL_PADDING_X = 12;
// Body size (16px). Form controls read at the same size as body text — and
// ≥16px also stops iOS Safari from auto-zooming when an input is focused.
const CONTROL_FONT_SIZE = "var(--fs-body)";

function controlSurface(focused: boolean, error: boolean): CSSProperties {
  return {
    background: "var(--bg-surface)",
    border: `1px solid ${
      error
        ? "var(--ruby-500)"
        : focused
          ? "var(--border-brand)"
          : "var(--border-2)"
    }`,
    borderRadius: "var(--r-md)",
    transition:
      "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
    boxShadow: focused ? "var(--shadow-focus)" : "none",
  };
}

/* ------------------------------------------------------------------ */
/*  Input                                                             */
/* ------------------------------------------------------------------ */

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "style" | "prefix"> {
  /** Element rendered inside the left slot (e.g. icon) */
  prefix?: React.ReactNode;
  /** Whether the input is in an error state */
  error?: boolean;
  style?: CSSProperties;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { prefix, error, className, style: styleProp, ...rest },
    ref,
  ) {
    const [focused, setFocused] = React.useState(false);

    const wrapStyle: CSSProperties = {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: CONTROL_HEIGHT,
      paddingInline: CONTROL_PADDING_X,
      ...controlSurface(focused, !!error),
      ...styleProp,
    };

    const inputStyle: CSSProperties = {
      flex: 1,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: CONTROL_FONT_SIZE,
      color: "var(--fg-1)",
      lineHeight: 1,
      padding: 0,
      width: "100%",
      minWidth: 0,
    };

    return (
      <div className={className} style={wrapStyle}>
        {prefix && (
          <span style={{ color: "var(--fg-4)", display: "flex", flexShrink: 0 }}>
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          {...rest}
          style={inputStyle}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Select                                                            */
/*  - Same height + padding as Input                                  */
/*  - Custom Lucide chevron positioned with comfortable right margin   */
/*    (native arrows hug the right edge too tightly on most browsers)  */
/* ------------------------------------------------------------------ */

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "style"> {
  error?: boolean;
  style?: CSSProperties;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { error, className, style: styleProp, children, ...rest },
    ref,
  ) {
    const [focused, setFocused] = React.useState(false);

    const wrapStyle: CSSProperties = {
      position: "relative",
      display: "block",
      height: CONTROL_HEIGHT,
      ...controlSurface(focused, !!error),
      ...styleProp,
    };

    const selectStyle: CSSProperties = {
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      width: "100%",
      height: "100%",
      padding: `0 36px 0 ${CONTROL_PADDING_X}px`,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: CONTROL_FONT_SIZE,
      color: "var(--fg-1)",
      lineHeight: 1,
      cursor: "pointer",
    };

    return (
      <div className={className} style={wrapStyle}>
        <select
          ref={ref}
          {...rest}
          style={selectStyle}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--fg-3)",
            pointerEvents: "none",
          }}
          aria-hidden
        />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Textarea                                                          */
/* ------------------------------------------------------------------ */

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "style"> {
  error?: boolean;
  style?: CSSProperties;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { error, className, style: styleProp, rows = 4, ...rest },
    ref,
  ) {
    const [focused, setFocused] = React.useState(false);

    const wrapStyle: CSSProperties = {
      padding: `10px ${CONTROL_PADDING_X}px`,
      ...controlSurface(focused, !!error),
      ...styleProp,
    };

    const textareaStyle: CSSProperties = {
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: CONTROL_FONT_SIZE,
      color: "var(--fg-1)",
      lineHeight: "var(--lh-normal)",
      padding: 0,
      resize: "vertical",
      minHeight: 24,
    };

    return (
      <div className={className} style={wrapStyle}>
        <textarea
          ref={ref}
          rows={rows}
          {...rest}
          style={textareaStyle}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Field — wraps label + control + help/error text                   */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  /** Label text shown above the input */
  label?: string;
  /**
   * Optional content rendered on the right side of the label row — use for
   * inline secondary controls (small toggles, "manage X" links, counts)
   * that belong to the field but would otherwise need their own row.
   * Interactive children should call stopPropagation if the wrapper is a
   * <label>; this slot is rendered next to the label text, so clicking it
   * counts as a click on the label-bound control. Pair with `asDiv` to
   * decouple cleanly.
   */
  labelExtra?: React.ReactNode;
  /** Help text shown below the input (muted) */
  help?: string;
  /** Error message shown below the input (replaces help when present) */
  error?: string;
  /** Marks the label with an asterisk */
  required?: boolean;
  /**
   * Render the wrapper as a plain <div> instead of a <label>. Use this when
   * the children include a file input or anything else where clicking the
   * help/label text shouldn't be treated as a click on the control —
   * MediaDropzone is the main caller. Default false.
   */
  asDiv?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Field({
  label,
  labelExtra,
  help,
  error,
  required,
  asDiv = false,
  children,
  className,
  style: styleProp,
}: FieldProps) {
  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    ...styleProp,
  };

  const labelStyle: CSSProperties = {
    fontSize: "var(--fs-meta)",
    fontWeight: 600,
    color: "var(--fg-2)",
  };

  const msgStyle: CSSProperties = {
    fontSize: "var(--fs-micro)",
    color: error ? "var(--ruby-500)" : "var(--fg-4)",
    marginTop: 2,
  };

  const labelNode = label && (
    <span className="aoo-field-label" style={labelStyle}>
      {label}
      {required && (
        <span aria-hidden style={{ color: "var(--ruby-500)", marginLeft: 4 }}>
          *
        </span>
      )}
    </span>
  );

  const labelRow = (label || labelExtra) && (
    labelExtra ? (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {labelNode ?? <span />}
        {labelExtra}
      </span>
    ) : (
      labelNode
    )
  );

  const body = (
    <>
      {labelRow}
      {children}
      {(error || help) && <span style={msgStyle}>{error ?? help}</span>}
    </>
  );

  if (asDiv) {
    return (
      <div className={className} style={rootStyle}>
        {body}
      </div>
    );
  }

  return (
    <label className={className} style={rootStyle}>
      {body}
    </label>
  );
}

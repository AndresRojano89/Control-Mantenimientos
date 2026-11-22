import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ Button */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-sm",
  secondary: "bg-primary-soft text-primary hover:bg-[#d7e4f1]",
  outline: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-muted hover:bg-neutral-soft hover:text-foreground",
  danger: "bg-danger text-white hover:bg-[#962c25] shadow-sm",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
  icon: "h-10 w-10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-55",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

/* ------------------------------------------------------------------ Inputs */
const fieldBase =
  "w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-[#8a96a3] " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-soft disabled:text-muted";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(fieldBase, "py-2", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(fieldBase, "h-10 pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  htmlFor,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Card */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgb(16_24_40/0.04)]", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Badge */
export type BadgeTone = "neutral" | "primary" | "info" | "success" | "warning" | "danger";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-neutral-soft text-muted",
  primary: "bg-primary-soft text-primary",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};
export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Page header */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Empty state */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {Icon && (
        <div className="mb-1 rounded-full bg-neutral-soft p-3">
          <Icon className="h-6 w-6 text-muted" />
        </div>
      )}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Table */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("border-b border-border bg-surface-muted px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border px-4 py-3 align-top", className)} {...props} />;
}
/** Lista de tarjetas que reemplaza la tabla en móvil. */
export function MobileList({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("divide-y divide-border md:hidden", className)} {...props} />;
}

/* ------------------------------------------------------------------ Misc */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: BadgeTone;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneText: Record<BadgeTone, string> = {
    neutral: "text-muted",
    primary: "text-primary",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", toneText[tone])} />}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  icon: Icon,
  className,
}: {
  tone?: BadgeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "border-border bg-surface-muted text-foreground",
    primary: "border-primary/25 bg-primary-soft text-foreground",
    info: "border-info/25 bg-info-soft text-foreground",
    success: "border-success/25 bg-success-soft text-foreground",
    warning: "border-warning/30 bg-warning-soft text-foreground",
    danger: "border-danger/30 bg-danger-soft text-foreground",
  };
  return (
    <div className={cn("flex gap-3 rounded-md border px-3.5 py-3 text-sm", tones[tone], className)} role="status">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-muted")}>{children}</div>}
      </div>
    </div>
  );
}

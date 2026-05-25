import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const buttonBase =
  "inline-flex items-center justify-center rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800/25 disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-red-800 text-white shadow-sm hover:bg-red-900",
  secondary: "bg-red-800 text-white shadow-sm hover:bg-red-900",
  outline: "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: PropsWithChildren<ButtonProps>) {
  return (
    <button className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: PropsWithChildren<ButtonLinkProps>) {
  return (
    <Link
      href={href}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

interface CardProps {
  className?: string;
}

export function Card({ className, children }: PropsWithChildren<CardProps>) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white p-5 shadow-sm", className)}>
      {children}
    </section>
  );
}

interface BadgeProps {
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
  className?: string;
}

const badgeTones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
  info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  accent: "bg-red-100 text-red-800",
};

export function Badge({ tone = "neutral", className, children }: PropsWithChildren<BadgeProps>) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: "default" | "accent" | "success" | "warning";
}

const statTone: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "border-slate-200",
  accent: "border-red-100 bg-red-50/60",
  success: "border-emerald-100 bg-emerald-50/60",
  warning: "border-amber-100 bg-amber-50/60",
};

export function StatCard({ label, value, helper, tone = "default" }: StatCardProps) {
  return (
    <Card className={cn("space-y-2", statTone[tone])}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="font-heading text-2xl font-semibold text-ink">{value}</p>
      {helper ? <p className="text-sm text-slate-600">{helper}</p> : null}
    </Card>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn("py-10 text-center", className)}>
      <h2 className="font-heading text-xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function PageHero({ eyebrow, title, description, actions, aside, className }: PageHeroProps) {
  return (
    <section className={cn("grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_360px] lg:p-7", className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-800">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl font-heading text-3xl font-semibold leading-tight text-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
        {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {aside ? <div className="lg:pl-4">{aside}</div> : null}
    </section>
  );
}

interface NoticeProps {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
  className?: string;
}

const noticeTones: Record<NonNullable<NoticeProps["tone"]>, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-700",
};

export function Notice({ tone = "info", children, className }: NoticeProps) {
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm leading-6", noticeTones[tone], className)}>
      {children}
    </div>
  );
}

export const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-800 focus:ring-2 focus:ring-red-800/10 disabled:bg-slate-100 disabled:text-slate-500";

interface FieldProps {
  label: string;
  children: ReactNode;
  helper?: string;
  className?: string;
}

export function Field({ label, children, helper, className }: FieldProps) {
  return (
    <label className={cn("grid gap-2 text-sm font-semibold text-slate-700", className)}>
      {label}
      {children}
      {helper ? <span className="text-xs font-normal leading-5 text-slate-500">{helper}</span> : null}
    </label>
  );
}

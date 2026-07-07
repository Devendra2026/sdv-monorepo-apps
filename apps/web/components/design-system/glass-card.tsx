import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

type GlassVariant = "default" | "elevated" | "accent" | "ai";

const variants: Record<GlassVariant, string> = {
  default: "premium-card",
  elevated: "premium-card shadow-premium-lg",
  accent:
    "premium-card bg-gradient-to-br from-brand-navy/[0.04] via-card to-brand-red/[0.03] dark:from-brand-navy/[0.12] dark:via-card dark:to-brand-red/[0.06] border-brand-navy/10 dark:border-brand-red/15",
  ai: "premium-card bg-gradient-to-br from-brand-navy/[0.06] via-card to-brand-red/[0.04] dark:from-brand-navy/[0.14] dark:via-card dark:to-brand-red/[0.08] border-brand-red/20",
};

export function GlassCard({
  children,
  className,
  variant = "default",
  hover = false,
  padding = "md",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  variant?: GlassVariant;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  as?: "div" | "section" | "article";
}) {
  const paddingClass = {
    none: "",
    sm: "p-4",
    md: "p-5 lg:p-6",
    lg: "p-6 lg:p-8",
  }[padding];

  return (
    <Tag
      className={cn(
        "relative overflow-hidden rounded-2xl",
        variants[variant],
        hover &&
          "cursor-pointer transition-all duration-200 hover:border-brand-red/25 hover:shadow-premium-lg dark:hover:border-brand-red/30",
        paddingClass,
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function GlassCardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-navy/8 text-brand-navy ring-1 ring-brand-navy/10 dark:bg-brand-navy/20 dark:text-primary dark:ring-brand-navy/20">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

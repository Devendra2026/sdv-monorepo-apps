import { GlassCard } from "@/components/design-system/glass-card";
import { cn } from "@workspace/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const HERO_GRADIENTS = {
  navy: "from-brand-navy/12 via-brand-navy/5 to-brand-red/6 dark:from-brand-navy/30 dark:via-brand-navy/15 dark:to-brand-red/10",
  amber:
    "from-amber-500/15 via-orange-500/8 to-yellow-500/10 dark:from-amber-500/25 dark:via-orange-500/15 dark:to-yellow-500/10",
  red: "from-brand-red/12 via-brand-red/6 to-brand-navy/8 dark:from-brand-red/20 dark:via-brand-red/10 dark:to-brand-navy/15",
  brand: "from-brand-navy/10 via-card/90 to-brand-red/8 dark:from-brand-navy/25 dark:via-card/60 dark:to-brand-red/12",
} as const;

export function ExecutiveHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  gradient = "navy",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  gradient?: keyof typeof HERO_GRADIENTS;
  className?: string;
}) {
  return (
    <GlassCard
      variant="accent"
      padding="lg"
      className={cn("brand-pixel-pattern bg-linear-to-br shadow-premium-lg", HERO_GRADIENTS[gradient], className)}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-navy/8 blur-3xl dark:bg-brand-navy/20" />
      <div className="pointer-events-none absolute -bottom-12 left-1/4 h-32 w-32 rounded-full bg-brand-red/8 blur-2xl dark:bg-brand-red/15" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {eyebrow && (
            <div className="flex items-center gap-2">
              {Icon && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/30 dark:text-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
              )}
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-red">{eyebrow}</span>
            </div>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </GlassCard>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h2
          id={id}
          className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-brand-navy/70 dark:text-primary/80"
        >
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground/90">{description}</p>}
      </div>
      {action}
    </div>
  );
}

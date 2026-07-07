"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { FadeIn } from "@/components/design-system/motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function UserWorkspaceSection({
  title,
  description,
  icon,
  action,
  children,
  className,
  delay = 0,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const Icon = icon;
  return (
    <FadeIn delay={delay}>
      <GlassCard padding="sm" className={cn("border-border/70 shadow-premium-sm", className)}>
        <GlassCardHeader
          title={title}
          description={description}
          icon={Icon ? <Icon className="h-4 w-4" aria-hidden /> : undefined}
          action={action}
          className="mb-3"
        />
        {children}
      </GlassCard>
    </FadeIn>
  );
}

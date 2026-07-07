"use client";

import { ExecutiveHero, SectionHeader } from "@/components/design-system/executive-hero";
import { MetricCard } from "@/components/design-system/metric-card";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/design-system/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Key, RefreshCw, Shield, ShieldCheck, Sparkles } from "lucide-react";

export function RolesHero({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  return (
    <FadeIn>
      <ExecutiveHero
        eyebrow="RBAC"
        title="Roles & Permissions"
        description="Define who can do what on web and mobile. Changes apply after the next capability sync."
        icon={ShieldCheck}
        gradient="brand"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={onSeed}
            disabled={seeding}
            className="cursor-pointer rounded-xl border-border/60 bg-background/80 backdrop-blur-sm"
          >
            <RefreshCw className={cn("h-4 w-4", seeding && "animate-spin")} aria-hidden />
            Refresh system RBAC
          </Button>
        }
      />
    </FadeIn>
  );
}

export function RolesMetricsSection({
  roleCount,
  activeCount,
  customCount,
  permCount,
  loaded,
}: {
  roleCount: number;
  activeCount: number;
  customCount: number;
  permCount: number;
  loaded: boolean;
}) {
  return (
    <section aria-labelledby="roles-kpi-heading">
      <SectionHeader
        id="roles-kpi-heading"
        title="RBAC Metrics"
        description="System and custom roles with permission coverage"
        className="mb-4"
      />
      <StaggerGrid className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StaggerItem>
          <MetricCard label="Roles" value={loaded ? roleCount : "—"} hint="system + custom" icon={Shield} tone="info" />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Active"
            value={loaded ? activeCount : "—"}
            hint="assignable today"
            icon={ShieldCheck}
            tone="success"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Custom"
            value={loaded ? customCount : "—"}
            hint="tenant-defined"
            icon={Sparkles}
            tone="warning"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Permissions"
            value={loaded ? permCount : "—"}
            hint="capability keys"
            icon={Key}
            tone="ai"
          />
        </StaggerItem>
      </StaggerGrid>
    </section>
  );
}

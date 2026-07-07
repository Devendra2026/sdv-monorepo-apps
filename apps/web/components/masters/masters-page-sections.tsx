"use client";

import { ExecutiveHero, SectionHeader } from "@/components/design-system/executive-hero";
import { MetricCard } from "@/components/design-system/metric-card";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/design-system/motion";
import { Building2, Database, Layers, MapPin } from "lucide-react";

export function MastersHero() {
  return (
    <FadeIn>
      <ExecutiveHero
        eyebrow="Configuration"
        title="Master Data Hub"
        description="Configure dropdown reference values and the geographic tenant hierarchy used across surveys and user assignments."
        icon={Database}
        gradient="brand"
      />
    </FadeIn>
  );
}

export function MastersMetricsSection({
  activeTab,
  categories,
  tenantStats,
}: {
  activeTab: "masters" | "tenants" | "tax-rates";
  categories: number;
  tenantStats: { districts: number; ulbs: number; wards: number } | null;
}) {
  const metrics =
    activeTab === "masters"
      ? [
          {
            label: "Categories",
            value: categories,
            hint: "Survey dropdown fields",
            icon: Layers,
            tone: "warning" as const,
          },
          {
            label: "Reference Data",
            value: "Live",
            hint: "Syncs to open forms",
            icon: Database,
            tone: "info" as const,
          },
          {
            label: "Districts",
            value: tenantStats?.districts ?? "—",
            hint: "Geographic hierarchy",
            icon: MapPin,
            tone: "success" as const,
          },
          {
            label: "ULBs",
            value: tenantStats?.ulbs ?? "—",
            hint: `${tenantStats?.wards ?? "—"} wards total`,
            icon: Building2,
            tone: "ai" as const,
          },
        ]
      : [
          {
            label: "Districts",
            value: tenantStats?.districts ?? "—",
            hint: "Top-level geography",
            icon: MapPin,
            tone: "info" as const,
          },
          {
            label: "ULBs",
            value: tenantStats?.ulbs ?? "—",
            hint: "Municipal councils & town panchayats",
            icon: Building2,
            tone: "success" as const,
          },
          {
            label: "Wards",
            value: tenantStats?.wards ?? "—",
            hint: "Lowest assignment unit",
            icon: Layers,
            tone: "warning" as const,
          },
          {
            label: "Categories",
            value: categories,
            hint: "Reference dropdown fields",
            icon: Database,
            tone: "muted" as const,
          },
        ];

  return (
    <section aria-labelledby="masters-kpi-heading">
      <SectionHeader
        id="masters-kpi-heading"
        title="Master Data Metrics"
        description={activeTab === "masters" ? "Reference values and geographic coverage" : "Tenant hierarchy overview"}
        className="mb-4"
      />
      <StaggerGrid className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {metrics.map((m) => (
          <StaggerItem key={m.label}>
            <MetricCard label={m.label} value={m.value} hint={m.hint} icon={m.icon} tone={m.tone} />
          </StaggerItem>
        ))}
      </StaggerGrid>
    </section>
  );
}

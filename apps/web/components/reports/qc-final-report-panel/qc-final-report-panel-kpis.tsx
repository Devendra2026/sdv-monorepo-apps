"use client";

import { MetricCard } from "@/components/design-system/metric-card";
import { StaggerGrid, StaggerItem } from "@/components/design-system/motion";
import { CheckCircle2, MapPin, ShieldCheck } from "lucide-react";

export function QcFinalReportPanelKpis({
  propertyCount,
  wardCount,
  reportDateLabel,
}: {
  propertyCount: number;
  wardCount: number;
  reportDateLabel: string;
}) {
  return (
    <StaggerGrid className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      <StaggerItem>
        <MetricCard
          label="QC Approved (page)"
          value={propertyCount.toLocaleString()}
          hint="Properties on this page"
          icon={CheckCircle2}
          tone="success"
        />
      </StaggerItem>
      <StaggerItem>
        <MetricCard
          label="Wards (page)"
          value={wardCount.toLocaleString()}
          hint="Ward groups on this page"
          icon={MapPin}
          tone="info"
        />
      </StaggerItem>
      <StaggerItem>
        <MetricCard
          label="Report Date"
          value={reportDateLabel}
          hint="Document generation date"
          icon={ShieldCheck}
          tone="default"
        />
      </StaggerItem>
    </StaggerGrid>
  );
}

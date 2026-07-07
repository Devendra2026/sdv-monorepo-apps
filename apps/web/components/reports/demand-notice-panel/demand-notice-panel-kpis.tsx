"use client";

import { MetricCard } from "@/components/design-system/metric-card";
import { formatInr } from "@/lib/qc/demand-estimate";
import { Building2, Calculator, IndianRupee } from "lucide-react";

export function DemandNoticePanelKpis({
  propertyCount,
  totalAnnualDemand,
  avgDemand,
}: {
  propertyCount: number;
  totalAnnualDemand: number;
  avgDemand: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard label="Properties (page)" value={propertyCount} icon={Building2} />
      <MetricCard label="Total Annual Demand" value={formatInr(totalAnnualDemand)} icon={IndianRupee} tone="warning" />
      <MetricCard
        label="Average Demand"
        value={propertyCount > 0 ? formatInr(avgDemand) : "—"}
        icon={Calculator}
        tone="info"
      />
    </div>
  );
}

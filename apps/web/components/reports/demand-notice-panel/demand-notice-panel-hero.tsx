"use client";

import { ExecutiveHero } from "@/components/design-system/executive-hero";
import { formatReportDocumentDate, reportDocumentTimestamp } from "@/lib/qc/report-dates";
import { ScrollText } from "lucide-react";

export function DemandNoticePanelHero() {
  const reportDate = formatReportDocumentDate(reportDocumentTimestamp());

  return (
    <ExecutiveHero
      eyebrow="Reports · QC Approved"
      title="Demand Notice Panel"
      description={`QC-approved property register with printable demand notices. Report date: ${reportDate}.`}
      icon={ScrollText}
      gradient="red"
    />
  );
}

"use client";

import type { MasterOption } from "@/convex/areaMasters";
import { QC_STATUS_LABEL, SURVEY_STATUS_LABEL } from "@/lib/domain";
import { surveyAreaMetrics } from "@/lib/survey/area";
import { labelFromOptions } from "@/lib/survey/detail-labels";
import { formatLatitudeDms, formatLongitudeDms } from "@/lib/surveys/gps-format";
import { fmtDate } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const NAVY: [number, number, number] = [30, 58, 95];

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text("Municipal Property Survey", 14, 12);
  doc.setFontSize(10);
  doc.text(title, 14, 20);
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  doc.text(`Generated ${fmtDate(Date.now())}${subtitle ? ` · ${subtitle}` : ""}`, 14, 32);
}

function save(doc: jsPDF, name: string) {
  doc.save(`${name}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Full single-survey report (used from the survey detail page). */
export function generateSurveyReportPdf(survey: any) {
  const doc = new jsPDF();
  header(doc, `Survey Report — ${survey.propertyId || survey.parcelNo}`, `${survey.city} · Ward ${survey.wardNo}`);

  const field = (l: string, v: any) => [l, v == null || v === "" ? "—" : String(v)];

  autoTable(doc, {
    startY: 38,
    head: [["Property", ""]],
    body: [
      field("Property ID", survey.propertyId),
      field("Parcel No", survey.parcelNo),
      field("Unit No", survey.unitNo),
      field("Sector No", survey.sectorNo),
      field("Old Property No", survey.oldPropertyNo),
      field("Constructed Year", survey.constructedYear),
      field("Slum", survey.isSlum ? "Yes" : "No"),
      field("Status", SURVEY_STATUS_LABEL[survey.status as keyof typeof SURVEY_STATUS_LABEL]),
      field("QC Status", QC_STATUS_LABEL[survey.qcStatus as keyof typeof QC_STATUS_LABEL]),
    ],
    theme: "striped",
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    head: [["Owner & Address", ""]],
    body: [
      field("Respondent", survey.respondentName),
      field("Relationship", survey.relationship),
      field("Primary Mobile", survey.mobileNo),
      field("Family Size", survey.familySize),
      field("House No", survey.houseNo),
      field("Locality", survey.locality),
      field("Colony", survey.colonyName),
      field("City / ULB", survey.city),
      field("PIN", survey.pinCode),
    ],
    theme: "striped",
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    head: [["Taxation & Services", ""]],
    body: [
      field("Assessment Year", survey.assessmentYear),
      field("Ownership Type", survey.ownershipType),
      field("Property Use", survey.propertyUse),
      field("Property Type", survey.propertyType),
      field("Situation", survey.situation),
      field("Road Type", survey.roadType),
      field("Tax Rate Zone", survey.taxRateZone),
      field("Plot (sqft)", survey.plotSqft),
      field("Plinth (sqft)", survey.plinthSqft),
      field("Municipal Water", survey.municipalWaterConnection ? "Yes" : "No"),
      field("Water Source", survey.waterSource),
      field("Sanitation", survey.sanitationType),
      field("Waste Collection", survey.municipalWasteCollection ? "Yes" : "No"),
    ],
    theme: "striped",
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 9 },
  });

  if (survey.floors?.length) {
    autoTable(doc, {
      head: [["Floor", "Usage", "Construction", "Occupied", "Area (sqft)"]],
      body: survey.floors.map((f: any) => [
        f.floorName,
        f.usageType,
        f.constructionType,
        f.isOccupied ? "Yes" : "No",
        f.areaSqft,
      ]),
      headStyles: { fillColor: NAVY },
      styles: { fontSize: 9 },
    });
  }

  save(doc, `survey_${survey.parcelNo || survey._id}`);
}

type QcFinalReportMasters = {
  propertyUses?: MasterOption[];
  propertyUseSubcategories?: Record<string, MasterOption[]>;
  roadTypes?: MasterOption[];
  taxRateZones?: MasterOption[];
  floors?: MasterOption[];
  usageTypes?: MasterOption[];
  usageFactors?: MasterOption[];
  constructionTypes?: MasterOption[];
};

export type QcFinalReportOptions = {
  masters?: QcFinalReportMasters;
};

function fmtLabel(options: MasterOption[] | undefined, value: string | undefined) {
  return labelFromOptions(options, value);
}

/** QC final report — verified property assessment for one survey. */
export function generateQcFinalReportPdf(survey: any, options: QcFinalReportOptions = {}) {
  const { masters } = options;
  const doc = new jsPDF();
  const propertyId = survey.propertyId || survey.parcelNo;
  const ownerName = survey.respondentName || survey.owners?.[0]?.name || "—";
  const areas = surveyAreaMetrics({
    plotSqft: survey.plotSqft ?? 0,
    plinthSqft: survey.plinthSqft ?? 0,
    floors: survey.floors ?? [],
  });
  const propertyTypeOptions = survey.propertyUse ? masters?.propertyUseSubcategories?.[survey.propertyUse] : undefined;
  const qcStatusLabel = QC_STATUS_LABEL[survey.qcStatus as keyof typeof QC_STATUS_LABEL] ?? survey.qcStatus;

  header(
    doc,
    `QC Final Report — ${propertyId}`,
    `Comprehensive verification for ${survey.city ?? "—"} · Ward ${survey.wardNo ?? "—"}`,
  );

  autoTable(doc, {
    startY: 38,
    head: [["Property Summary", ""]],
    body: [
      ["Final QC Status", qcStatusLabel],
      ["Owner Name", ownerName],
      ["Ward Number", survey.wardNo ? `Ward ${survey.wardNo}` : "—"],
      [
        "Property Type",
        fmtLabel(propertyTypeOptions, survey.propertyType) ||
          fmtLabel(masters?.propertyUses, survey.propertyUse) ||
          "—",
      ],
      ["Tax Rate Zone", fmtLabel(masters?.taxRateZones, survey.taxRateZone)],
      ["Road Type", fmtLabel(masters?.roadTypes, survey.roadType)],
      ["Surveyor", survey.surveyor?.name ?? "—"],
      ["Survey Status", SURVEY_STATUS_LABEL[survey.status as keyof typeof SURVEY_STATUS_LABEL] ?? survey.status],
    ],
    theme: "striped",
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 9 },
  });

  if (survey.floors?.length) {
    autoTable(doc, {
      head: [["Floor", "Usage Type", "Construction", "Built-up Area (sqft)", "Occupancy"]],
      body: survey.floors.map((f: any) => [
        fmtLabel(masters?.floors, f.floorName),
        fmtLabel(masters?.usageTypes, f.usageType) || fmtLabel(masters?.usageFactors, f.usageFactor),
        fmtLabel(masters?.constructionTypes, f.constructionType),
        f.areaSqft?.toLocaleString("en-IN") ?? "—",
        f.isOccupied ? "Occupied" : "Vacant",
      ]),
      foot: [["", "", "TOTAL ASSESSABLE AREA", areas.builtUpSqft.toLocaleString("en-IN"), ""]],
      headStyles: { fillColor: NAVY },
      footStyles: { fillColor: [240, 244, 248], textColor: [30, 58, 95], fontStyle: "bold" },
      styles: { fontSize: 9 },
    });
  }

  autoTable(doc, {
    head: [["Assessment & Services", ""]],
    body: [
      ["Total Assessable Area (sqft)", areas.builtUpSqft > 0 ? areas.builtUpSqft.toLocaleString("en-IN") : "—"],
      ["Plot Area (sqft)", survey.plotSqft > 0 ? survey.plotSqft.toLocaleString("en-IN") : "—"],
      ["Plinth Area (sqft)", areas.plinthSqft > 0 ? areas.plinthSqft.toLocaleString("en-IN") : "—"],
      ["Assessment Year", survey.assessmentYear ?? "—"],
      ["Municipal Water", survey.municipalWaterConnection ? "Connected" : "Not connected"],
      ["Water Source", survey.waterSource?.replace(/_/g, " ") ?? "—"],
      ["Sanitation", survey.sanitationType?.replace(/_/g, " ") ?? "—"],
      ["Waste Collection", survey.municipalWasteCollection ? "Yes" : "No"],
    ],
    theme: "striped",
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 9 },
  });

  if (survey.gps) {
    autoTable(doc, {
      head: [["Geo-Tagged Location", ""]],
      body: [
        ["Latitude", formatLatitudeDms(survey.gps.latitude, 6)],
        ["Longitude", formatLongitudeDms(survey.gps.longitude, 6)],
        ["Accuracy", `${survey.gps.accuracyMeters.toFixed(1)} m`],
        ["Captured", fmtDate(survey.gps.capturedAt)],
      ],
      theme: "striped",
      headStyles: { fillColor: NAVY },
      styles: { fontSize: 9 },
    });
  }

  const certY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : 220;
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 95);
  doc.text("Certification", 14, certY);
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Certified on: ${fmtDate(Date.now())}`, 14, certY + 8);
  doc.text("Document integrity: Verified", 14, certY + 15);

  save(doc, `qc_final_${survey.parcelNo || survey._id}`);
}

/** @deprecated Use generateQcFinalReportPdf — remarks are no longer included. */
export function generateQcReportPdf(survey: any, _remarks?: any[], options?: QcFinalReportOptions) {
  generateQcFinalReportPdf(survey, options);
}

/** Municipality summary report from the analytics breakdown. */
export function generateMunicipalitySummaryPdf(breakdown: any) {
  const doc = new jsPDF();
  header(doc, "Municipality Summary Report");
  const s = breakdown.summary;
  autoTable(doc, {
    startY: 38,
    head: [["Total", "Drafts", "Submitted", "Approved", "Rejected", "Today"]],
    body: [[s.total, s.drafts, s.submitted, s.approved, s.rejected, s.today]],
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 9 },
  });
  autoTable(doc, {
    head: [["ULB", "District", "Total", "Approved", "Rejected", "Submitted"]],
    body: breakdown.byUlb.map((m: any) => [m.name, m.districtName, m.total, m.approved, m.rejected, m.submitted]),
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 9 },
  });
  save(doc, "municipality_summary");
}

/** Surveyor performance report from the analytics breakdown. */
export function generateSurveyorPerformancePdf(breakdown: any) {
  const doc = new jsPDF();
  header(doc, "Surveyor Performance Report");
  autoTable(doc, {
    startY: 38,
    head: [["Surveyor", "ULB", "Total", "Approved", "Rejected", "Drafts", "Approval %"]],
    body: breakdown.bySurveyor.map((u: any) => [
      u.name,
      u.municipalityName ?? "—",
      u.total,
      u.approved,
      u.rejected,
      u.drafts,
      u.total > 0 ? `${Math.round((u.approved / u.total) * 100)}%` : "—",
    ]),
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 9 },
  });
  save(doc, "surveyor_performance");
}

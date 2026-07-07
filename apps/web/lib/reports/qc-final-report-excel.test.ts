import type { SurveyExportBundle } from "@/lib/survey/survey-excel";
import { describe, expect, it } from "vitest";
import {
  buildQcFinalReportExcelFilename,
  bundlesToQcFinalReportRows,
  bundleToQcFinalReportRow,
  QC_FINAL_REPORT_SHEET,
  qcFinalReportWorkbookSheetNames,
} from "./qc-final-report-excel";

function sampleBundle(overrides: Partial<SurveyExportBundle> = {}): SurveyExportBundle {
  return {
    _id: "survey1",
    localId: "local-1",
    propertyId: "AGR001W01P001U01R",
    districtId: "district1",
    municipalityId: "muni1",
    districtName: "Agra",
    municipalityName: "Agra MC",
    municipalityCode: "AGR",
    surveyorName: "Test Surveyor",
    wardNo: "01",
    parcelNo: "P001",
    unitNo: "U01",
    isSlum: false,
    mobileNo: "9999999999",
    locality: "Civil Lines",
    colonyName: "Colony",
    city: "Agra",
    pinCode: "282001",
    assessmentYear: "2024-25",
    ownershipType: "owner",
    propertyType: "residential",
    propertyUse: "residential",
    situation: "main_road",
    roadType: "pucca",
    taxRateZone: "zone_a",
    plotSqft: 1200,
    plinthSqft: 1000,
    municipalWaterConnection: true,
    waterSource: "municipal",
    sanitationType: "septic",
    municipalWasteCollection: true,
    status: "submitted",
    qcStatus: "approved",
    serverVersion: 1,
    clientUpdatedAt: 1_700_000_000_000,
    submittedAt: 1_700_000_100_000,
    _creationTime: 1_699_000_000_000,
    respondentName: "Ramesh Kumar",
    floors: [
      {
        clientFloorId: "f1",
        position: 0,
        floorName: "ground",
        usageType: "residential",
        constructionType: "pucca",
        isOccupied: true,
        areaSqft: 1000,
      },
    ],
    ...overrides,
  };
}

describe("qc-final-report-excel", () => {
  it("produces exactly one worksheet", () => {
    const rows = bundlesToQcFinalReportRows([sampleBundle()], new Map([["muni1", "AGR"]]));
    expect(qcFinalReportWorkbookSheetNames(rows)).toEqual([QC_FINAL_REPORT_SHEET]);
  });

  it("filters out non-approved surveys", () => {
    const rows = bundlesToQcFinalReportRows(
      [sampleBundle(), sampleBundle({ _id: "survey2", qcStatus: "pending" })],
      new Map([["muni1", "AGR"]]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["QC Status"]).toBe("Approved");
  });

  it("maps register and tax summary columns", () => {
    const row = bundleToQcFinalReportRow(sampleBundle(), new Map([["muni1", "AGR"]]));
    expect(row["Property ID"]).toBeTruthy();
    expect(row.Owner).toBe("Ramesh Kumar");
    expect(row.Ward).toBe("01");
    expect(row.Parcel).toBe("P001");
    expect(row["Assessable sqft"]).toBeGreaterThan(0);
    expect(row["Total Annual Demand"]).toBeGreaterThanOrEqual(0);
    expect(row.Surveyor).toBe("Test Surveyor");
  });

  it("builds a scoped filename", () => {
    expect(buildQcFinalReportExcelFilename({ municipalityLabel: "Agra MC", wardNo: "3", date: "2026-06-23" })).toBe(
      "qc_final_report_Agra_MC_ward-3_2026-06-23.xlsx",
    );
  });
});

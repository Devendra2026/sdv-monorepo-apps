import type { FloorRow, SurveyDetail } from "@/schema/surveys/index";
import { describe, expect, it } from "vitest";
import { computeDemandNotice } from "./demand-notice";

function minimalSurvey(overrides: Partial<SurveyDetail> = {}): SurveyDetail {
  return {
    wardNo: "01",
    taxRateZone: "below_9m",
    propertyUse: "open_land",
    municipalWaterConnection: true,
    ...overrides,
  } as SurveyDetail;
}

function openLandFloor(areaSqft: number): FloorRow {
  return {
    floorName: "open_land",
    constructionType: "open_land_plot",
    areaSqft,
    usageType: "open",
    usageFactor: "open",
  } as FloorRow;
}

function buildingFloor(areaSqft: number): FloorRow {
  return {
    floorName: "ground",
    constructionType: "pakka_rcc_rb",
    areaSqft,
    usageType: "residential_self",
    usageFactor: "residential",
  } as FloorRow;
}

describe("computeDemandNotice open land service taxes", () => {
  it("zero water and drainage when property use is open_land", () => {
    const notice = computeDemandNotice(minimalSurvey(), [openLandFloor(1000)]);
    expect(notice.propertyTax).toBeGreaterThan(0);
    expect(notice.waterTax).toBe(0);
    expect(notice.drainageTax).toBe(0);
    expect(notice.totalAnnualDemand).toBe(notice.propertyTax);
  });

  it("charges water and drainage for residential building with water connection", () => {
    const notice = computeDemandNotice(minimalSurvey({ propertyUse: "residential", municipalWaterConnection: true }), [
      buildingFloor(1000),
    ]);
    expect(notice.waterTax).toBeGreaterThan(0);
    expect(notice.drainageTax).toBeGreaterThan(0);
    expect(notice.totalAnnualDemand).toBeGreaterThan(notice.propertyTax);
  });

  it("charges water and drainage for mixed built-up and open land", () => {
    const notice = computeDemandNotice(minimalSurvey({ propertyUse: "residential", municipalWaterConnection: true }), [
      buildingFloor(800),
      openLandFloor(200),
    ]);
    expect(notice.waterTax).toBeGreaterThan(0);
    expect(notice.drainageTax).toBeGreaterThan(0);
  });
});

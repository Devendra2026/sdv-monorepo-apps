import { describe, expect, it } from "vitest";
import { computeFloorPropertyTax, computeGrossAlvFromPanelRate, computeTotalAnnualDemand } from "./property-tax-calc";
import { DEFAULT_TAX_RATES } from "./tax-rate-defaults";

describe("computeGrossAlvFromPanelRate", () => {
  it("residential: area × rate × 12", () => {
    expect(computeGrossAlvFromPanelRate(1350, 0.18, 1)).toBe(2916);
  });

  it("commercial: doubles effective rate (×2)", () => {
    expect(computeGrossAlvFromPanelRate(1350, 0.18, 2)).toBe(5832);
  });
});

describe("computeFloorPropertyTax", () => {
  it("residential floor: assessable × 10% property tax", () => {
    const { alv, assessableAlv, tax } = computeFloorPropertyTax(1350, 0.18, DEFAULT_TAX_RATES.propertyTaxPct, 1);
    expect(alv).toBe(2916);
    expect(assessableAlv).toBe(2332.8);
    expect(tax).toBe(233.28);
  });

  it("commercial floor: doubled rate and assessable × 10%", () => {
    const { alv, assessableAlv, tax } = computeFloorPropertyTax(1350, 0.18, DEFAULT_TAX_RATES.propertyTaxPct, 2);
    expect(alv).toBe(5832);
    expect(assessableAlv).toBe(4665.6);
    expect(tax).toBe(466.56);
  });
});

describe("computeTotalAnnualDemand", () => {
  it("water 7.5% and drainage 2.5% on total assessable ALV", () => {
    const assessable = 2332.8;
    const propertyTax = 233.28;
    const { waterTax, drainageTax, totalAnnualDemand } = computeTotalAnnualDemand(
      assessable,
      propertyTax,
      DEFAULT_TAX_RATES.waterTaxPct,
      DEFAULT_TAX_RATES.drainageTaxPct,
      true,
    );
    expect(waterTax).toBe(174.96);
    expect(drainageTax).toBe(58.32);
    expect(totalAnnualDemand).toBe(466.56);
  });

  it("skips water when not connected", () => {
    const { waterTax, totalAnnualDemand } = computeTotalAnnualDemand(
      2332.8,
      233.28,
      DEFAULT_TAX_RATES.waterTaxPct,
      DEFAULT_TAX_RATES.drainageTaxPct,
      false,
    );
    expect(waterTax).toBe(0);
    expect(totalAnnualDemand).toBe(291.6);
  });

  it("skips water and drainage for open land (service taxes off)", () => {
    const propertyTax = 192;
    const { waterTax, drainageTax, totalAnnualDemand } = computeTotalAnnualDemand(
      1920,
      propertyTax,
      DEFAULT_TAX_RATES.waterTaxPct,
      DEFAULT_TAX_RATES.drainageTaxPct,
      false,
      false,
    );
    expect(waterTax).toBe(0);
    expect(drainageTax).toBe(0);
    expect(totalAnnualDemand).toBe(propertyTax);
  });
});

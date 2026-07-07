import { buildAllowedTaxZoneSet, normalizeTaxRateZone, validateTaxationSection } from "@/convex/taxationMasters";
import { describe, expect, it } from "vitest";

describe("normalizeTaxRateZone", () => {
  it("maps legacy rate_zone aliases to canonical keys", () => {
    expect(normalizeTaxRateZone("rate_zone_1")).toBe("below_9m");
    expect(normalizeTaxRateZone("rate_zone_4")).toBe("above_24m");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeTaxRateZone("")).toBe("");
    expect(normalizeTaxRateZone("   ")).toBe("");
  });
});

describe("validateTaxationSection taxRateZone", () => {
  it("allows empty tax zone in draft mode", () => {
    expect(validateTaxationSection({ taxRateZone: "" }, "draft")).toEqual({});
  });

  it("accepts legacy alias after normalization in draft mode", () => {
    const details = validateTaxationSection({ taxRateZone: "rate_zone_1" }, "draft");
    expect(details.taxRateZone).toBeUndefined();
  });

  it("rejects unknown non-empty zone in draft mode", () => {
    const details = validateTaxationSection({ taxRateZone: "not_a_real_zone" }, "draft");
    expect(details.taxRateZone).toEqual(["Select a valid road size tax zone"]);
  });

  it("accepts custom master values when allowed set includes them", () => {
    const allowed = buildAllowedTaxZoneSet(["custom_zone"]);
    const details = validateTaxationSection({ taxRateZone: "custom_zone" }, "draft", { allowedTaxZones: allowed });
    expect(details.taxRateZone).toBeUndefined();
  });
});

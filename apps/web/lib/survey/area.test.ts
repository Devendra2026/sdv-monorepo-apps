import { describe, expect, it } from "vitest";
import { isOpenLandOnlyProperty } from "./area";

describe("isOpenLandOnlyProperty", () => {
  it("returns true when property use is open_land", () => {
    expect(isOpenLandOnlyProperty("open_land", [{ floorName: "ground", constructionType: "pakka_rcc_rb" }])).toBe(true);
  });

  it("returns true when all floors are open land", () => {
    expect(
      isOpenLandOnlyProperty("residential", [
        { floorName: "open_land", constructionType: "open_land_plot" },
        { floorName: "open_land", constructionType: "open_land_plot" },
      ]),
    ).toBe(true);
  });

  it("returns true when construction type is open_land_plot only", () => {
    expect(isOpenLandOnlyProperty(undefined, [{ constructionType: "open_land_plot" }])).toBe(true);
  });

  it("returns false for mixed built-up and open land", () => {
    expect(
      isOpenLandOnlyProperty("residential", [
        { floorName: "ground", constructionType: "pakka_rcc_rb" },
        { floorName: "open_land", constructionType: "open_land_plot" },
      ]),
    ).toBe(false);
  });

  it("returns false when no floors and property use is not open_land", () => {
    expect(isOpenLandOnlyProperty("residential", [])).toBe(false);
  });
});

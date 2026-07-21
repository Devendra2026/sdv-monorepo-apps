import { describe, expect, it } from "vitest";
import { nextRollupClearTable } from "./surveyRollupStats";

describe("rollup clear table chain", () => {
  it("walks municipality → daily → ward → surveyor then ends", () => {
    const first = nextRollupClearTable(null);
    expect(first).toBe("surveyMunicipalityStats");
    const second = nextRollupClearTable(first);
    expect(second).toBe("surveyDailyStats");
    const third = nextRollupClearTable(second!);
    expect(third).toBe("surveyWardStats");
    const fourth = nextRollupClearTable(third!);
    expect(fourth).toBe("surveySurveyorStats");
    expect(nextRollupClearTable(fourth!)).toBeNull();
  });
});

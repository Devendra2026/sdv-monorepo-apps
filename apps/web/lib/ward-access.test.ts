import { describe, expect, it } from "vitest";
import { canReadWard } from "./ward-access";

const muniA = "muni-a";
const muniB = "muni-b";

describe("canReadWard", () => {
  it("allows admin and supervisor for any ward", () => {
    expect(canReadWard({ role: "admin", wardAssignments: ["1"] }, muniA, "99")).toBe(true);
    expect(canReadWard({ role: "supervisor", wardAssignments: ["1"] }, muniB, "99")).toBe(true);
  });

  it("allows empty ward without assignment check", () => {
    expect(canReadWard({ role: "surveyor", wardAssignments: ["3"] }, muniA, "")).toBe(true);
    expect(canReadWard({ role: "surveyor", wardAssignments: ["3"] }, muniA, "   ")).toBe(true);
  });

  it("allows all wards when user has no ward assignments", () => {
    expect(canReadWard({ role: "surveyor", wardAssignments: [] }, muniA, "5")).toBe(true);
  });

  it("restricts surveyors to assigned wards within municipality scope", () => {
    const user = { role: "surveyor", wardAssignments: ["3", "7"] };
    expect(canReadWard(user, muniA, "3")).toBe(true);
    expect(canReadWard(user, muniA, "7")).toBe(true);
    expect(canReadWard(user, muniA, "5")).toBe(false);
  });

  it("matches ward numbers numerically (05 vs 5)", () => {
    const user = { role: "surveyor", wardAssignments: ["5"] };
    expect(canReadWard(user, muniA, "05")).toBe(true);
    expect(canReadWard(user, muniA, "005")).toBe(true);
  });

  it("does not bypass ward check when municipality differs (collision-safe)", () => {
    const user = { role: "surveyor", wardAssignments: ["3"] };
    expect(canReadWard(user, muniB, "3")).toBe(true);
    expect(canReadWard(user, muniB, "5")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPORT_PAGE_SIZE,
  DRAFT_LIST_CAP_PER_MUNICIPALITY,
  MAX_DEMAND_NOTICE_JOB_SURVEYS,
  MAX_DEMAND_NOTICE_PAYLOAD_PAGE,
  MAX_EXPORT_PAGE_SIZE,
  MAX_IMPORT_FLOORS,
  MAX_IMPORT_SURVEYS,
  MAX_REASSIGN_PER_MUTATION,
} from "./budgetLimits";

describe("budgetLimits", () => {
  it("keeps export page size below the former silent-truncation client chunk of 50", () => {
    expect(MAX_EXPORT_PAGE_SIZE).toBe(40);
    expect(DEFAULT_EXPORT_PAGE_SIZE).toBeLessThanOrEqual(MAX_EXPORT_PAGE_SIZE);
  });

  it("caps demand-notice job and payload pages well below the old 1500 single-query path", () => {
    expect(MAX_DEMAND_NOTICE_JOB_SURVEYS).toBeLessThanOrEqual(200);
    expect(MAX_DEMAND_NOTICE_PAYLOAD_PAGE).toBeLessThanOrEqual(25);
    expect(MAX_DEMAND_NOTICE_PAYLOAD_PAGE).toBeLessThan(MAX_DEMAND_NOTICE_JOB_SURVEYS);
  });

  it("caps reassignment work below per-municipality list scan size", () => {
    expect(MAX_REASSIGN_PER_MUTATION).toBeLessThanOrEqual(25);
    expect(MAX_REASSIGN_PER_MUTATION).toBeLessThan(DRAFT_LIST_CAP_PER_MUNICIPALITY);
  });

  it("keeps import mutation budgets bounded", () => {
    expect(MAX_IMPORT_SURVEYS).toBeLessThanOrEqual(40);
    expect(MAX_IMPORT_FLOORS).toBeLessThanOrEqual(200);
  });
});

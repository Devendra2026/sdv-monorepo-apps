/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { formatDateKey, startOfDayMs } from "../shared/calendar";
import { loadDailyTrendFromDailyStats } from "./surveyScopeStats";

const modules = import.meta.glob("../**/*.ts");

const MS_PER_DAY = 86_400_000;
// 2026-07-21 12:00 IST
const NOW_MS = Date.UTC(2026, 6, 21, 6, 30, 0, 0);

describe("loadDailyTrendFromDailyStats", () => {
  it("includes all legacy daily points when generated rows share the legacy index", async () => {
    const t = convexTest(schema, modules);
    const days = 30;

    const { municipalityId, adminId } = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D1",
        name: "District 1",
        stateName: "Maharashtra",
        isActive: true,
      });
      const municipalityId = await ctx.db.insert("municipalities", {
        districtId,
        code: "M1",
        name: "Municipality 1",
        bodyType: "municipal_council",
        isActive: true,
      });
      const adminId = await ctx.db.insert("users", {
        clerkId: "admin-daily-trend",
        email: "admin-daily-trend@test.com",
        name: "Admin",
        role: "admin",
        status: "active",
        wardAssignments: [],
      });
      return { municipalityId, adminId };
    });

    await t.run(async (ctx) => {
      const endDayStart = startOfDayMs(NOW_MS);
      const startMs = endDayStart - (days - 1) * MS_PER_DAY;

      for (let i = 0; i < days; i++) {
        const dateKey = formatDateKey(startMs + i * MS_PER_DAY);
        await ctx.db.insert("surveyDailyStats", {
          generation: "gen-2026",
          municipalityId,
          dateKey,
          created: 999,
          submitted: 0,
        });
        await ctx.db.insert("surveyDailyStats", {
          municipalityId,
          dateKey,
          created: 1,
          submitted: 0,
        });
      }
    });

    await t.run(async (ctx) => {
      const admin = await ctx.db.get(adminId);
      expect(admin).not.toBeNull();

      const trend = await loadDailyTrendFromDailyStats(ctx, admin!, days, NOW_MS);

      expect(trend).toHaveLength(days);
      expect(trend.reduce((sum, point) => sum + point.created, 0)).toBe(days);
      expect(trend.every((point) => point.created === 1)).toBe(true);
    });
  });
});

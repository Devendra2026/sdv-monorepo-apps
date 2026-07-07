"use client";

import { CHART_HEIGHT_PX, ChartCard, ChartViewport } from "@/components/analytics/chart-shell";
import { chartPalette, chartTooltipStyle } from "@/components/analytics/chart-theme";
import dynamic from "next/dynamic";

export const QcSupervisorProductivityChart = dynamic(
  async () => {
    const { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } =
      await import("recharts");

    return function QcSupervisorProductivityChart({
      data,
      title,
    }: {
      data?: { name: string; approved: number; rejected: number }[];
      title: string;
    }) {
      const rows = (data ?? []).slice(0, 10);

      if (rows.length === 0) {
        return (
          <ChartCard title={title} description="Active QC supervisors only">
            <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
              No QC decisions recorded for active supervisors in scope.
            </div>
          </ChartCard>
        );
      }

      return (
        <ChartCard title={title} description="Active QC supervisors only — approve vs reject decisions">
          <ChartViewport>
            <ResponsiveContainer
              width="100%"
              height={CHART_HEIGHT_PX}
              minWidth={0}
              initialDimension={{ width: 320, height: CHART_HEIGHT_PX }}
            >
              <BarChart data={rows} margin={{ left: -8, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  height={64}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  allowDecimals={false}
                  width={40}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                <Bar dataKey="approved" name="Approved" stackId="a" fill={chartPalette.positive} />
                <Bar
                  dataKey="rejected"
                  name="Rejected"
                  stackId="a"
                  fill={chartPalette.negative}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartViewport>
        </ChartCard>
      );
    };
  },
  {
    ssr: false,
    loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted/50" aria-hidden />,
  },
);

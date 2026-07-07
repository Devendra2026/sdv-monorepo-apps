"use client"

import { CHART_HEIGHT_PX, ChartCard, ChartViewport } from "@/components/analytics/chart-shell"
import { chartPalette, chartTooltipStyle } from "@/components/analytics/chart-theme"
import dynamic from "next/dynamic"

export const TrendChart = dynamic(
  async () => {
    const { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } =
      await import("recharts")

    return function TrendChart({
      data,
      title,
    }: {
      data?: { date: string; created: number; submitted: number; approved: number; rejected: number }[]
      title: string
    }) {
      if (!data || data.length === 0) {
        return (
          <ChartCard title={title} description="Created vs approved vs rejected over time">
            <p className="py-8 text-center text-sm text-muted-foreground">No trend data in your scope.</p>
          </ChartCard>
        )
      }

      return (
        <ChartCard title={title} description="Created vs approved vs rejected over time">
          <ChartViewport>
            <ResponsiveContainer
              width="100%"
              height={CHART_HEIGHT_PX}
              minWidth={0}
              initialDimension={{ width: 320, height: CHART_HEIGHT_PX }}
            >
              <AreaChart data={data ?? []} margin={{ left: -8, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartPalette.primary} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={chartPalette.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartPalette.positive} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={chartPalette.positive} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(d) => String(d).slice(5)}
                  minTickGap={24}
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
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke={chartPalette.primary}
                  fill="url(#gCreated)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  name="Approved"
                  stroke={chartPalette.positive}
                  fill="url(#gApproved)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="rejected"
                  name="Rejected"
                  stroke={chartPalette.negative}
                  fillOpacity={0}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartViewport>
        </ChartCard>
      )
    }
  },
  {
    ssr: false,
    loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted/50" aria-hidden />,
  }
)

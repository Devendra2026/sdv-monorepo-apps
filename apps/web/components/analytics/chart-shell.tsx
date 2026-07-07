"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import type { ReactNode } from "react";

export const CHART_HEIGHT_PX = 288;

export function ChartViewport({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0" style={{ height: CHART_HEIGHT_PX }}>
      {children}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="border-b border-border/60 pb-3">
        <CardTitle className="font-display text-base font-semibold tracking-tight">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

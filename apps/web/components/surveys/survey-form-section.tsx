"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";

export function SurveyFormSection({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <GlassCard padding="md">
      <GlassCardHeader title={title} icon={icon} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </GlassCard>
  );
}

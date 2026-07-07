"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { GpsEditPanel } from "@/components/surveys/gps-edit-panel";
import type { GpsCapture } from "@/schema/surveys/index";
import { MapPin } from "lucide-react";

export function GpsCapturePanel({ surveyId, gps }: { surveyId: string; gps?: GpsCapture }) {
  return (
    <GlassCard padding="md">
      <GlassCardHeader
        title="GPS Capture"
        description="Capture device location or enter latitude and longitude manually."
        icon={<MapPin className="h-4 w-4" aria-hidden />}
      />
      <GpsEditPanel surveyId={surveyId} gps={gps} canEdit />
    </GlassCard>
  );
}

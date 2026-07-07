"use client";

import {
  GOOGLE_MAPS_EMBED_MODE,
  GOOGLE_MAPS_REQUIRED_APIS,
  getGoogleMapsKeyPreview,
  isGoogleMapsKeyConfigured,
} from "@/lib/maps/google-maps-config";
import { formatGpsDecimal } from "@/lib/surveys/gps-format";
import { fmtDate } from "@/lib/utils";
import type { GpsCapture } from "@/schema/surveys/index";

export function GisDebugPanel({ surveyId, gps }: { surveyId: string; gps?: GpsCapture }) {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <details className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-xs">
      <summary className="cursor-pointer font-semibold text-amber-800 dark:text-amber-300">
        GIS Debug (dev only)
      </summary>
      <dl className="mt-2 grid gap-1.5 font-mono text-[11px] text-muted-foreground">
        <div className="flex justify-between gap-4">
          <dt>Survey ID</dt>
          <dd className="truncate text-foreground">{surveyId}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>API key configured</dt>
          <dd className="text-foreground">{isGoogleMapsKeyConfigured() ? "yes" : "no"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>API key preview</dt>
          <dd className="text-foreground">{getGoogleMapsKeyPreview()}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Embed mode</dt>
          <dd className="text-foreground">{GOOGLE_MAPS_EMBED_MODE}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Required APIs</dt>
          <dd className="text-right text-foreground">{GOOGLE_MAPS_REQUIRED_APIS.join(", ")}</dd>
        </div>
        {gps ? (
          <>
            <div className="flex justify-between gap-4">
              <dt>Latitude</dt>
              <dd className="tabular-nums text-foreground">{gps.latitude}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Longitude</dt>
              <dd className="tabular-nums text-foreground">{gps.longitude}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Formatted</dt>
              <dd className="tabular-nums text-foreground">{formatGpsDecimal(gps.latitude, gps.longitude)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Accuracy</dt>
              <dd className="tabular-nums text-foreground">±{gps.accuracyMeters.toFixed(1)} m</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Provider</dt>
              <dd className="text-foreground">{gps.provider ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Captured</dt>
              <dd className="text-foreground">{fmtDate(gps.capturedAt)}</dd>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">No GPS saved in Convex</div>
        )}
      </dl>
    </details>
  );
}

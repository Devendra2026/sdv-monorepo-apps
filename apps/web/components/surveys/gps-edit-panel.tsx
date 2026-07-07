"use client";

import { GisDebugPanel } from "@/components/dev/gis-debug-panel";
import { GoogleMapEmbed } from "@/components/shared/google-map-embed";
import { Badge } from "@/components/ui/badge";
import { useSetGps } from "@/hooks/surveys/useSurveys";
import { parseConvexError } from "@/lib/errors";
import { captureBrowserGps } from "@/lib/surveys/gps-browser-capture";
import { gpsCoordinateInputsKey } from "@/lib/surveys/gps-coordinates";
import { formatGpsDecimal } from "@/lib/surveys/gps-format";
import { fmtDate } from "@/lib/utils";
import type { GpsCapture } from "@/schema/surveys/index";
import { Crosshair } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GpsCoordinateInputs } from "./gps-coordinate-inputs";

function GisPreview({ gps, surveyId }: { gps: GpsCapture; surveyId: string }) {
  return (
    <div className="space-y-3">
      <GoogleMapEmbed
        latitude={gps.latitude}
        longitude={gps.longitude}
        accuracyMeters={gps.accuracyMeters}
        title="Geo-Tagged Location"
        variant="compact"
      />
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-xs">
        <Badge variant="secondary" className="font-mono text-[10px] uppercase">
          ±{gps.accuracyMeters.toFixed(1)} m
        </Badge>
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatGpsDecimal(gps.latitude, gps.longitude)}
        </span>
        {gps.provider === "manual" ? (
          <span className="text-muted-foreground">Manual entry — accuracy not measured</span>
        ) : null}
      </div>
      <GisDebugPanel surveyId={surveyId} gps={gps} />
    </div>
  );
}

export function GpsEditPanel({ surveyId, gps, canEdit }: { surveyId: string; gps?: GpsCapture; canEdit: boolean }) {
  const setGps = useSetGps();
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function capture() {
    setCapturing(true);
    try {
      const fix = await captureBrowserGps();
      await setGps({
        id: surveyId as any,
        gps: fix,
      });
      toast.success("GPS captured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : parseConvexError(e).message);
    } finally {
      setCapturing(false);
    }
  }

  async function saveManual(lat: number | null, lng: number | null) {
    if (lat === null) {
      toast.error("Latitude must be between -90 and 90");
      return;
    }
    if (lng === null) {
      toast.error("Longitude must be between -180 and 180");
      return;
    }
    setSaving(true);
    try {
      await setGps({
        id: surveyId as any,
        gps: {
          latitude: lat,
          longitude: lng,
          accuracyMeters: 1,
          capturedAt: Date.now(),
          provider: "manual",
          isMockLocation: false,
        },
      });
      toast.success("GPS coordinates saved");
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    if (gps) return <GisPreview gps={gps} surveyId={surveyId} />;
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 py-14 text-muted-foreground">
        <Crosshair className="h-8 w-8 opacity-30" aria-hidden />
        <p className="text-sm font-medium opacity-60">No GPS captured</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {gps ? (
        <GisPreview gps={gps} surveyId={surveyId} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 py-10 text-muted-foreground">
          <Crosshair className="h-8 w-8 opacity-30" aria-hidden />
          <p className="text-sm font-medium opacity-60">No GPS captured yet</p>
        </div>
      )}

      {gps && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Captured {fmtDate(gps.capturedAt)}</span>
          {gps.provider && <Badge variant="outline">{gps.provider}</Badge>}
        </div>
      )}

      <GpsCoordinateInputs
        key={gpsCoordinateInputsKey(gps)}
        initialLatitude={gps ? String(gps.latitude) : ""}
        initialLongitude={gps ? String(gps.longitude) : ""}
        gps={gps}
        capturing={capturing}
        saving={saving}
        onCapture={() => void capture()}
        onSave={(lat, lng) => void saveManual(lat, lng)}
      />
    </div>
  );
}

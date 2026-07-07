"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCoordinate } from "@/lib/surveys/gps-coordinates";
import type { GpsCapture } from "@/schema/surveys/index";
import { Crosshair, Loader2, Save } from "lucide-react";
import { useState } from "react";

type GpsCoordinateInputsProps = {
  initialLatitude: string;
  initialLongitude: string;
  gps?: GpsCapture;
  capturing: boolean;
  saving: boolean;
  onCapture: () => void;
  onSave: (lat: number | null, lng: number | null) => void;
};

export function GpsCoordinateInputs({
  initialLatitude,
  initialLongitude,
  gps,
  capturing,
  saving,
  onCapture,
  onSave,
}: GpsCoordinateInputsProps) {
  const [latInput, setLatInput] = useState(initialLatitude);
  const [lngInput, setLngInput] = useState(initialLongitude);

  function saveManual() {
    const lat = parseCoordinate(latInput, -90, 90);
    const lng = parseCoordinate(lngInput, -180, 180);
    onSave(lat, lng);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-premium-sm">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Edit coordinates</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gps-latitude" className="text-xs font-semibold">
            Latitude
          </Label>
          <Input
            id="gps-latitude"
            type="number"
            step="0.000001"
            min={-90}
            max={90}
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            className="font-mono tabular-nums"
            placeholder="-90 to 90"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gps-longitude" className="text-xs font-semibold">
            Longitude
          </Label>
          <Input
            id="gps-longitude"
            type="number"
            step="0.000001"
            min={-180}
            max={180}
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            className="font-mono tabular-nums"
            placeholder="-180 to 180"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={capturing}
          onClick={onCapture}
          className="cursor-pointer rounded-xl border-brand-navy/25 transition-colors duration-200 hover:bg-brand-navy/5 dark:border-primary/30"
        >
          {capturing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="h-4 w-4" aria-hidden />
          )}
          {gps ? "Recapture" : "Capture"} GPS
        </Button>
        <Button
          size="sm"
          disabled={saving}
          onClick={saveManual}
          className="cursor-pointer rounded-xl bg-brand-navy text-white transition-colors duration-200 hover:bg-brand-navy/90 dark:bg-primary dark:hover:bg-primary/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Save coordinates
        </Button>
      </div>
    </div>
  );
}

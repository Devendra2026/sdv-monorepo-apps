import type { GpsCapture } from "@/schema/surveys/index";

export function parseCoordinate(value: string, min: number, max: number): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function gpsCoordinateInputsKey(gps?: GpsCapture): string {
  return gps ? `${gps.capturedAt}-${gps.latitude}-${gps.longitude}` : "empty";
}

/** Shared GPS coordinate formatting for maps, PDFs, and UI. */

export function formatGpsDecimal(latitude: number, longitude: number, digits = 6): string {
  return `${latitude.toFixed(digits)}, ${longitude.toFixed(digits)}`;
}

export function formatLatitudeDms(latitude: number, digits = 4): string {
  return `${Math.abs(latitude).toFixed(digits)}° ${latitude >= 0 ? "N" : "S"}`;
}

export function formatLongitudeDms(longitude: number, digits = 4): string {
  return `${Math.abs(longitude).toFixed(digits)}° ${longitude >= 0 ? "E" : "W"}`;
}

export function formatGpsDms(latitude: number, longitude: number, digits = 4): string {
  return `${formatLatitudeDms(latitude, digits)}, ${formatLongitudeDms(longitude, digits)}`;
}

export function formatGpsLatLongLabel(latitude: number, longitude: number, digits = 6): string {
  return `LAT: ${latitude.toFixed(digits)} LONG: ${longitude.toFixed(digits)}`;
}

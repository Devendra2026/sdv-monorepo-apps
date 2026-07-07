/** Google Cloud APIs required for map embeds and static print images. */
export const GOOGLE_MAPS_REQUIRED_APIS = ["Maps Embed API", "Maps Static API"] as const;

export const GOOGLE_MAPS_EMBED_MODE = "place" as const;

export function isGoogleMapsKeyConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

/** Masked key preview for dev tooling (first 4 + last 4 chars). */
export function getGoogleMapsKeyPreview(): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return "(not configured)";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

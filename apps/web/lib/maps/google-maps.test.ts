import { afterEach, describe, expect, it, vi } from "vitest";
import { googleMapsEmbedUrl, googleMapsStaticUrl } from "./google-maps";
import { GOOGLE_MAPS_EMBED_MODE } from "./google-maps-config";

describe("googleMapsEmbedUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses place mode with q=lat,lng when API key is set", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-api-key");
    const url = googleMapsEmbedUrl(28.6139, 77.209, 17);
    expect(url).toContain(`/embed/v1/${GOOGLE_MAPS_EMBED_MODE}?`);
    expect(url).toContain("q=28.6139,77.209");
    expect(url).toContain("zoom=17");
    expect(url).not.toContain("center=");
  });

  it("falls back to keyless embed when API key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    const url = googleMapsEmbedUrl(28.6139, 77.209);
    expect(url).toContain("maps.google.com/maps?q=28.6139,77.209");
    expect(url).toContain("output=embed");
  });
});

describe("googleMapsStaticUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null without API key", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    expect(googleMapsStaticUrl(28.6139, 77.209)).toBeNull();
  });

  it("includes marker at lat,lng when API key is set", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-api-key");
    const url = googleMapsStaticUrl(28.6139, 77.209, 640, 360);
    expect(url).toContain("staticmap");
    expect(url).toContain("center=28.6139,77.209");
    expect(url).toContain("markers=color:red%7C28.6139,77.209");
  });
});

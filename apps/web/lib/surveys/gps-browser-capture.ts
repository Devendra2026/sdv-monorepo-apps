export type BrowserGpsFix = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: number;
  provider: "browser";
  isMockLocation: false;
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied. Enable location in browser settings.";
    case error.POSITION_UNAVAILABLE:
      return "GPS unavailable. Move outdoors and retry.";
    case error.TIMEOUT:
      return "GPS timed out. Retry in open sky.";
    default:
      return error.message || "Failed to capture GPS location.";
  }
}

/** Single-shot browser geolocation — no accuracy gate. */
export function captureBrowserGps(): Promise<BrowserGpsFix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not available in this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy;
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 1,
          capturedAt: Date.now(),
          provider: "browser",
          isMockLocation: false,
        });
      },
      (err) => reject(new Error(geolocationErrorMessage(err))),
      GEOLOCATION_OPTIONS,
    );
  });
}

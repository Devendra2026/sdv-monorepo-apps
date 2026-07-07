import { describe, expect, it } from "vitest";
import {
  formatGpsDecimal,
  formatGpsDms,
  formatGpsLatLongLabel,
  formatLatitudeDms,
  formatLongitudeDms,
} from "./gps-format";

describe("formatLatitudeDms", () => {
  it("labels northern and southern hemispheres", () => {
    expect(formatLatitudeDms(28.6139)).toBe("28.6139° N");
    expect(formatLatitudeDms(-33.8688)).toBe("33.8688° S");
  });
});

describe("formatLongitudeDms", () => {
  it("labels eastern and western hemispheres", () => {
    expect(formatLongitudeDms(77.209)).toBe("77.2090° E");
    expect(formatLongitudeDms(-122.4194)).toBe("122.4194° W");
  });
});

describe("formatGpsDms", () => {
  it("combines latitude and longitude with correct hemispheres", () => {
    expect(formatGpsDms(-33.8688, 151.2093, 4)).toBe("33.8688° S, 151.2093° E");
  });
});

describe("formatGpsDecimal", () => {
  it("formats with requested precision", () => {
    expect(formatGpsDecimal(28.613945, 77.209012, 6)).toBe("28.613945, 77.209012");
  });
});

describe("formatGpsLatLongLabel", () => {
  it("formats LAT/LONG label for demand notices", () => {
    expect(formatGpsLatLongLabel(28.613945, 77.209012)).toBe("LAT: 28.613945 LONG: 77.209012");
  });
});

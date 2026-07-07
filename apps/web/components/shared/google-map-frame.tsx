"use client";

import { googleMapsEmbedUrl, googleMapsStaticUrl } from "@/lib/maps/google-maps";
import { isGoogleMapsKeyConfigured } from "@/lib/maps/google-maps-config";
import { formatGpsDms } from "@/lib/surveys/gps-format";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";
import NextImage from "next/image";
import { useEffect } from "react";

export type GoogleMapFrameProps = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  /** Screen: iframe embed. Print: static map image. Both: iframe on screen, static for print CSS. */
  mode?: "embed" | "static" | "embed-and-static";
  variant?: "default" | "dark";
  coordinateDigits?: number;
  className?: string;
  iframeClassName?: string;
  showKeyBanner?: boolean;
  overlayClassName?: string;
  staticWidth?: number;
  staticHeight?: number;
};

export function GoogleMapFrame({
  latitude,
  longitude,
  accuracyMeters,
  mode = "embed",
  variant = "default",
  coordinateDigits = 4,
  className,
  iframeClassName,
  showKeyBanner = true,
  overlayClassName,
  staticWidth = 640,
  staticHeight = 360,
}: GoogleMapFrameProps) {
  const embedUrl = googleMapsEmbedUrl(latitude, longitude);
  const staticMapUrl = googleMapsStaticUrl(latitude, longitude, staticWidth, staticHeight);
  const keyConfigured = isGoogleMapsKeyConfigured();
  const showEmbed = mode === "embed" || mode === "embed-and-static";
  const showStatic = mode === "static" || mode === "embed-and-static";
  const coordLabel = formatGpsDms(latitude, longitude, coordinateDigits);
  const accuracySuffix = accuracyMeters !== undefined ? ` · ±${accuracyMeters.toFixed(1)} m` : "";
  const mapAlt = `GIS Map — ${latitude.toFixed(coordinateDigits)}, ${longitude.toFixed(coordinateDigits)}`;

  useEffect(() => {
    if (!staticMapUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = staticMapUrl;
  }, [staticMapUrl]);

  return (
    <div className={cn("relative w-full bg-muted/30", variant === "dark" && "bg-slate-800", className)}>
      {showKeyBanner && !keyConfigured && showEmbed ? (
        <p className="absolute inset-x-0 top-0 z-10 bg-amber-500/90 px-2 py-1 text-center text-[10px] font-medium text-amber-950">
          Maps API key not configured — using fallback embed
        </p>
      ) : null}

      {showEmbed ? (
        <iframe
          title={`Google Map — ${latitude.toFixed(coordinateDigits)}, ${longitude.toFixed(coordinateDigits)}`}
          src={embedUrl}
          className={cn(
            "h-full w-full border-0",
            showStatic && mode === "embed-and-static" && "print:hidden",
            iframeClassName,
          )}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          allowFullScreen
        />
      ) : null}

      {showStatic && staticMapUrl ? (
        <NextImage
          src={staticMapUrl}
          alt={mapAlt}
          width={staticWidth}
          height={staticHeight}
          loading="eager"
          unoptimized
          crossOrigin="anonymous"
          data-gis-static-map=""
          className={cn(
            "h-full w-full object-contain",
            mode === "embed-and-static" && "absolute inset-0 hidden print:block",
            mode === "static" && "relative block",
          )}
        />
      ) : showStatic && !staticMapUrl ? (
        <div className="flex h-full min-h-30 flex-col items-center justify-center gap-2 text-muted-foreground">
          <MapPin className="h-5 w-5 opacity-50" aria-hidden />
          <p className="text-xs font-medium">Map preview unavailable — configure Maps Static API key</p>
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 px-4 py-3",
          variant === "dark"
            ? "bg-linear-to-t from-slate-900/95 to-transparent"
            : "bg-linear-to-t from-brand-navy/90 to-transparent dark:from-background/95",
          overlayClassName,
        )}
      >
        <p
          className={cn(
            "font-mono text-xs font-semibold",
            variant === "dark" ? "text-emerald-100" : "text-white dark:text-foreground",
          )}
        >
          {coordLabel}
          {accuracySuffix}
        </p>
      </div>
    </div>
  );
}

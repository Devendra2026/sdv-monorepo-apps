"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { GoogleMapFrame } from "@/components/shared/google-map-frame";
import { googleMapsPlaceUrl } from "@/lib/maps/google-maps";
import { ExternalLink, MapPin } from "lucide-react";

export function GoogleMapEmbed({
  latitude,
  longitude,
  title = "Geo-Tagged Location",
  accuracyMeters,
  className,
  variant = "default",
}: {
  latitude: number;
  longitude: number;
  title?: string;
  accuracyMeters?: number;
  className?: string;
  variant?: "default" | "compact" | "dark";
}) {
  const placeUrl = googleMapsPlaceUrl(latitude, longitude);
  const isDark = variant === "dark";
  const isCompact = variant === "compact";

  if (isDark || isCompact) {
    return (
      <div className={className}>
        {!isCompact ? (
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        ) : null}
        <div className={isDark ? "overflow-hidden rounded-xl border border-slate-200" : "overflow-hidden rounded-xl"}>
          <GoogleMapFrame
            latitude={latitude}
            longitude={longitude}
            accuracyMeters={accuracyMeters}
            variant={isDark ? "dark" : "default"}
            className={isCompact ? "aspect-video" : "aspect-4/3"}
            coordinateDigits={isCompact ? 6 : 4}
          />
        </div>
      </div>
    );
  }

  return (
    <GlassCard padding="none" className={className}>
      <GlassCardHeader
        title={title}
        icon={<MapPin className="h-4 w-4" aria-hidden />}
        action={
          <a
            href={placeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-navy transition-colors duration-200 hover:text-brand-red dark:text-primary dark:hover:text-brand-red"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Open in Google Maps
          </a>
        }
        className="px-5 pt-5"
      />
      <GoogleMapFrame
        latitude={latitude}
        longitude={longitude}
        accuracyMeters={accuracyMeters}
        className="aspect-4/3"
      />
    </GlassCard>
  );
}

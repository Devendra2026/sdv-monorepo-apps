"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePhotos, useRemovePhotoSlot, useUploadPhoto } from "@/hooks/surveys/usePhotos";
import { QC_STATUS_BADGE } from "@/lib/design-system";
import { PHOTO_SLOT_LABEL, type PhotoSlot } from "@/lib/domain";
import { parseConvexError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { PhotoRow } from "@/schema/surveys/index";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

const REQUIRED: PhotoSlot[] = ["front", "side"];
const EDIT_SLOTS: PhotoSlot[] = ["front", "side"];

export function PhotoUploader({ surveyId }: { surveyId: string }) {
  const photos = usePhotos(surveyId) as PhotoRow[] | undefined;
  const upload = useUploadPhoto();
  const removeSlot = useRemovePhotoSlot();
  const [busySlot, setBusySlot] = useState<PhotoSlot | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function onPick(slot: PhotoSlot, file?: File) {
    if (!file || busySlot !== null) return;
    setBusySlot(slot);
    try {
      await upload(surveyId, slot, file);
      toast.success(`${PHOTO_SLOT_LABEL[slot]} photo uploaded`);
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      setBusySlot(null);
      const input = inputs.current[slot];
      if (input) input.value = "";
    }
  }

  async function onRemove(slot: PhotoSlot) {
    if (busySlot !== null) return;
    setBusySlot(slot);
    try {
      await removeSlot({ surveyId: surveyId as any, slot });
      toast.success(`${PHOTO_SLOT_LABEL[slot]} photo removed`);
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      setBusySlot(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {EDIT_SLOTS.map((slot) => {
        const photo = photos?.find((p) => p.slot === slot);
        const required = REQUIRED.includes(slot);
        const inputId = `survey-photo-${surveyId}-${slot}`;
        const slotLabel = PHOTO_SLOT_LABEL[slot];
        return (
          <div
            key={slot}
            className={cn(
              "premium-card overflow-hidden rounded-xl p-4 shadow-premium-sm transition-all duration-200 hover:shadow-premium-md",
              photo?.url
                ? "border-brand-navy/20 dark:border-primary/25"
                : required
                  ? "border-dashed border-warning/45 dark:border-warning/35"
                  : "border-border/60",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-heading text-sm font-semibold text-foreground">{PHOTO_SLOT_LABEL[slot]}</span>
              {required && (
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    photo
                      ? QC_STATUS_BADGE.approved
                      : "border-warning/45 bg-warning/14 text-amber-950 dark:text-amber-200",
                  )}
                >
                  {photo ? "Uploaded" : "Required"}
                </Badge>
              )}
            </div>
            <div className="relative mb-3 aspect-4/3 w-full overflow-hidden rounded-xl bg-muted/50 ring-1 ring-border/40">
              {photo?.url ? (
                <Image
                  src={photo.url}
                  alt={PHOTO_SLOT_LABEL[slot]}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImageOff className="h-6 w-6 opacity-40" aria-hidden />
                  <p className="text-xs font-medium opacity-60">No photo yet</p>
                </div>
              )}
              {busySlot === slot && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-navy dark:text-primary" aria-hidden />
                </div>
              )}
            </div>
            <input
              id={inputId}
              ref={(el) => {
                inputs.current[slot] = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label={`Upload ${slotLabel} photo`}
              onChange={(e) => onPick(slot, e.target.files?.[0])}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 cursor-pointer rounded-xl border-brand-navy/20 hover:bg-brand-navy/5 dark:border-primary/25"
                disabled={busySlot !== null}
                onClick={() => inputs.current[slot]?.click()}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden /> {photo ? "Replace" : "Upload"}
              </Button>
              {photo && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 cursor-pointer rounded-xl"
                  disabled={busySlot !== null}
                  aria-label={`Remove ${slotLabel} photo`}
                  onClick={() => onRemove(slot)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-brand-red" aria-hidden />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client"

import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import type { PhotoSlot } from "@/lib/domain"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useMutation, useQuery } from "convex/react"
import { useCallback, useMemo } from "react"

export function usePhotos(surveyId: string | undefined) {
  const ready = useConvexAuthReady()
  const listArgs = ready && surveyId ? { surveyId: surveyId as Id<"surveys"> } : "skip"
  const photos = useQuery(api.photos.queries.list, listArgs)

  const photoIds = useMemo(() => photos?.map((p) => p._id) ?? [], [photos])
  const urlArgs = ready && photoIds.length > 0 ? { photoIds } : "skip"
  const urls = useQuery(api.photos.queries.getUrls, urlArgs)

  return useMemo(() => {
    if (photos === undefined) return undefined
    return photos.map((p) => ({
      ...p,
      url: urls?.[p._id] ?? null,
    }))
  }, [photos, urls])
}

export function useRemovePhotoSlot() {
  return useMutation(api.photos.mutations.removeBySurveySlot)
}

/** Downscale + re-encode a File to JPEG under ~900 KB / 1600px long edge. */
async function compressImage(
  file: File,
  maxEdge = 1600,
  quality = 0.8
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  let { width, height } = bitmap
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  width = Math.round(width * scale)
  height = Math.round(height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, width, height)
  let q = quality
  let blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", q))
  while (blob.size > 900 * 1024 && q > 0.4) {
    q -= 0.15
    blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", q))
  }
  return { blob, width, height }
}

export function useUploadPhoto() {
  const generateUploadUrl = useMutation(api.photos.mutations.generateUploadUrl)
  const linkPhoto = useMutation(api.photos.mutations.linkPhoto)

  return useCallback(
    async (surveyId: string, slot: PhotoSlot, file: File) => {
      const [{ blob, width, height }, uploadUrl] = await Promise.all([
        compressImage(file),
        generateUploadUrl({ surveyId: surveyId as Id<"surveys"> }),
      ])
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      })
      if (!res.ok) throw new Error("Upload failed")
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> }
      return await linkPhoto({
        surveyId: surveyId as Id<"surveys">,
        slot,
        storageId,
        sizeKb: Math.max(1, Math.round(blob.size / 1024)),
        width,
        height,
        capturedAt: Date.now(),
      })
    },
    [generateUploadUrl, linkPhoto]
  )
}

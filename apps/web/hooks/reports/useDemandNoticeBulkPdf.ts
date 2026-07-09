"use client"

import type { DemandNoticeBulkPdfJob } from "@/components/reports/demand-notice-panel/demand-notice-bulk-pdf-capture"
import type { FilterState } from "@/components/surveys/survey-filters"
import { DemandNoticeDocumentProps } from "@/lib/qc/demand-notice-document-types"
import { reportDocumentTimestamp } from "@/lib/qc/report-dates"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useConvex, useMutation } from "convex/react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

export function useDemandNoticeBulkPdf() {
  const convex = useConvex()
  const startBulkExport = useMutation(api.demandNotices.mutations.startBulkExport)
  const updateExportProgress = useMutation(api.demandNotices.mutations.updateExportProgress)
  const generateUploadUrl = useMutation(api.demandNotices.mutations.generateUploadUrl)
  const completeExport = useMutation(api.demandNotices.mutations.completeExport)
  const failExport = useMutation(api.demandNotices.mutations.failExport)

  const [job, setJob] = useState<DemandNoticeBulkPdfJob | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)

  const startBulkPdf = useCallback(
    async (filters: FilterState) => {
      if (!filters.municipalityId) {
        toast.error("Select a ULB before generating bulk demand notice PDFs.")
        return
      }

      setPreparing(true)
      try {
        const municipalityId = filters.municipalityId as Id<"municipalities">
        const reportDateMs = reportDocumentTimestamp()

        const jobId = await startBulkExport({
          municipalityId,
          districtId: filters.districtId as Id<"districts"> | undefined,
          wardNo: filters.wardNo,
          reportDateMs,
        })

        const exportJob = await convex.query(api.demandNotices.queries.getExportJob, { jobId })
        const payloads = await convex.query(api.demandNotices.queries.getNoticePayloads, { jobId })

        if (payloads.length === 0) {
          await failExport({ jobId, errorMessage: "No demand notice payloads could be built." })
          toast.error("No QC-approved properties found for this scope.")
          return
        }

        setProgress({ completed: 0, total: payloads.length })
        setJob({
          jobId,
          payloads: payloads as unknown as DemandNoticeDocumentProps[],
          filename: exportJob.filename,
          onUpload: async (blob: Blob) => {
            const uploadUrl = await generateUploadUrl({ jobId })
            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": "application/pdf" },
              body: blob,
            })
            if (!response.ok) {
              throw new Error("Failed to upload bulk demand notice PDF.")
            }
            const { storageId } = (await response.json()) as { storageId: Id<"_storage"> }
            await completeExport({ jobId, storageId })

            const completed = await convex.query(api.demandNotices.queries.getExportJob, { jobId })
            if (completed.downloadUrl) {
              const link = document.createElement("a")
              link.href = completed.downloadUrl
              link.download = exportJob.filename
              link.rel = "noopener"
              document.body.appendChild(link)
              link.click()
              link.remove()
            } else {
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.download = exportJob.filename
              link.rel = "noopener"
              document.body.appendChild(link)
              link.click()
              link.remove()
              URL.revokeObjectURL(url)
            }
          },
        })

        toast.message(`Generating ${payloads.length} A4 demand notices…`, {
          description: "Sorted ward-wise, parcel sequence.",
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not prepare bulk PDF export.")
      } finally {
        setPreparing(false)
      }
    },
    [completeExport, convex, failExport, generateUploadUrl, startBulkExport]
  )

  const clearJob = useCallback(() => {
    setJob(null)
    setProgress(null)
  }, [])

  const onProgress = useCallback(
    (completed: number, total: number) => {
      setProgress({ completed, total })
      if (job?.jobId) {
        void updateExportProgress({ jobId: job.jobId, processedCount: completed })
      }
    },
    [job?.jobId, updateExportProgress]
  )

  const onComplete = useCallback(() => {
    const count = job?.payloads.length ?? 0
    clearJob()
    toast.success(`Downloaded bulk demand notice PDF (${count} properties).`)
  }, [clearJob, job?.payloads.length])

  const onError = useCallback(
    (message: string) => {
      if (job?.jobId) {
        void failExport({ jobId: job.jobId, errorMessage: message })
      }
      clearJob()
      toast.error(message)
    },
    [clearJob, failExport, job?.jobId]
  )

  return {
    job,
    preparing,
    progress,
    startBulkPdf,
    clearJob,
    onProgress,
    onComplete,
    onError,
    isExporting: preparing || job !== null,
  }
}

"use client";

import { demandNoticeFontClassName } from "@/components/qc/demand-notice/demand-notice-fonts";
import type { DemandNoticeDocumentProps } from "@/components/qc/demand-notice/document";
import { DemandNoticeDocument } from "@/components/qc/demand-notice/document";
import type { Id } from "@/convex/_generated/dataModel";
import {
  captureDemandNoticePrintRoot,
  cleanupDemandNoticeCapture,
  createDemandNoticeBulkPdf,
  demandNoticeBulkPdfBlob,
  findDemandNoticePrintRoot,
  prepareDemandNoticeCapture,
  saveDemandNoticeBulkPdf,
  waitForNoticeImages,
} from "@/lib/reports/generate-demand-notice-bulk-pdf";
import type jsPDF from "jspdf";
import { useEffect, useRef, useState } from "react";

export type DemandNoticeBulkPdfJob = {
  jobId?: Id<"demandNoticeExportJobs">;
  payloads: DemandNoticeDocumentProps[];
  filename: string;
  onUpload?: (blob: Blob) => Promise<void>;
};

type DemandNoticeBulkPdfCaptureProps = {
  job: DemandNoticeBulkPdfJob;
  onProgress: (completed: number, total: number) => void;
  onComplete: () => void;
  onError: (message: string) => void;
};

function bulkPdfJobKey(job: DemandNoticeBulkPdfJob): string {
  return job.jobId ?? `${job.filename}:${job.payloads.length}`;
}

/** Remount via key when job changes — resets capture state without an effect. */
export function DemandNoticeBulkPdfCapture({ job, onProgress, onComplete, onError }: DemandNoticeBulkPdfCaptureProps) {
  return (
    <DemandNoticeBulkPdfCaptureRun
      key={bulkPdfJobKey(job)}
      job={job}
      onProgress={onProgress}
      onComplete={onComplete}
      onError={onError}
    />
  );
}

async function finalizeBulkPdf(
  doc: jsPDF,
  job: DemandNoticeBulkPdfJob,
  onComplete: () => void,
  onError: (message: string) => void,
): Promise<void> {
  try {
    const blob = demandNoticeBulkPdfBlob(doc);
    if (job.onUpload) {
      await job.onUpload(blob);
    } else {
      saveDemandNoticeBulkPdf(doc, job.filename);
    }
    cleanupDemandNoticeCapture();
    onComplete();
  } catch (error) {
    cleanupDemandNoticeCapture();
    onError(error instanceof Error ? error.message : "Failed to save demand notice PDF.");
  }
}

function DemandNoticeBulkPdfCaptureRun({ job, onProgress, onComplete, onError }: DemandNoticeBulkPdfCaptureProps) {
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<jsPDF | null>(null);
  const startedRef = useRef(false);

  if (pdfRef.current === null) {
    pdfRef.current = createDemandNoticeBulkPdf();
  }

  useEffect(() => {
    if (finished || index >= job.payloads.length) return;
    if (startedRef.current) return;

    let cancelled = false;

    async function captureCurrent() {
      const doc = pdfRef.current;
      if (!doc) return;

      startedRef.current = true;
      try {
        await prepareDemandNoticeCapture();
        if (cancelled) return;

        const printRoot = await findDemandNoticePrintRoot(mountRef.current);
        if (cancelled) return;

        await waitForNoticeImages(printRoot);
        if (cancelled) return;

        await captureDemandNoticePrintRoot(doc, printRoot, index === 0);
        if (cancelled) return;

        const nextIndex = index + 1;
        onProgress(nextIndex, job.payloads.length);

        if (nextIndex >= job.payloads.length) {
          setFinished(true);
          await finalizeBulkPdf(doc, job, onComplete, onError);
          return;
        }

        startedRef.current = false;
        setIndex(nextIndex);
      } catch (error) {
        startedRef.current = false;
        cleanupDemandNoticeCapture();
        onError(error instanceof Error ? error.message : "Failed to generate demand notice PDF.");
      }
    }

    void captureCurrent();

    return () => {
      cancelled = true;
    };
  }, [finished, index, job, onComplete, onError, onProgress]);

  if (finished || index >= job.payloads.length) return null;

  const payload = job.payloads[index];
  if (!payload) return null;

  return (
    <div
      key={payload.propertyId}
      ref={mountRef}
      className={`demand-notice demand-notice-bulk-pdf-capture ${demandNoticeFontClassName} pointer-events-none fixed top-0 -left-3000 z-[-1] w-[210mm] bg-white`}
      aria-hidden
    >
      <DemandNoticeDocument {...payload} />
    </div>
  );
}

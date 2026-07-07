"use client";

import { waitForNoticeImages } from "@/lib/reports/generate-demand-notice-bulk-pdf";
import { useCallback, useEffect } from "react";

const MIN_SCALE = 0.5;
const PRINT_ROOT_SELECTOR = ".demand-notice-print-root";
const SCALER_SELECTOR = ".demand-notice-print-scaler";
const VIEWPORT_SELECTOR = ".demand-notice-print-viewport";
const SCREEN_LAYOUT_SELECTOR = '[data-dn-layout="screen"]';
const PRINT_MEASURE_CLASS = "dn-print-measure";

let printPrepared = false;

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function clearPrintScale(scaler: HTMLElement) {
  scaler.style.removeProperty("--dn-scale");
  scaler.style.removeProperty("zoom");
  scaler.style.removeProperty("transform");
  scaler.style.removeProperty("transform-origin");
  scaler.style.width = "";
}

function applyPrintScale(scaler: HTMLElement, scale: number) {
  clearPrintScale(scaler);
  if (scale >= 0.999) return;

  const rounded = Math.floor(scale * 100) / 100;
  scaler.style.setProperty("--dn-scale", String(rounded));

  if (typeof CSS !== "undefined" && CSS.supports("zoom", "1")) {
    scaler.style.zoom = String(rounded);
    return;
  }

  scaler.style.width = `calc(var(--dn-content-w) / ${rounded})`;
  scaler.style.transform = `scale(${rounded})`;
  scaler.style.transformOrigin = "top left";
}

function measurePrintRootHeight(): number {
  const root = document.querySelector<HTMLElement>(PRINT_ROOT_SELECTOR);
  return root?.scrollHeight ?? 0;
}

function fitScaleIfNeeded(): void {
  const scaler = document.querySelector<HTMLElement>(SCALER_SELECTOR);
  const viewport = document.querySelector<HTMLElement>(VIEWPORT_SELECTOR);
  if (!scaler || !viewport) return;

  clearPrintScale(scaler);

  const contentHeight = measurePrintRootHeight();
  const boxHeight = viewport.clientHeight || viewport.getBoundingClientRect().height;
  if (!boxHeight || contentHeight <= boxHeight + 4) return;

  const scale = Math.max(MIN_SCALE, Math.floor((boxHeight / contentHeight) * 100) / 100);
  applyPrintScale(scaler, scale);
}

function activatePrintLayout() {
  const html = document.documentElement;
  const screenLayout = document.querySelector<HTMLElement>(SCREEN_LAYOUT_SELECTOR);
  const printRoot = document.querySelector<HTMLElement>(PRINT_ROOT_SELECTOR);

  html.classList.add(PRINT_MEASURE_CLASS);

  if (screenLayout && !screenLayout.dataset.dnMeasureActive) {
    screenLayout.dataset.dnMeasureRestoreDisplay = screenLayout.style.display;
    screenLayout.style.display = "none";
    screenLayout.dataset.dnMeasureActive = "1";
  }
  if (printRoot && !printRoot.dataset.dnMeasureActive) {
    printRoot.dataset.dnMeasureRestoreDisplay = printRoot.style.display;
    printRoot.style.display = "flex";
    printRoot.dataset.dnMeasureActive = "1";
  }

  printPrepared = true;
}

async function preparePrint(): Promise<void> {
  if (typeof document === "undefined") return;

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  if (!printPrepared) {
    activatePrintLayout();
  }

  await waitForLayout();
  fitScaleIfNeeded();
  await waitForLayout();

  const printRoot = document.querySelector<HTMLElement>(PRINT_ROOT_SELECTOR);
  if (printRoot) {
    await waitForNoticeImages(printRoot);
  }
}

function cleanupPrint() {
  const scaler = document.querySelector<HTMLElement>(SCALER_SELECTOR);
  if (scaler) {
    clearPrintScale(scaler);
  }

  const screenLayout = document.querySelector<HTMLElement>(SCREEN_LAYOUT_SELECTOR);
  const printRoot = document.querySelector<HTMLElement>(PRINT_ROOT_SELECTOR);

  if (screenLayout?.dataset.dnMeasureActive) {
    screenLayout.style.display = screenLayout.dataset.dnMeasureRestoreDisplay ?? "";
    delete screenLayout.dataset.dnMeasureRestoreDisplay;
    delete screenLayout.dataset.dnMeasureActive;
  }
  if (printRoot?.dataset.dnMeasureActive) {
    printRoot.style.display = printRoot.dataset.dnMeasureRestoreDisplay ?? "";
    delete printRoot.dataset.dnMeasureRestoreDisplay;
    delete printRoot.dataset.dnMeasureActive;
  }

  document.documentElement.classList.remove(PRINT_MEASURE_CLASS);
  printPrepared = false;
}

/** Activates print layout; scales down only when content exceeds A4 printable height. */
export function useDemandNoticePrintFit() {
  useEffect(() => {
    const onBeforePrint = () => {
      if (!printPrepared) {
        activatePrintLayout();
      }
      fitScaleIfNeeded();
    };
    const onAfterPrint = () => {
      cleanupPrint();
    };

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      cleanupPrint();
    };
  }, []);

  const printNotice = useCallback(async () => {
    await preparePrint();
    await waitForLayout();
    window.print();
  }, []);

  return { printNotice };
}

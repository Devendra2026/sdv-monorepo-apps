import jsPDF from "jspdf";

function waitForLayout(frames = 2): Promise<void> {
  return new Promise((resolve) => {
    let remaining = frames;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function waitForImage(img: HTMLImageElement, timeoutMs = 8000, strict = false): Promise<void> {
  if (img.complete && img.naturalWidth > 0) {
    return typeof img.decode === "function" ? img.decode().catch(() => undefined) : Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      if (strict) {
        reject(new Error(`Timed out loading GIS static map: ${img.alt || "map image"}`));
      } else {
        reject(new Error("Timed out loading demand notice image."));
      }
    }, timeoutMs);

    const onDone = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      if (strict) {
        reject(new Error(`Failed to load GIS static map: ${img.alt || img.src}`));
      } else {
        resolve();
      }
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      img.removeEventListener("load", onDone);
      img.removeEventListener("error", onError);
    };

    img.addEventListener("load", onDone, { once: true });
    img.addEventListener("error", onError, { once: true });
  });
}

export async function waitForNoticeImages(printRoot: HTMLElement, timeoutMs = 8000): Promise<void> {
  const allImages = [...printRoot.querySelectorAll<HTMLImageElement>("img")];
  const gisStaticImages = [...printRoot.querySelectorAll<HTMLImageElement>("img[data-gis-static-map]")];

  await Promise.all(allImages.map((img) => waitForImage(img, timeoutMs, gisStaticImages.includes(img))));
}

export async function findDemandNoticePrintRoot(mount: HTMLElement | null, attempts = 8): Promise<HTMLElement> {
  async function tryFind(remaining: number): Promise<HTMLElement> {
    const printRoot = mount?.querySelector<HTMLElement>(".demand-notice-print-root");
    if (printRoot) return printRoot;
    if (remaining <= 1) throw new Error("Demand notice print layout was not ready.");
    await waitForLayout(1);
    return tryFind(remaining - 1);
  }

  return tryFind(attempts);
}

export async function captureDemandNoticePrintRoot(
  doc: jsPDF,
  printRoot: HTMLElement,
  isFirstPage: boolean,
): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;

  if (!isFirstPage) {
    doc.addPage("a4", "portrait");
  }

  const canvas = await html2canvas(printRoot, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    ignoreElements: (el) => el.tagName === "IFRAME",
    width: printRoot.scrollWidth,
    height: printRoot.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  const drawHeight = Math.min(imgHeight, pageHeight);

  doc.addImage(imgData, "JPEG", 0, 0, pageWidth, drawHeight);
}

export function createDemandNoticeBulkPdf(): jsPDF {
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
}

export function saveDemandNoticeBulkPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function demandNoticeBulkPdfBlob(doc: jsPDF): Blob {
  return doc.output("blob");
}

export async function prepareDemandNoticeCapture(): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  document.documentElement.classList.add("dn-print-measure");
  await waitForLayout(4);
}

export function cleanupDemandNoticeCapture() {
  document.documentElement.classList.remove("dn-print-measure");
}

export { buildBulkDemandNoticeFilename } from "@/lib/reports/demand-notice-filename";

import { ConvexReactClient } from "convex/react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  // Fail loud in dev — a missing URL silently breaks every query.
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set. Point it at the SAME Convex deployment used by the mobile app.");
}

if (typeof window !== "undefined") {
  const host = window.location.hostname;
  const onProdHost = host.endsWith("sdvedutech.in");
  if (onProdHost && url.includes(".convex.cloud")) {
    console.error(
      `[Convex] Production site is connected to Convex Cloud (${url}) instead of self-hosted API. Rebuild with npm run build:prod and set NEXT_PUBLIC_CONVEX_URL=https://api.sdvedutech.in in Dokploy.`,
    );
  }
}

export const convex = new ConvexReactClient(url);

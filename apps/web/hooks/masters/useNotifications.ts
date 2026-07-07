"use client";

/** Notifications — bound to the existing notification functions in masters.ts. */
import { api } from "@workspace/backend/convex/_generated/api.js";
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready";
import { useMutation, useQuery } from "convex/react";

export function useNotifications(limit = 30, enabled = true) {
  const ready = useConvexAuthReady();
  return useQuery(api.masters.queries.listNotifications, ready && enabled ? { limit } : "skip");
}

export function useUnreadCount(enabled = true) {
  const ready = useConvexAuthReady();
  return useQuery(api.masters.queries.unreadCount, ready && enabled ? {} : "skip") ?? 0;
}

export function useMarkRead() {
  return useMutation(api.masters.mutations.markRead);
}

export function useMarkAllRead() {
  return useMutation(api.masters.mutations.markAllRead);
}

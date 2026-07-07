"use client";

import {
  getServerSidebarCollapsed,
  getSidebarCollapsed,
  setSidebarCollapsed,
  subscribeSidebarCollapsed,
} from "@/lib/sidebar-storage";
import { createContext, use, useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

type SidebarContextValue = {
  collapsed: boolean;
  mobileOpen: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;
  setMobileOpen: (v: boolean) => void;
  toggleMobile: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribeSidebarCollapsed, getSidebarCollapsed, getServerSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const setCollapsed = useCallback((value: boolean) => {
    setSidebarCollapsed(value);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed(!getSidebarCollapsed());
  }, []);

  const toggleMobile = useCallback(() => setMobileOpen((p) => !p), []);

  const value = useMemo(
    () => ({
      collapsed,
      mobileOpen,
      setCollapsed,
      toggleCollapsed,
      setMobileOpen,
      toggleMobile,
    }),
    [collapsed, mobileOpen, setCollapsed, toggleCollapsed, toggleMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = use(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

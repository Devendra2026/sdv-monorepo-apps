"use client"

import { SURVEY_MODULE } from "@/lib/design-system"
import { cn } from "@workspace/ui/lib/utils"
import { usePathname } from "next/navigation"

/** Indigo-themed shell — visually distinct from the QC (amber) module. */
export default function SurveyPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const inPortal = pathname === "/surveys" || pathname.startsWith("/surveys/")

  if (!inPortal) return <>{children}</>

  return (
    <div
      className={cn(
        "survey-portal -mx-4 -mt-2 min-h-full space-y-0 rounded-none font-display sm:-mx-5 lg:-mx-8",
        SURVEY_MODULE.portalShell,
        SURVEY_MODULE.portalGradient
      )}
      data-module="surveys"
    >
      <div className="mx-auto w-full max-w-360 space-y-6 px-4 pt-4 pb-2 sm:px-5 lg:space-y-8 lg:px-8 lg:pt-6">
        {children}
      </div>
    </div>
  )
}

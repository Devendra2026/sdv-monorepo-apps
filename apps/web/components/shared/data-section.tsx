"use client"

import { AnimatePresence, m, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

export function DataSection({
  ready,
  skeleton,
  children,
  ariaLabel,
  className,
}: {
  ready: boolean
  skeleton: ReactNode
  children: ReactNode
  ariaLabel: string
  className?: string
}) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className={className} aria-live="polite">
        {ready ? (
          children
        ) : (
          <div aria-busy="true" aria-label={ariaLabel}>
            {skeleton}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={className} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {!ready ? (
          <m.div
            key="skeleton"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            aria-busy="true"
            aria-label={ariaLabel}
          >
            {skeleton}
          </m.div>
        ) : (
          <m.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

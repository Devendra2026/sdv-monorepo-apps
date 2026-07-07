"use client"

import { Button } from "@workspace/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

const iconTransition =
  "transition-all duration-300 motion-reduce:transition-none motion-reduce:rotate-0 motion-reduce:scale-100"

function subscribeNoop() {
  return () => {}
}

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )

  if (!mounted) {
    return <div className="topbar-action-btn bg-muted/30" aria-hidden />
  }

  const isDark = resolvedTheme === "dark"
  const label = isDark ? "Switch to light mode" : "Switch to dark mode"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="topbar-action-btn relative cursor-pointer"
          aria-label={label}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          <Sun className={cn(iconTransition, "scale-100 rotate-0 dark:scale-0 dark:-rotate-90")} aria-hidden />
          <Moon className={cn(iconTransition, "absolute scale-0 rotate-90 dark:scale-100 dark:rotate-0")} aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

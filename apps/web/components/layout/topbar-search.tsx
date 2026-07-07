"use client"

import { openCommandPalette } from "@/lib/command-palette"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

export function TopbarSearch() {
  const router = useRouter()
  const [search, setSearch] = useState("")

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const q = search.trim()
      if (q) router.push(`/surveys?search=${encodeURIComponent(q)}`)
    },
    [search, router]
  )

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="topbar-action-btn sm:hidden"
        onClick={openCommandPalette}
        aria-label="Open search"
      >
        <Search className="h-[1.125rem] w-[1.125rem]" />
      </Button>

      <form
        onSubmit={handleSubmit}
        className="relative hidden min-w-0 flex-1 sm:block sm:max-w-md lg:max-w-lg"
        role="search"
      >
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search surveys, parcels, wards…"
          className={cn(
            "topbar-search-field theme-transition h-9 w-full rounded-full pr-14 pl-9 text-sm shadow-none",
            "placeholder:text-muted-foreground/70 focus-visible:ring-0"
          )}
          aria-label="Global search"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </form>
    </>
  )
}

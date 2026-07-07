"use client"

import { COMMAND_PALETTE_OPEN_EVENT } from "@/lib/command-palette"
import { navKeysForUser, type Role } from "@/lib/permissions"
import { useCurrentUser } from "@/lib/sessions"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/command"
import {
  ClipboardList,
  Database,
  FileBarChart,
  LayoutDashboard,
  Moon,
  ScrollText,
  Settings,
  ShieldCheck,
  ShieldEllipsis,
  Sun,
  Users,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

const NAV_COMMANDS = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "surveys", href: "/surveys", label: "Surveys", icon: ClipboardList },
  { key: "qc", href: "/qc", label: "Quality Control", icon: ShieldCheck },
  { key: "users", href: "/users", label: "Users", icon: Users },
  { key: "roles", href: "/roles", label: "Roles & Permissions", icon: ShieldEllipsis },
  { key: "masters", href: "/masters", label: "Master Data", icon: Database },
  { key: "reports", href: "/reports", label: "Reports", icon: FileBarChart },
  { key: "audit", href: "/audit", label: "Audit Log", icon: ScrollText },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
]

const ACTIONS = [
  { label: "New Survey", href: "/surveys/new", keywords: "create add" },
  { label: "QC Queue", href: "/qc", keywords: "review pending" },
  { label: "Export Reports", href: "/reports", keywords: "pdf excel download" },
  {
    label: "Demand Notice Panel",
    href: "/reports/demand-notices",
    keywords: "demand notice register print qc approved",
  },
  { label: "QC Final Report Register", href: "/reports/qc-final", keywords: "qc final ward report approved" },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { role, capabilities } = useCurrentUser()
  const { setTheme } = useTheme()
  const visible = navKeysForUser(capabilities, (role ?? "pending") as Role)
  const navCommands = useMemo(() => {
    const visibleSet = new Set(visible)
    const items: (typeof NAV_COMMANDS)[number][] = []
    for (const item of NAV_COMMANDS) {
      if (visibleSet.has(item.key)) items.push(item)
    }
    return items
  }, [visible])

  const run = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    document.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen)
    return () => document.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command Palette" description="Navigate or run actions">
      <CommandInput placeholder="Search pages, actions, settings…" aria-label="Search commands" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navCommands.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.key} value={item.label} onSelect={() => run(item.href)} className="cursor-pointer">
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          {ACTIONS.map((action) => (
            <CommandItem
              key={action.href}
              value={`${action.label} ${action.keywords}`}
              onSelect={() => run(action.href)}
              className="cursor-pointer"
            >
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Appearance">
          <CommandItem onSelect={() => setTheme("light")} className="cursor-pointer">
            <Sun className="h-4 w-4" aria-hidden />
            Light mode
          </CommandItem>
          <CommandItem onSelect={() => setTheme("dark")} className="cursor-pointer">
            <Moon className="h-4 w-4" aria-hidden />
            Dark mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
        <kbd className="rounded border border-border px-1 font-mono">⌘K</kbd> to toggle · Navigate with ↑↓ · Enter to
        select
      </div>
    </CommandDialog>
  )
}

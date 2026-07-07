import type { LucideIcon } from "lucide-react"
import {
  ClipboardList,
  Database,
  FileBarChart,
  LayoutDashboard,
  LayoutGrid,
  ScrollText,
  Settings,
  ShieldEllipsis,
  Table2,
  Users,
} from "lucide-react"

export type NavAccent = "violet" | "sapphire" | "emerald" | "amber" | "amethyst"

export type NavLeaf = {
  kind: "link"
  key: string
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  accent: NavAccent
}

export type NavGroup = {
  kind: "group"
  key: string
  label: string
  icon: LucideIcon
  accent: NavAccent
  children: NavLeaf[]
}

export type NavNode = NavLeaf | NavGroup

export const NAV_TREE: NavNode[] = [
  {
    kind: "link",
    key: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    accent: "violet",
  },
  {
    kind: "group",
    key: "field_surveys",
    label: "Field Surveys",
    icon: ClipboardList,
    accent: "sapphire",
    children: [
      {
        kind: "link",
        key: "surveys",
        href: "/surveys",
        label: "Command Center",
        icon: ClipboardList,
        exact: true,
        accent: "sapphire",
      },
      {
        kind: "link",
        key: "surveys_registry",
        href: "/surveys/registry",
        label: "Survey Registry",
        icon: Table2,
        accent: "sapphire",
      },
    ],
  },
  {
    kind: "group",
    key: "qc_portal",
    label: "QC Portal",
    icon: LayoutGrid,
    accent: "amber",
    children: [
      {
        kind: "link",
        key: "qc",
        href: "/qc",
        label: "Command Center",
        icon: LayoutGrid,
        exact: true,
        accent: "amber",
      },
      {
        kind: "link",
        key: "qc_registry",
        href: "/qc/registry",
        label: "QC Registry",
        icon: Table2,
        accent: "amber",
      },
    ],
  },
  {
    kind: "link",
    key: "reports",
    href: "/reports",
    label: "Reports",
    icon: FileBarChart,
    accent: "emerald",
  },
  {
    kind: "group",
    key: "administration",
    label: "Administration",
    icon: Users,
    accent: "amethyst",
    children: [
      { kind: "link", key: "users", href: "/users", label: "Users", icon: Users, accent: "amethyst" },
      { kind: "link", key: "roles", href: "/roles", label: "Roles", icon: ShieldEllipsis, accent: "amethyst" },
      { kind: "link", key: "masters", href: "/masters", label: "Master Data", icon: Database, accent: "amethyst" },
      { kind: "link", key: "audit", href: "/audit", label: "Audit Log", icon: ScrollText, accent: "amethyst" },
    ],
  },
  {
    kind: "link",
    key: "settings",
    href: "/settings",
    label: "Settings",
    icon: Settings,
    accent: "violet",
  },
]

export function isNavLeaf(node: NavNode): node is NavLeaf {
  return node.kind === "link"
}

export function isNavGroup(node: NavNode): node is NavGroup {
  return node.kind === "group"
}

export function isNavItemActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function filterNavTree(visibleKeys: Set<string>): NavNode[] {
  const result: NavNode[] = []

  for (const node of NAV_TREE) {
    if (isNavLeaf(node)) {
      if (visibleKeys.has(node.key)) result.push(node)
      continue
    }

    const children = node.children.filter((child) => visibleKeys.has(child.key))
    if (children.length > 0) {
      result.push({ ...node, children })
    }
  }

  return result
}

export const NAV_ACCENT_CLASS: Record<NavAccent, string> = {
  violet: "nav-accent-violet",
  sapphire: "nav-accent-sapphire",
  emerald: "nav-accent-emerald",
  amber: "nav-accent-amber",
  amethyst: "nav-accent-amethyst",
}

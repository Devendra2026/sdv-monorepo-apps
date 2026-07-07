"use client"

import { filterNavTree, isNavGroup, isNavLeaf } from "@/components/layout/nav-config"
import { SidebarNavGroup } from "@/components/layout/sidebar-nav-group"
import { SidebarNavLink } from "@/components/layout/sidebar-nav-link"
import { navKeysForUser, type Role } from "@/lib/permissions"
import { useCurrentUser } from "@/lib/sessions"

export function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { role, capabilities } = useCurrentUser()
  const visibleKeys = new Set(navKeysForUser(capabilities, (role ?? "pending") as Role))
  const tree = filterNavTree(visibleKeys)

  return (
    <nav
      className="premium-scrollbar flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-2 py-3"
      aria-label="Main navigation"
    >
      <ul className="space-y-0.5" role="list">
        {tree.map((node) => (
          <li key={node.key}>
            {isNavLeaf(node) ? (
              <SidebarNavLink item={node} collapsed={collapsed} onNavigate={onNavigate} />
            ) : isNavGroup(node) ? (
              <SidebarNavGroup group={node} collapsed={collapsed} onNavigate={onNavigate} />
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  )
}

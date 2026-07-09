"use client"

import { ExecutiveHero } from "@/components/design-system/executive-hero"
import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card"
import { FadeIn } from "@/components/design-system/motion"
import { USER_ROLE_LABEL, USER_STATUS_LABEL, type UserRole, type UserStatus } from "@/lib/domain"
import type { Role } from "@/lib/permissions"
import { useCurrentUser } from "@/lib/sessions"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { MapPin, Settings, User } from "lucide-react"
import type { ReactNode } from "react"

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

function statusBadgeVariant(status: UserStatus): "default" | "secondary" | "destructive" {
  if (status === "active") return "default"
  if (status === "disabled") return "destructive"
  return "secondary"
}

function roleLabel(role: Role | undefined): string {
  if (!role) return "—"
  return USER_ROLE_LABEL[role as UserRole] ?? role
}

function SettingsPageSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, role, isLoading } = useCurrentUser()

  if (isLoading || !user) {
    return <SettingsPageSkeleton />
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <FadeIn>
        <ExecutiveHero
          eyebrow="Account"
          title="Settings"
          description="Your profile and assigned scope. Scope changes are made by an administrator."
          icon={Settings}
          gradient="brand"
        />
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard variant="default" padding="none">
          <div className="p-5 lg:p-6">
            <GlassCardHeader
              title="Profile"
              description="Identity and access role for this account."
              icon={<User className="h-4 w-4" aria-hidden />}
            />
            <Row label="Name" value={user.name} />
            <Row label="Email" value={user.email} />
            <Row label="Role" value={role ? <Badge variant="outline">{roleLabel(role)}</Badge> : "—"} />
            <Row
              label="Account status"
              value={<Badge variant={statusBadgeVariant(user.status)}>{USER_STATUS_LABEL[user.status]}</Badge>}
            />
          </div>
        </GlassCard>

        <GlassCard variant="default" padding="none">
          <div className="p-5 lg:p-6">
            <GlassCardHeader
              title="Assigned scope"
              description="District, municipality, and ward coverage enforced server-side."
              icon={<MapPin className="h-4 w-4" aria-hidden />}
            />
            <Row label="District" value={user.district?.name ?? "—"} />
            <Row label="Municipality" value={user.municipality?.name ?? "—"} />
            <Row label="Wards" value={user.wardAssignments.length ? user.wardAssignments.join(", ") : "All in ULB"} />
          </div>
        </GlassCard>
      </div>

      <p className="text-xs text-muted-foreground">
        Authentication is managed by Clerk (use the avatar menu, top-right, to manage your account or sign out). Your
        role and tenant scope are enforced server-side on the shared Convex backend.
      </p>
    </div>
  )
}

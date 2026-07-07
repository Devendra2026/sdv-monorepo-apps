"use client";

import { ExecutiveHero, SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard } from "@/components/design-system/glass-card";
import { MetricCard } from "@/components/design-system/metric-card";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/design-system/motion";
import { Button } from "@/components/ui/button";
import type { ListedUser, PendingUser } from "@/components/users/users-page-shared";
import { Ban, Building2, CheckCircle2, Clock, Layers, MapPin, UserCheck, Users } from "lucide-react";
import Link from "next/link";

export function UsersHero() {
  return (
    <FadeIn>
      <ExecutiveHero
        eyebrow="Access Management"
        title="User Command Center"
        description="Approve sign-ups, assign system roles, and scope QC supervisors to districts, ULBs, and wards across your tenant."
        icon={UserCheck}
        gradient="brand"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-10 w-full cursor-pointer rounded-xl border-border/70 bg-card/90 px-4 shadow-premium-sm sm:w-auto"
            >
              <Link href="/roles">
                <Layers className="h-4 w-4" aria-hidden />
                Roles & permissions
              </Link>
            </Button>
            <Button
              size="sm"
              className="h-10 w-full cursor-pointer rounded-xl px-4 shadow-md sm:w-auto"
              onClick={() => document.getElementById("users-registry")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Users className="h-4 w-4" aria-hidden />
              Open registry
            </Button>
          </div>
        }
      />
    </FadeIn>
  );
}

export function UsersPendingAlert({ pending }: { pending: PendingUser[] | undefined }) {
  const count = pending?.length ?? 0;
  if (count <= 0) return null;

  return (
    <FadeIn delay={0.04}>
      <output className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {count} registration{count === 1 ? "" : "s"} awaiting approval
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Assign a <strong className="font-medium text-foreground">system role</strong> (Supervisor for QC) and
              tenant scope before activating accounts.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-10 w-full shrink-0 cursor-pointer rounded-xl border-warning/50 bg-background/80 sm:w-auto"
          onClick={() => document.getElementById("users-registry")?.scrollIntoView({ behavior: "smooth" })}
        >
          <UserCheck className="h-4 w-4" aria-hidden />
          Review queue
        </Button>
      </output>
    </FadeIn>
  );
}

export function UsersTenancyGuide() {
  return (
    <FadeIn delay={0.06}>
      <GlassCard padding="md" className="border-brand-navy/10 dark:border-primary/15">
        <SectionHeader
          title="Tenant scope for field roles"
          description="How district, ULB, and ward assignments work"
          className="mb-4"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
              <MapPin className="h-4 w-4" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">District</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              QC supervisors covering every ULB in a district — ideal for regional leads.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              <Building2 className="h-4 w-4" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">ULB (city)</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Single municipality access. Use multi-city allotments when one supervisor spans several ULBs.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Layers className="h-4 w-4" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">Ward (optional)</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Limit surveyors or QC supervisors to specific wards inside a ULB. Empty means all wards.
            </p>
          </div>
        </div>
      </GlassCard>
    </FadeIn>
  );
}

export function UsersMetricsSection({
  pending,
  users,
  activeCount,
  disabledCount,
}: {
  pending: PendingUser[] | undefined;
  users: ListedUser[] | undefined;
  activeCount: number;
  disabledCount: number;
}) {
  return (
    <section aria-labelledby="users-kpi-heading">
      <SectionHeader
        id="users-kpi-heading"
        title="Directory health"
        description="Approval backlog and account status at a glance"
        className="mb-4"
      />
      <StaggerGrid className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StaggerItem>
          <MetricCard
            label="Pending Approval"
            value={pending?.length ?? "—"}
            hint="awaiting supervisor review"
            icon={Clock}
            tone="warning"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard label="Total Users" value={users?.length ?? "—"} hint="on this page" icon={Users} tone="info" />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Active"
            value={users ? activeCount : "—"}
            hint="can sign in today"
            icon={CheckCircle2}
            tone="success"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Disabled"
            value={users ? disabledCount : "—"}
            hint="access revoked"
            icon={Ban}
            tone="destructive"
          />
        </StaggerItem>
      </StaggerGrid>
    </section>
  );
}

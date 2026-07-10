"use client"

import { ADMIN_TABS_LIST, AdminTabPill } from "@/components/admin/admin-tabs"
import { SectionHeader } from "@/components/design-system/executive-hero"
import { GlassCard } from "@/components/design-system/glass-card"
import { MasterDataTab } from "@/components/masters/master-data-tab"
import { MastersHero, MastersMetricsSection } from "@/components/masters/masters-page-sections"
import { TaxRatesTab } from "@/components/masters/tax-rates-tab"
import { TenantsTab } from "@/components/masters/tenants-tab"
import { RoleGate } from "@/components/shared/role-gate"
import { useTenantAdmin } from "@/hooks/tenants/useTenants"
import { useClientMounted } from "@/hooks/use-client-mounted"
import { MASTER_CATEGORIES } from "@/lib/domain"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { Tabs, TabsContent, TabsList } from "@workspace/ui/components/tabs"
import { usePreloadedQuery, type Preloaded } from "convex/react"
import { Database, IndianRupee, MapPin } from "lucide-react"
import { useMemo, useState } from "react"

type MastersClientProps = {
  preloadedTenants: Preloaded<typeof api.tenants.queries.listForAdmin>
}

export function MastersClient({ preloadedTenants }: MastersClientProps) {
  const mounted = useClientMounted()
  const seedTenants = usePreloadedQuery(preloadedTenants)
  const liveTenants = useTenantAdmin()
  const tenants = liveTenants ?? seedTenants
  const [activeTab, setActiveTab] = useState<"masters" | "tenants" | "tax-rates">("masters")

  const tenantStats = useMemo(() => {
    if (!tenants) return null
    const ulbCount = tenants.reduce((acc, d) => acc + d.ulbs.length, 0)
    const wardCount = tenants.reduce((acc, d) => acc + d.ulbs.reduce((a, u) => a + u.wards.length, 0), 0)
    return { districts: tenants.length, ulbs: ulbCount, wards: wardCount }
  }, [tenants])

  return (
    <RoleGate mode="page" capability="masters.manage" deniedDescription="Master data management is admin-only.">
      <div className="space-y-6 lg:space-y-8">
        <MastersHero />

        <MastersMetricsSection activeTab={activeTab} categories={MASTER_CATEGORIES.length} tenantStats={tenantStats} />

        <GlassCard padding="none" className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-4">
            <SectionHeader
              title="Configuration Registry"
              description="Reference dropdowns and geographic tenant hierarchy"
            />
          </div>
          {mounted ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "masters" | "tenants" | "tax-rates")}>
              <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5">
                <TabsList className={ADMIN_TABS_LIST}>
                  <AdminTabPill
                    value="masters"
                    label="Reference Data"
                    icon={<Database className="h-3.5 w-3.5" aria-hidden />}
                  />
                  <AdminTabPill
                    value="tenants"
                    label="Tenants & Wards"
                    count={tenantStats && tenantStats.districts > 0 ? tenantStats.districts : undefined}
                    icon={<MapPin className="h-3.5 w-3.5" aria-hidden />}
                    activeColor="data-[state=active]:bg-brand-navy data-[state=active]:text-white dark:data-[state=active]:bg-primary"
                  />
                  <AdminTabPill
                    value="tax-rates"
                    label="Tax Rates"
                    icon={<IndianRupee className="h-3.5 w-3.5" aria-hidden />}
                    activeColor="data-[state=active]:bg-emerald-700 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-600"
                  />
                </TabsList>
              </div>

              <TabsContent value="masters" className="mt-0 p-4 lg:p-5">
                <MasterDataTab />
              </TabsContent>

              <TabsContent value="tenants" className="mt-0 p-4 lg:p-5">
                <TenantsTab tenants={tenants} />
              </TabsContent>

              <TabsContent value="tax-rates" className="mt-0 p-4 lg:p-5">
                <TaxRatesTab tenants={tenants} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="p-4 lg:p-5" aria-busy="true" aria-label="Loading registry tabs">
              <div className="flex gap-2 border-b border-border/60 pb-3">
                <div className="h-9 w-28 animate-pulse rounded-xl bg-muted" />
                <div className="h-9 w-32 animate-pulse rounded-xl bg-muted" />
                <div className="h-9 w-24 animate-pulse rounded-xl bg-muted" />
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </RoleGate>
  )
}

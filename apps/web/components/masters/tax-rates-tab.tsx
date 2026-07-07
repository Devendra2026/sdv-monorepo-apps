"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { UlbRateEditor } from "@/components/masters/ulb-rate-editor";
import type { WardInfo } from "@/components/masters/tax-rates-types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTenantAdmin } from "@/hooks/tenants/useTenants";
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

export function TaxRatesTab() {
  const ready = useConvexAuthReady();
  const tenants = useTenantAdmin();
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedMuniId, setSelectedMuniId] = useState("");

  const { data: allRates } = useQuery(convexQuery(api.taxRates.listAll, ready ? {} : "skip"));

  const rateStatusByMuni = useMemo(() => {
    if (!allRates) return new Map<string, { published: boolean; wardCount: number }>();
    return new Map(
      allRates.map((r) => [
        r.municipality._id,
        {
          published: r.rates !== null,
          wardCount: r.rates ? Object.keys(r.rates.wardRates).length : 0,
        },
      ]),
    );
  }, [allRates]);

  const activeDistrictId = useMemo(() => {
    if (selectedDistrictId && tenants?.some((d) => d._id === selectedDistrictId)) return selectedDistrictId;
    return tenants?.[0]?._id ?? "";
  }, [tenants, selectedDistrictId]);

  const selectedDistrict = tenants?.find((d) => d._id === activeDistrictId);
  const ulbs = selectedDistrict?.ulbs ?? [];

  const activeMuniId = useMemo(() => {
    const districtUlbs = selectedDistrict?.ulbs ?? [];
    if (selectedMuniId && districtUlbs.some((u) => u._id === selectedMuniId)) return selectedMuniId;
    return districtUlbs[0]?._id ?? "";
  }, [selectedDistrict, selectedMuniId]);

  const selectedUlb = ulbs.find((u) => u._id === activeMuniId);
  const wards: WardInfo[] = useMemo(
    () =>
      (selectedUlb?.wards ?? []).map((w) => ({
        wardNo: w.wardNo,
        name: w.name,
        wardCode: w.wardCode,
      })),
    [selectedUlb],
  );

  function handleDistrictChange(id: string) {
    setSelectedDistrictId(id);
    const d = tenants?.find((t) => t._id === id);
    setSelectedMuniId(d?.ulbs[0]?._id ?? "");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-linear-to-r from-emerald-50/80 to-background px-4 py-3 dark:border-emerald-800/40 dark:from-emerald-950/20">
        <IndianRupee className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
        <div className="text-sm leading-relaxed">
          <p className="font-semibold text-foreground">Ward-wise Minimum Rental Rate Schedule</p>
          <p className="text-muted-foreground">
            Configure monthly rates per ward, road width, and construction type. Demand notices pick the matrix for the
            survey&apos;s ward automatically.
          </p>
        </div>
      </div>

      <GlassCard padding="md">
        <GlassCardHeader title="Select Municipality" icon={<MapPin className="h-4 w-4" aria-hidden />} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="district-select"
              className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              District
            </Label>
            <Select value={activeDistrictId} onValueChange={handleDistrictChange}>
              <SelectTrigger id="district-select" className="cursor-pointer">
                <SelectValue placeholder="Select district…" />
              </SelectTrigger>
              <SelectContent>
                {tenants?.map((d) => (
                  <SelectItem key={d._id} value={d._id} className="cursor-pointer">
                    {d.name}
                    <span className="ml-2 text-xs text-muted-foreground">{d.ulbs.length} ULBs</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="ulb-select"
              className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Municipality
            </Label>
            <Select value={activeMuniId} onValueChange={setSelectedMuniId} disabled={ulbs.length === 0}>
              <SelectTrigger id="ulb-select" className="cursor-pointer">
                <SelectValue placeholder="Select ULB…" />
              </SelectTrigger>
              <SelectContent>
                {ulbs.map((u) => {
                  const status = rateStatusByMuni.get(u._id);
                  return (
                    <SelectItem key={u._id} value={u._id} className="cursor-pointer">
                      <span className="flex items-center gap-2">
                        {u.name}
                        <span className="text-xs text-muted-foreground">{u.wards.length} wards</span>
                        {status?.published && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {status.wardCount > 0 ? `${status.wardCount} set` : "Published"}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {activeMuniId && selectedDistrict && selectedUlb ? (
        <UlbRateEditor
          key={activeMuniId}
          municipalityId={activeMuniId as Id<"municipalities">}
          municipalityName={selectedUlb.name}
          districtName={selectedDistrict.name}
          wards={wards}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <MapPin className="h-8 w-8 opacity-30" aria-hidden />
          <p className="text-sm">Select a district and municipality to configure ward tax rates</p>
        </div>
      )}
    </div>
  );
}

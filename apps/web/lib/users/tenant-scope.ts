import type { Id } from "@/convex/_generated/dataModel";

export type TenantScopeValue = {
  scope: "ulb" | "district";
  districtId: string;
  municipalityId: string;
  wards: string[];
};

export function tenantScopeIsComplete(value: TenantScopeValue): boolean {
  if (!value.districtId) return false;
  if (value.scope === "district") return true;
  return !!value.municipalityId;
}

export function tenantScopeToApproveArgs(value: TenantScopeValue) {
  return {
    districtId: value.districtId ? (value.districtId as Id<"districts">) : undefined,
    municipalityId:
      value.scope === "ulb" && value.municipalityId ? (value.municipalityId as Id<"municipalities">) : undefined,
    wardAssignments: value.wards,
  };
}

import type { Id } from "@/convex/_generated/dataModel";

export type DistrictDraft = {
  id?: Id<"districts">;
  code: string;
  name: string;
  stateName: string;
  isActive: boolean;
};

export type MunicipalityDraft = {
  id?: Id<"municipalities">;
  districtId: Id<"districts">;
  code: string;
  name: string;
  bodyType: "municipal_council" | "town_panchayat";
  postalCode: string;
  isActive: boolean;
};

export type WardDraft = {
  id?: Id<"wards">;
  municipalityId: Id<"municipalities">;
  wardNo: string;
  wardCode: string;
  name: string;
};

export type TenantDistrict = {
  _id: string;
  code: string;
  name: string;
  stateName: string;
  isActive: boolean;
  ulbs: TenantUlb[];
};

export type TenantUlb = {
  _id: string;
  code: string;
  name: string;
  bodyType: string;
  postalCode?: string;
  isActive: boolean;
  wards: TenantWard[];
};

export type TenantWard = {
  _id: string;
  wardNo: string;
  wardCode?: string;
  name: string;
};

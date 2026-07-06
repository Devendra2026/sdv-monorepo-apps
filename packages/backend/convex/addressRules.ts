/**
 * Address-step business rules — locality, colony, tenant city/district, admin PIN.
 */
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireUser } from "./helpers";
import { assertMunicipalityInScope } from "./tenancy";

export const PIN_CODE_RE = /^[1-9]\d{5}$/;

export type AddressFields = {
  houseNo?: string;
  locality?: string;
  colonyName?: string;
  /** @deprecated use colonyName — accepted during upsert for older clients */
  street?: string;
  city?: string;
  pinCode?: string;
};

export type AddressTenantContext = {
  districtId: Id<"districts">;
  districtName: string;
  municipalityId: Id<"municipalities">;
  cityName: string;
  postalCode: string | null;
};

export function isValidPinFormat(pin: string): boolean {
  return PIN_CODE_RE.test(pin);
}

/** Trim optional house; require trimmed locality/colony; city from ULB; normalize PIN digits. */
export function normalizeAddressFields<T extends AddressFields>(
  input: T,
  tenant: Pick<Doc<"municipalities">, "name">,
): T & { locality: string; colonyName: string; city: string; pinCode: string; houseNo?: string } {
  const trimOpt = (s?: string) => {
    const t = s?.trim();
    return t ? t : undefined;
  };
  const colony = trimOpt(input.colonyName) ?? trimOpt(input.street) ?? "";
  const pin = (input.pinCode ?? "").replace(/\D/g, "").slice(0, 6);
  return {
    ...input,
    houseNo: trimOpt(input.houseNo),
    locality: (input.locality ?? "").trim(),
    colonyName: colony,
    city: tenant.name.trim(),
    pinCode: pin,
  };
}

export type AddressValidationMode = "draft" | "submit";

/** Field-level validation for address section (draft = format-only; submit = full rules). */
export function validateAddressSection(
  input: {
    houseNo?: string;
    locality: string;
    colonyName: string;
    city: string;
    pinCode: string;
  },
  tenant: AddressTenantContext & { configuredPostalCode?: string | null },
  mode: AddressValidationMode = "submit",
): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  const strict = mode === "submit";

  if (strict && !input.locality) {
    details.locality = ["Locality name is required"];
  }
  if (strict && !input.colonyName) {
    details.colonyName = ["Colony name is required"];
  }

  if (input.pinCode) {
    if (!isValidPinFormat(input.pinCode)) {
      details.pinCode = ["PIN must be 6 digits, not starting with 0"];
    } else if (strict) {
      if (tenant.configuredPostalCode) {
        if (input.pinCode !== tenant.configuredPostalCode) {
          details.pinCode = [`PIN must be ${tenant.configuredPostalCode} for this ULB`];
        }
      } else {
        details.pinCode = ["Postal code is not configured for this ULB — contact your admin"];
      }
    }
  } else if (strict) {
    details.pinCode = ["PIN code is required"];
  }

  if (input.city && input.city !== tenant.cityName) {
    details.city = ["City must match the selected ULB"];
  }

  return details;
}

export function addressTenantContext(
  muni: Doc<"municipalities">,
  district: Doc<"districts"> | null,
): AddressTenantContext {
  return {
    districtId: muni.districtId,
    districtName: district?.name ?? "",
    municipalityId: muni._id,
    cityName: muni.name,
    postalCode: muni.postalCode ?? null,
  };
}

/** Read-only tenant labels + admin PIN for the address wizard step. */
export const contextForMunicipality = query({
  args: { municipalityId: v.id("municipalities") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const muni = await assertMunicipalityInScope(ctx, me, args.municipalityId);
    const district = await ctx.db.get(muni.districtId);
    const ctxOut = addressTenantContext(muni, district);
    return {
      ...ctxOut,
      configuredPostalCode: muni.postalCode ?? null,
    };
  },
});

import type { QcStatus } from "@/lib/domain";
import { normalizeWardNo } from "@/lib/qc/ward-stats";
import { normalizeParcelKey } from "@/lib/survey/area";
import { resolveOwnerDisplayName } from "@/lib/survey/resolve-owner-name";

export type ParcelSiblingRow = {
  _id: string;
  municipalityId?: string;
  wardNo: string;
  parcelNo: string;
  unitNo?: string;
  propertyUse?: string;
  propertyId?: string;
  respondentName?: string;
  owners?: { name?: string }[];
  qcStatus: QcStatus;
  status?: string;
};

/** Group key: same ULB + ward + parcel (ignores unit and property use). */
function parcelSiblingKey(row: Pick<ParcelSiblingRow, "municipalityId" | "wardNo" | "parcelNo">): string {
  return `${row.municipalityId ?? ""}:${normalizeWardNo(row.wardNo)}:${normalizeParcelKey(row.parcelNo)}`;
}

export type ParcelSiblingGroup = {
  key: string;
  rows: ParcelSiblingRow[];
  count: number;
};

export type ParcelSiblingIndex = {
  /** Parcel key → all rows in that parcel group. */
  groups: Map<string, ParcelSiblingGroup>;
  /** Row id → sibling count on same parcel (including self). */
  countByRowId: Map<string, number>;
  /** Row id → other siblings (excluding self). */
  siblingsByRowId: Map<string, ParcelSiblingRow[]>;
  /** Row id → likely field-error conflict (same unit, different owners, pending). */
  conflictRowIds: Set<string>;
  /** Row id → same parcel has 2+ distinct owner names. */
  differentOwnerRowIds: Set<string>;
  /** Row id → distinct owner count on same parcel (including self). */
  ownerCountByRowId: Map<string, number>;
};

function unitKey(unitNo?: string): string {
  return (unitNo ?? "").trim() || "001";
}

function ownerKey(row: ParcelSiblingRow): string {
  return resolveOwnerDisplayName(row).trim().toLowerCase();
}

const PLACEHOLDER_OWNERS = new Set(["", "—", "na", "n/a", "unknown", "-"]);

/** Placeholders (NA, empty) share one bucket; real names stay distinct. */
function ownerGroupKey(row: ParcelSiblingRow): string {
  const name = ownerKey(row);
  if (PLACEHOLDER_OWNERS.has(name)) return "__placeholder__";
  return name;
}

/** Heuristic: same parcel+unit, different owners, multiple pending QC — likely duplicate entry. */
export function detectParcelConflict(group: ParcelSiblingRow[]): boolean {
  if (group.length < 2) return false;

  const pending = group.filter((r) => r.qcStatus === "pending" && r.status !== "draft");
  if (pending.length < 2) return false;

  const byUnit = new Map<string, Set<string>>();
  for (const row of pending) {
    const uk = unitKey(row.unitNo);
    let owners = byUnit.get(uk);
    if (!owners) {
      owners = new Set();
      byUnit.set(uk, owners);
    }
    owners.add(ownerGroupKey(row));
  }

  for (const owners of byUnit.values()) {
    if (owners.size >= 2) return true;
  }
  return false;
}

function distinctOwnerCount(group: ParcelSiblingRow[]): number {
  const owners = new Set<string>();
  for (const row of group) {
    owners.add(ownerGroupKey(row));
  }
  return owners.size;
}

/** True when the parcel group has 2+ distinct owner names. */
export function hasDifferentOwnersOnParcel(row: ParcelSiblingRow, index: ParcelSiblingIndex): boolean {
  return index.differentOwnerRowIds.has(row._id);
}

/** Active surveys used for parcel sibling indexing (approved or submitted pending). */
export function activeParcelSiblingPool<T extends ParcelSiblingRow>(rows: T[]): T[] {
  return rows.filter((r) => r.qcStatus === "approved" || (r.qcStatus === "pending" && r.status === "submitted"));
}

/** Build sibling index from a list of registry rows (current page or scope). */
export function buildParcelSiblingIndex(rows: ParcelSiblingRow[]): ParcelSiblingIndex {
  const groups = new Map<string, ParcelSiblingGroup>();
  const countByRowId = new Map<string, number>();
  const siblingsByRowId = new Map<string, ParcelSiblingRow[]>();
  const conflictRowIds = new Set<string>();
  const differentOwnerRowIds = new Set<string>();
  const ownerCountByRowId = new Map<string, number>();

  for (const row of rows) {
    if (!row.parcelNo?.trim() || !row.wardNo?.trim()) continue;
    const key = parcelSiblingKey(row);
    let group = groups.get(key);
    if (!group) {
      group = { key, rows: [], count: 0 };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.count += 1;
  }

  for (const group of groups.values()) {
    const hasConflict = detectParcelConflict(group.rows);
    const ownerCount = distinctOwnerCount(group.rows);
    const hasDifferentOwners = ownerCount >= 2;
    const siblingsById = new Map<string, ParcelSiblingRow[]>();
    for (const member of group.rows) {
      siblingsById.set(member._id, []);
    }
    for (const member of group.rows) {
      for (const other of group.rows) {
        if (member._id === other._id) continue;
        siblingsById.get(member._id)?.push(other);
      }
    }
    for (const row of group.rows) {
      countByRowId.set(row._id, group.count);
      ownerCountByRowId.set(row._id, ownerCount);
      siblingsByRowId.set(row._id, siblingsById.get(row._id) ?? []);
      if (hasConflict) conflictRowIds.add(row._id);
      if (hasDifferentOwners) differentOwnerRowIds.add(row._id);
    }
  }

  return { groups, countByRowId, siblingsByRowId, conflictRowIds, differentOwnerRowIds, ownerCountByRowId };
}

/** Filter rows to those sharing a parcel with at least one other record. */
export function filterParcelSharedRows<T extends ParcelSiblingRow>(rows: T[]): T[] {
  const index = buildParcelSiblingIndex(rows);
  return rows.filter((r) => (index.countByRowId.get(r._id) ?? 1) > 1);
}

/**
 * Full survey Excel export/import — all mobile input fields, floors, co-owners, photos.
 * Column headers are stable for round-trip import via surveyExport.importExcelBundle.
 */
import { PHOTO_SLOT_LABEL, QC_STATUS_LABEL, SURVEY_STATUS_LABEL } from "@/lib/domain";
import { surveyAreaMetrics } from "@/lib/survey/area";
import { fmtDate } from "@/lib/utils";
import * as XLSX from "xlsx";

export const SURVEY_SHEET = "Surveys";
export const CO_OWNERS_SHEET = "CoOwners";
export const FLOORS_SHEET = "Floors";
export const PHOTOS_SHEET = "Photos";
export const GUIDE_SHEET = "Guide";

export type SurveyExportBundle = {
  _id: string;
  localId: string;
  propertyId?: string;
  districtId: string;
  municipalityId: string;
  districtName?: string;
  municipalityName?: string;
  municipalityCode?: string;
  surveyorName?: string;
  surveyorEmail?: string;
  wardNo: string;
  sectorNo?: string;
  oldPropertyNo?: string;
  parcelNo: string;
  unitNo: string;
  constructedYear?: number;
  isSlum: boolean;
  respondentName?: string;
  relationship?: string;
  familySize?: number;
  mobileNo: string;
  altMobileNo?: string;
  houseNo?: string;
  locality: string;
  colonyName: string;
  city: string;
  pinCode: string;
  assessmentYear: string;
  ownershipType: string;
  propertyType: string;
  propertyUse: string;
  situation: string;
  roadType: string;
  taxRateZone: string;
  plotSqft: number;
  plinthSqft: number;
  municipalWaterConnection: boolean;
  waterSource: string;
  sanitationType: string;
  municipalWasteCollection: boolean;
  electricityNo?: string;
  gps?: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAt: number;
    provider?: string;
    isMockLocation?: boolean;
  };
  status: string;
  qcStatus: string;
  serverVersion: number;
  clientUpdatedAt: number;
  submittedAt?: number;
  _creationTime: number;
  floors?: {
    clientFloorId: string;
    position: number;
    floorName: string;
    usageFactor?: string;
    usageType: string;
    constructionType: string;
    isOccupied: boolean;
    areaSqft: number;
  }[];
  photos?: {
    slot: string;
    sizeKb: number;
    width?: number;
    height?: number;
    capturedAt: number;
    url: string | null;
  }[];
  owners?: {
    name?: string;
    fatherOrHusbandName?: string;
    mobileNo?: string;
    altMobileNo?: string;
  }[];
};

function yn(v: boolean | undefined): string {
  return v ? "Yes" : "No";
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function surveyMainRow(s: SurveyExportBundle) {
  const areas = surveyAreaMetrics({
    plotSqft: s.plotSqft,
    plinthSqft: s.plinthSqft,
    floors: s.floors,
  });
  return {
    "Survey ID": s._id,
    "Local ID": s.localId,
    "Property ID": s.propertyId ?? "",
    "District ID": s.districtId,
    District: s.districtName ?? "",
    "Municipality ID": s.municipalityId,
    "ULB / Local Body": s.municipalityName ?? s.city,
    "ULB Code": s.municipalityCode ?? "",
    "Ward Number": s.wardNo,
    "Sector / Zone": s.sectorNo ?? "",
    "Parcel Number": s.parcelNo,
    "Unit / Sub-No": s.unitNo,
    "Property ID (Old)": s.oldPropertyNo ?? "",
    "Constructed Year": s.constructedYear ?? "",
    "Slum Area": yn(s.isSlum),
    "Respondent Name": s.respondentName ?? "",
    "Relationship with Owner": s.relationship ?? "",
    "Family Size": s.familySize ?? "",
    "Mobile Number": s.mobileNo,
    "Alt Mobile": s.altMobileNo ?? "",
    "House / Door No": s.houseNo ?? "",
    "Locality / Landmark": s.locality,
    "Colony / Society": s.colonyName,
    City: s.city,
    "Pin Code": s.pinCode,
    "Assessment Year": s.assessmentYear,
    "Ownership Type": s.ownershipType,
    "Property Use": s.propertyUse,
    "Property Type": s.propertyType,
    Situation: s.situation,
    "Road Type": s.roadType,
    "Tax Rate Zone": s.taxRateZone,
    "Plot Area SqFt": areas.plotSqft,
    "Plot Area SqMeter": areas.plotSqMeter,
    "Plinth Area SqFt": areas.plinthSqft,
    "Plinth Area SqMeter": areas.plinthSqMeter,
    "Total Built Up Area SqFt": areas.builtUpSqft,
    "Total Built Up Area SqMeter": areas.builtUpSqMeter,
    "Water Connection?": yn(s.municipalWaterConnection),
    "Source of Water": s.waterSource,
    "Sanitation Type": s.sanitationType,
    "Door-to-door Waste Collection": yn(s.municipalWasteCollection),
    "Electricity Consumer No": s.electricityNo ?? "",
    "GPS Latitude": s.gps?.latitude ?? "",
    "GPS Longitude": s.gps?.longitude ?? "",
    "GPS Accuracy (m)": s.gps?.accuracyMeters ?? "",
    "GPS Captured At": s.gps?.capturedAt ? fmtDate(s.gps.capturedAt) : "",
    "GPS Provider": s.gps?.provider ?? "",
    "GPS Mock Location": s.gps?.isMockLocation ? "Yes" : s.gps ? "No" : "",
    "Survey Status": SURVEY_STATUS_LABEL[s.status as keyof typeof SURVEY_STATUS_LABEL] ?? s.status,
    "QC Status": QC_STATUS_LABEL[s.qcStatus as keyof typeof QC_STATUS_LABEL] ?? s.qcStatus,
    Surveyor: s.surveyorName ?? "",
    "Surveyor Email": s.surveyorEmail ?? "",
    "Server Version": s.serverVersion,
    "Client Updated At": fmtDate(s.clientUpdatedAt),
    "Submitted At": s.submittedAt ? fmtDate(s.submittedAt) : "",
    "Created At": fmtDate(s._creationTime),
  };
}

function coOwnerRows(s: SurveyExportBundle) {
  const pid = s.propertyId ?? "";
  const owners = s.owners ?? [];
  if (owners.length === 0) return [];
  return owners.map((o, i) => ({
    "Property ID": pid,
    "Survey ID": s._id,
    "Owner Index": i + 1,
    Name: o.name ?? "",
    "Father / Husband Name": o.fatherOrHusbandName ?? "",
    Mobile: o.mobileNo ?? "",
    "Alt Mobile": o.altMobileNo ?? "",
  }));
}

function floorRows(s: SurveyExportBundle) {
  const pid = s.propertyId ?? "";
  return (s.floors ?? []).map((f) => ({
    "Property ID": pid,
    "Survey ID": s._id,
    "Client Floor ID": f.clientFloorId,
    Position: f.position,
    Floor: f.floorName,
    "Usage Factor": f.usageFactor ?? "",
    "Usage Type": f.usageType,
    "Construction Type": f.constructionType,
    Occupancy: f.isOccupied ? "Occupied" : "Vacant",
    "Area (Sqft)": f.areaSqft,
  }));
}

function photoRows(s: SurveyExportBundle) {
  const pid = s.propertyId ?? "";
  return (s.photos ?? []).map((p) => ({
    "Property ID": pid,
    "Survey ID": s._id,
    Slot: PHOTO_SLOT_LABEL[p.slot as keyof typeof PHOTO_SLOT_LABEL] ?? p.slot,
    "Slot Key": p.slot,
    "Captured At": fmtDate(p.capturedAt),
    "Size (KB)": p.sizeKb,
    Width: p.width ?? "",
    Height: p.height ?? "",
    "Photo URL": p.url ?? "",
  }));
}

const GUIDE_ROWS = [
  { Topic: "Export", Detail: "All mobile survey fields, co-owners, floors, and photo metadata." },
  {
    Topic: "Import",
    Detail: "Edit the Surveys sheet; use CoOwners and Floors for related rows. Re-import via Surveys page.",
  },
  { Topic: "Property ID", Detail: "Format: ULB(6)-Ward(3)-Parcel(5)-Unit(3)-UseLetter e.g. 801262-001-00004-001-R" },
  { Topic: "Match key", Detail: "Imports match existing surveys by Property ID, then Local ID." },
  { Topic: "Municipality ID", Detail: "Required Convex ID on each survey row — do not change unless moving ULB." },
];

/** Multi-sheet workbook with complete survey data. */
export function exportSurveysFullExcel(bundles: SurveyExportBundle[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bundles.map(surveyMainRow)), SURVEY_SHEET);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bundles.flatMap(coOwnerRows)), CO_OWNERS_SHEET);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bundles.flatMap(floorRows)), FLOORS_SHEET);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bundles.flatMap(photoRows)), PHOTOS_SHEET);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(GUIDE_ROWS), GUIDE_SHEET);
  XLSX.writeFile(wb, `surveys_full_${stamp()}.xlsx`);
}

type JsonRow = Record<string, unknown>;

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function cellNum(v: unknown): number | undefined {
  const s = cellStr(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Read first matching column (supports legacy export headers). */
function cellNumAny(r: JsonRow, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const n = cellNum(r[k]);
    if (n != null) return n;
  }
  return undefined;
}

function parseYn(v: unknown): boolean | undefined {
  const s = cellStr(v).toLowerCase();
  if (!s) return undefined;
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return undefined;
}

export type SurveyExcelImportPayload = {
  surveys: {
    localId: string;
    municipalityId: string;
    wardNo: string;
    propertyId?: string;
    sectorNo?: string;
    oldPropertyNo?: string;
    parcelNo: string;
    unitNo: string;
    constructedYear?: number;
    isSlum?: boolean;
    respondentName?: string;
    relationship?: string;
    familySize?: number;
    mobileNo?: string;
    altMobileNo?: string;
    houseNo?: string;
    locality?: string;
    colonyName?: string;
    city?: string;
    pinCode?: string;
    assessmentYear?: string;
    ownershipType?: string;
    propertyType?: string;
    propertyUse?: string;
    situation?: string;
    roadType?: string;
    taxRateZone?: string;
    plotSqft?: number;
    plinthSqft?: number;
    municipalWaterConnection?: boolean;
    waterSource?: string;
    sanitationType?: string;
    municipalWasteCollection?: boolean;
    electricityNo?: string;
    owners?: {
      name?: string;
      fatherOrHusbandName?: string;
      mobileNo?: string;
      altMobileNo?: string;
    }[];
  }[];
  floors: {
    propertyId: string;
    clientFloorId: string;
    position: number;
    floorName: string;
    usageFactor?: string;
    usageType: string;
    constructionType: string;
    isOccupied?: boolean;
    areaSqft: number;
  }[];
};

function parseSurveyRow(r: JsonRow, ownersByPropertyId: Map<string, SurveyExcelImportPayload["surveys"][0]["owners"]>) {
  const localId = cellStr(r["Local ID"]);
  const municipalityId = cellStr(r["Municipality ID"]);
  const wardNo = cellStr(r["Ward Number"]);
  const parcelNo = cellStr(r["Parcel Number"]);
  const unitNo = cellStr(r["Unit / Sub-No"]);
  const propertyId = cellStr(r["Property ID"]) || undefined;
  const pidKey = propertyId?.toUpperCase() ?? "";

  if (!localId || !municipalityId || !wardNo || !parcelNo || !unitNo) {
    return null;
  }

  return {
    localId,
    municipalityId: municipalityId as any,
    wardNo,
    propertyId: pidKey || undefined,
    sectorNo: cellStr(r["Sector / Zone"]) || undefined,
    oldPropertyNo: cellStr(r["Property ID (Old)"]) || undefined,
    parcelNo,
    unitNo,
    constructedYear: cellNum(r["Constructed Year"]),
    isSlum: parseYn(r["Slum Area"]),
    respondentName: cellStr(r["Respondent Name"]) || undefined,
    relationship: cellStr(r["Relationship with Owner"]) || undefined,
    familySize: cellNum(r["Family Size"]),
    mobileNo: cellStr(r["Mobile Number"]) || undefined,
    altMobileNo: cellStr(r["Alt Mobile"]) || undefined,
    houseNo: cellStr(r["House / Door No"]) || undefined,
    locality: cellStr(r["Locality / Landmark"]) || undefined,
    colonyName: cellStr(r["Colony / Society"]) || undefined,
    city: cellStr(r["City"]) || cellStr(r["ULB / Local Body"]) || undefined,
    pinCode: cellStr(r["Pin Code"]) || undefined,
    assessmentYear: cellStr(r["Assessment Year"]) || undefined,
    ownershipType: cellStr(r["Ownership Type"]) || undefined,
    propertyUse: cellStr(r["Property Use"]) || undefined,
    propertyType: cellStr(r["Property Type"]) || undefined,
    situation: cellStr(r["Situation"]) || undefined,
    roadType: cellStr(r["Road Type"]) || undefined,
    taxRateZone: cellStr(r["Tax Rate Zone"]) || undefined,
    plotSqft: cellNumAny(r, "Plot Area SqFt", "Plot Area (Sqft)"),
    plinthSqft: cellNumAny(r, "Plinth Area SqFt", "Plinth Area (Sqft)"),
    municipalWaterConnection: parseYn(r["Water Connection?"]),
    waterSource: cellStr(r["Source of Water"]) || undefined,
    sanitationType: cellStr(r["Sanitation Type"]) || undefined,
    municipalWasteCollection: parseYn(r["Door-to-door Waste Collection"]),
    electricityNo: cellStr(r["Electricity Consumer No"]) || undefined,
    owners: pidKey ? ownersByPropertyId.get(pidKey) : undefined,
  };
}

function parseCoOwnersSheet(rows: JsonRow[]): Map<string, SurveyExcelImportPayload["surveys"][0]["owners"]> {
  const map = new Map<string, NonNullable<SurveyExcelImportPayload["surveys"][0]["owners"]>>();
  for (const r of rows) {
    const pid = cellStr(r["Property ID"]).toUpperCase();
    if (!pid) continue;
    const list = map.get(pid) ?? [];
    list.push({
      name: cellStr(r["Name"]) || undefined,
      fatherOrHusbandName: cellStr(r["Father / Husband Name"]) || undefined,
      mobileNo: cellStr(r["Mobile"]) || undefined,
      altMobileNo: cellStr(r["Alt Mobile"]) || undefined,
    });
    map.set(pid, list);
  }
  return map;
}

function parseFloorsSheet(rows: JsonRow[]): SurveyExcelImportPayload["floors"] {
  const floors: SurveyExcelImportPayload["floors"] = [];
  for (const r of rows) {
    const propertyId = cellStr(r["Property ID"]).toUpperCase();
    const clientFloorId = cellStr(r["Client Floor ID"]) || `imp_${cellStr(r["Position"])}_${propertyId}`;
    const floorName = cellStr(r["Floor"]);
    const usageType = cellStr(r["Usage Type"]);
    const constructionType = cellStr(r["Construction Type"]);
    const areaSqft = cellNum(r["Area (Sqft)"]);
    const position = cellNum(r["Position"]) ?? floors.length + 1;
    if (!propertyId || !floorName || !usageType || !constructionType || areaSqft == null) continue;
    const occ = cellStr(r["Occupancy"]).toLowerCase();
    floors.push({
      propertyId,
      clientFloorId,
      position,
      floorName,
      usageFactor: cellStr(r["Usage Factor"]) || undefined,
      usageType,
      constructionType,
      isOccupied: occ ? occ !== "vacant" : undefined,
      areaSqft,
    });
  }
  return floors;
}

/** Parse an uploaded workbook exported from this app (or matching column headers). */
export function parseSurveyExcelFile(buffer: ArrayBuffer): SurveyExcelImportPayload {
  const wb = XLSX.read(buffer, { type: "array" });
  const coOwnerSheet = wb.Sheets[CO_OWNERS_SHEET] ?? wb.Sheets["Co-owners"];
  const floorSheet = wb.Sheets[FLOORS_SHEET] ?? wb.Sheets["Floor Details"];
  const surveySheet = wb.Sheets[SURVEY_SHEET] ?? wb.Sheets[wb.SheetNames[0]!];

  const coRows = coOwnerSheet ? (XLSX.utils.sheet_to_json(coOwnerSheet) as JsonRow[]) : [];
  const ownersByPid = parseCoOwnersSheet(coRows);

  const surveyRows = surveySheet ? (XLSX.utils.sheet_to_json(surveySheet) as JsonRow[]) : [];
  const surveys = surveyRows
    .map((r) => parseSurveyRow(r, ownersByPid))
    .filter((s): s is NonNullable<typeof s> => s != null);

  const floorRows = floorSheet ? (XLSX.utils.sheet_to_json(floorSheet) as JsonRow[]) : [];
  const floors = parseFloorsSheet(floorRows);

  return { surveys, floors };
}

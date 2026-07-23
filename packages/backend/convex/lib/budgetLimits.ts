/**
 * Shared hard budgets for Convex query/mutation work units.
 * Keep client chunk sizes ≤ these values — silent truncation is forbidden.
 */

/** Excel export: max survey IDs enriched per getExportBundlesByIds call. */
export const MAX_EXPORT_PAGE_SIZE = 40
export const DEFAULT_EXPORT_PAGE_SIZE = 30
/**
 * Max surveys scanned for listExportIds when scope is broader than a single ULB
 * (district / multi-ULB fallback). Single-ULB exports use indexed cursor pages instead.
 */
export const EXPORT_SCOPE_LIMIT = 800
/** Max survey IDs returned per listExportIds cursor page (IDs only — lightweight). */
export const EXPORT_ID_PAGE_SIZE = 100
/** Hard ceiling for a single listExportIds page request. */
export const MAX_EXPORT_ID_PAGE_SIZE = 200
/** Max concurrent survey enrichments (floors/photos/storage URLs) per export page. */
export const EXPORT_ENRICH_CONCURRENCY = 8
/** Max concurrent notice photo URL resolutions. */
export const NOTICE_PHOTO_URL_CONCURRENCY = 8

/** Demand-notice bulk PDF: max surveys stored on one job document. */
export const MAX_DEMAND_NOTICE_JOB_SURVEYS = 200
/** Demand-notice: max notice payloads built in one query page. */
export const MAX_DEMAND_NOTICE_PAYLOAD_PAGE = 25

/** Reassignment: max draft surveys patched in one mutation. */
export const MAX_REASSIGN_PER_MUTATION = 25
/** Reassignment list: max drafts loaded per municipality. */
export const DRAFT_LIST_CAP_PER_MUNICIPALITY = 300

/** Excel import: max rows per importExcelBundle mutation. */
export const MAX_IMPORT_SURVEYS = 40
export const MAX_IMPORT_FLOORS = 200

/** Child rows loaded per survey during export enrichment. */
export const MAX_EXPORT_FLOORS_PER_SURVEY = 64
/** Keep modest — each photo may trigger storage.getUrl when includePhotoUrls is true. */
export const MAX_EXPORT_PHOTOS_PER_SURVEY = 12

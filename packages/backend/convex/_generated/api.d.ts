/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_helpers from "../admin/helpers.js";
import type * as admin_mutations from "../admin/mutations.js";
import type * as admin_queries from "../admin/queries.js";
import type * as allotments_helpers from "../allotments/helpers.js";
import type * as allotments_mutations from "../allotments/mutations.js";
import type * as allotments_queries from "../allotments/queries.js";
import type * as analytics_queries from "../analytics/queries.js";
import type * as audit_helpers from "../audit/helpers.js";
import type * as audit_internal from "../audit/internal.js";
import type * as audit_queries from "../audit/queries.js";
import type * as crons from "../crons.js";
import type * as demandNotices_helpers from "../demandNotices/helpers.js";
import type * as demandNotices_mutations from "../demandNotices/mutations.js";
import type * as demandNotices_queries from "../demandNotices/queries.js";
import type * as export_helpers from "../export/helpers.js";
import type * as export_importExcelSurvey from "../export/importExcelSurvey.js";
import type * as export_mutations from "../export/mutations.js";
import type * as export_queries from "../export/queries.js";
import type * as floors_mutations from "../floors/mutations.js";
import type * as floors_queries from "../floors/queries.js";
import type * as http from "../http.js";
import type * as http_clerkWebhook from "../http/clerkWebhook.js";
import type * as lib_auditActor from "../lib/auditActor.js";
import type * as lib_budgetLimits from "../lib/budgetLimits.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_gpsAccuracy from "../lib/gpsAccuracy.js";
import type * as lib_gpsValidation from "../lib/gpsValidation.js";
import type * as lib_mastersLoad from "../lib/mastersLoad.js";
import type * as lib_masters_areaMasters from "../lib/masters/areaMasters.js";
import type * as lib_masters_ownerConstants from "../lib/masters/ownerConstants.js";
import type * as lib_masters_ownerMobile from "../lib/masters/ownerMobile.js";
import type * as lib_masters_serviceMasters from "../lib/masters/serviceMasters.js";
import type * as lib_masters_taxationMasters from "../lib/masters/taxationMasters.js";
import type * as lib_observability from "../lib/observability.js";
import type * as lib_permissionCatalog from "../lib/permissionCatalog.js";
import type * as lib_propertyId from "../lib/propertyId.js";
import type * as lib_propertyIdLookup from "../lib/propertyIdLookup.js";
import type * as lib_qcWardStats from "../lib/qcWardStats.js";
import type * as lib_qc_buildDemandNoticeDocument from "../lib/qc/buildDemandNoticeDocument.js";
import type * as lib_qc_demandNoticeDocumentTypes from "../lib/qc/demandNoticeDocumentTypes.js";
import type * as lib_qc_normalizeTaxRates from "../lib/qc/normalizeTaxRates.js";
import type * as lib_qc_taxRateDefaults from "../lib/qc/taxRateDefaults.js";
import type * as lib_qc_taxRateMatrix from "../lib/qc/taxRateMatrix.js";
import type * as lib_reports_demandNoticeFilename from "../lib/reports/demandNoticeFilename.js";
import type * as lib_surveyAnalyticsLookups from "../lib/surveyAnalyticsLookups.js";
import type * as lib_surveyAnalyticsModel from "../lib/surveyAnalyticsModel.js";
import type * as lib_surveyAnalyticsWrites from "../lib/surveyAnalyticsWrites.js";
import type * as lib_surveyProgress from "../lib/surveyProgress.js";
import type * as lib_surveyRollupStats from "../lib/surveyRollupStats.js";
import type * as lib_surveyScopeStats from "../lib/surveyScopeStats.js";
import type * as lib_surveySearch from "../lib/surveySearch.js";
import type * as lib_surveyStatsAggregate from "../lib/surveyStatsAggregate.js";
import type * as lib_surveyUniqueness from "../lib/surveyUniqueness.js";
import type * as lib_surveyWardStats from "../lib/surveyWardStats.js";
import type * as lib_wardAccess from "../lib/wardAccess.js";
import type * as masters_helpers from "../masters/helpers.js";
import type * as masters_mutations from "../masters/mutations.js";
import type * as masters_queries from "../masters/queries.js";
import type * as photos_helpers from "../photos/helpers.js";
import type * as photos_mutations from "../photos/mutations.js";
import type * as photos_queries from "../photos/queries.js";
import type * as qc_helpers from "../qc/helpers.js";
import type * as qc_mutations from "../qc/mutations.js";
import type * as qc_queries from "../qc/queries.js";
import type * as rbac_helpers from "../rbac/helpers.js";
import type * as rbac_internal from "../rbac/internal.js";
import type * as rbac_mutations from "../rbac/mutations.js";
import type * as rbac_queries from "../rbac/queries.js";
import type * as reassignment_helpers from "../reassignment/helpers.js";
import type * as reassignment_mutations from "../reassignment/mutations.js";
import type * as reassignment_queries from "../reassignment/queries.js";
import type * as retention from "../retention.js";
import type * as shared_calendar from "../shared/calendar.js";
import type * as shared_capabilities from "../shared/capabilities.js";
import type * as shared_fieldAccess from "../shared/fieldAccess.js";
import type * as shared_helpers from "../shared/helpers.js";
import type * as shared_tenancy from "../shared/tenancy.js";
import type * as stats_internal from "../stats/internal.js";
import type * as surveys_helpers from "../surveys/helpers.js";
import type * as surveys_mutations from "../surveys/mutations.js";
import type * as surveys_queries from "../surveys/queries.js";
import type * as surveys_validators from "../surveys/validators.js";
import type * as taxation_helpers from "../taxation/helpers.js";
import type * as taxation_mutations from "../taxation/mutations.js";
import type * as taxation_queries from "../taxation/queries.js";
import type * as tenants_adminTree from "../tenants/adminTree.js";
import type * as tenants_mutations from "../tenants/mutations.js";
import type * as tenants_queries from "../tenants/queries.js";
import type * as users_helpers from "../users/helpers.js";
import type * as users_internal from "../users/internal.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/helpers": typeof admin_helpers;
  "admin/mutations": typeof admin_mutations;
  "admin/queries": typeof admin_queries;
  "allotments/helpers": typeof allotments_helpers;
  "allotments/mutations": typeof allotments_mutations;
  "allotments/queries": typeof allotments_queries;
  "analytics/queries": typeof analytics_queries;
  "audit/helpers": typeof audit_helpers;
  "audit/internal": typeof audit_internal;
  "audit/queries": typeof audit_queries;
  crons: typeof crons;
  "demandNotices/helpers": typeof demandNotices_helpers;
  "demandNotices/mutations": typeof demandNotices_mutations;
  "demandNotices/queries": typeof demandNotices_queries;
  "export/helpers": typeof export_helpers;
  "export/importExcelSurvey": typeof export_importExcelSurvey;
  "export/mutations": typeof export_mutations;
  "export/queries": typeof export_queries;
  "floors/mutations": typeof floors_mutations;
  "floors/queries": typeof floors_queries;
  http: typeof http;
  "http/clerkWebhook": typeof http_clerkWebhook;
  "lib/auditActor": typeof lib_auditActor;
  "lib/budgetLimits": typeof lib_budgetLimits;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/gpsAccuracy": typeof lib_gpsAccuracy;
  "lib/gpsValidation": typeof lib_gpsValidation;
  "lib/mastersLoad": typeof lib_mastersLoad;
  "lib/masters/areaMasters": typeof lib_masters_areaMasters;
  "lib/masters/ownerConstants": typeof lib_masters_ownerConstants;
  "lib/masters/ownerMobile": typeof lib_masters_ownerMobile;
  "lib/masters/serviceMasters": typeof lib_masters_serviceMasters;
  "lib/masters/taxationMasters": typeof lib_masters_taxationMasters;
  "lib/observability": typeof lib_observability;
  "lib/permissionCatalog": typeof lib_permissionCatalog;
  "lib/propertyId": typeof lib_propertyId;
  "lib/propertyIdLookup": typeof lib_propertyIdLookup;
  "lib/qcWardStats": typeof lib_qcWardStats;
  "lib/qc/buildDemandNoticeDocument": typeof lib_qc_buildDemandNoticeDocument;
  "lib/qc/demandNoticeDocumentTypes": typeof lib_qc_demandNoticeDocumentTypes;
  "lib/qc/normalizeTaxRates": typeof lib_qc_normalizeTaxRates;
  "lib/qc/taxRateDefaults": typeof lib_qc_taxRateDefaults;
  "lib/qc/taxRateMatrix": typeof lib_qc_taxRateMatrix;
  "lib/reports/demandNoticeFilename": typeof lib_reports_demandNoticeFilename;
  "lib/surveyAnalyticsLookups": typeof lib_surveyAnalyticsLookups;
  "lib/surveyAnalyticsModel": typeof lib_surveyAnalyticsModel;
  "lib/surveyAnalyticsWrites": typeof lib_surveyAnalyticsWrites;
  "lib/surveyProgress": typeof lib_surveyProgress;
  "lib/surveyRollupStats": typeof lib_surveyRollupStats;
  "lib/surveyScopeStats": typeof lib_surveyScopeStats;
  "lib/surveySearch": typeof lib_surveySearch;
  "lib/surveyStatsAggregate": typeof lib_surveyStatsAggregate;
  "lib/surveyUniqueness": typeof lib_surveyUniqueness;
  "lib/surveyWardStats": typeof lib_surveyWardStats;
  "lib/wardAccess": typeof lib_wardAccess;
  "masters/helpers": typeof masters_helpers;
  "masters/mutations": typeof masters_mutations;
  "masters/queries": typeof masters_queries;
  "photos/helpers": typeof photos_helpers;
  "photos/mutations": typeof photos_mutations;
  "photos/queries": typeof photos_queries;
  "qc/helpers": typeof qc_helpers;
  "qc/mutations": typeof qc_mutations;
  "qc/queries": typeof qc_queries;
  "rbac/helpers": typeof rbac_helpers;
  "rbac/internal": typeof rbac_internal;
  "rbac/mutations": typeof rbac_mutations;
  "rbac/queries": typeof rbac_queries;
  "reassignment/helpers": typeof reassignment_helpers;
  "reassignment/mutations": typeof reassignment_mutations;
  "reassignment/queries": typeof reassignment_queries;
  retention: typeof retention;
  "shared/calendar": typeof shared_calendar;
  "shared/capabilities": typeof shared_capabilities;
  "shared/fieldAccess": typeof shared_fieldAccess;
  "shared/helpers": typeof shared_helpers;
  "shared/tenancy": typeof shared_tenancy;
  "stats/internal": typeof stats_internal;
  "surveys/helpers": typeof surveys_helpers;
  "surveys/mutations": typeof surveys_mutations;
  "surveys/queries": typeof surveys_queries;
  "surveys/validators": typeof surveys_validators;
  "taxation/helpers": typeof taxation_helpers;
  "taxation/mutations": typeof taxation_mutations;
  "taxation/queries": typeof taxation_queries;
  "tenants/adminTree": typeof tenants_adminTree;
  "tenants/mutations": typeof tenants_mutations;
  "tenants/queries": typeof tenants_queries;
  "users/helpers": typeof users_helpers;
  "users/internal": typeof users_internal;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

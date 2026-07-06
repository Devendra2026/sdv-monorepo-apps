/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as addressRules from "../addressRules.js";
import type * as admin from "../admin.js";
import type * as allotments from "../allotments.js";
import type * as analytics from "../analytics.js";
import type * as analyticsTrends from "../analyticsTrends.js";
import type * as areaMasters from "../areaMasters.js";
import type * as audit from "../audit.js";
import type * as capabilities from "../capabilities.js";
import type * as clerk from "../clerk.js";
import type * as demandNoticeData from "../demandNoticeData.js";
import type * as demandNotices from "../demandNotices.js";
import type * as fieldAccess from "../fieldAccess.js";
import type * as floors from "../floors.js";
import type * as gpsAccuracy from "../gpsAccuracy.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as lib_auditActor from "../lib/auditActor.js";
import type * as lib_gpsValidation from "../lib/gpsValidation.js";
import type * as lib_mastersLoad from "../lib/mastersLoad.js";
import type * as lib_propertyIdLookup from "../lib/propertyIdLookup.js";
import type * as lib_qcWardStats from "../lib/qcWardStats.js";
import type * as lib_qc_buildDemandNoticeDocument from "../lib/qc/buildDemandNoticeDocument.js";
import type * as lib_qc_demandNoticeDocumentTypes from "../lib/qc/demandNoticeDocumentTypes.js";
import type * as lib_qc_normalizeTaxRates from "../lib/qc/normalizeTaxRates.js";
import type * as lib_qc_taxRateDefaults from "../lib/qc/taxRateDefaults.js";
import type * as lib_qc_taxRateMatrix from "../lib/qc/taxRateMatrix.js";
import type * as lib_reports_demandNoticeFilename from "../lib/reports/demandNoticeFilename.js";
import type * as lib_surveyProgress from "../lib/surveyProgress.js";
import type * as lib_surveyScopeStats from "../lib/surveyScopeStats.js";
import type * as lib_surveySearch from "../lib/surveySearch.js";
import type * as lib_surveyStatsAggregate from "../lib/surveyStatsAggregate.js";
import type * as lib_surveyUniqueness from "../lib/surveyUniqueness.js";
import type * as lib_surveyWardStats from "../lib/surveyWardStats.js";
import type * as lib_wardAccess from "../lib/wardAccess.js";
import type * as masterCatalog from "../masterCatalog.js";
import type * as masters from "../masters.js";
import type * as ownerConstants from "../ownerConstants.js";
import type * as ownerMobile from "../ownerMobile.js";
import type * as ownerRules from "../ownerRules.js";
import type * as permissionCatalog from "../permissionCatalog.js";
import type * as photos from "../photos.js";
import type * as propertyId from "../propertyId.js";
import type * as qc from "../qc.js";
import type * as rbac from "../rbac.js";
import type * as serviceMasters from "../serviceMasters.js";
import type * as survey from "../survey.js";
import type * as surveyEditRules from "../surveyEditRules.js";
import type * as surveyExport from "../surveyExport.js";
import type * as surveyReassignment from "../surveyReassignment.js";
import type * as surveys from "../surveys.js";
import type * as taxRates from "../taxRates.js";
import type * as taxationMasters from "../taxationMasters.js";
import type * as tenancy from "../tenancy.js";
import type * as tenants from "../tenants.js";
import type * as users from "../users.js";
import type * as webDashboard from "../webDashboard.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  addressRules: typeof addressRules;
  admin: typeof admin;
  allotments: typeof allotments;
  analytics: typeof analytics;
  analyticsTrends: typeof analyticsTrends;
  areaMasters: typeof areaMasters;
  audit: typeof audit;
  capabilities: typeof capabilities;
  clerk: typeof clerk;
  demandNoticeData: typeof demandNoticeData;
  demandNotices: typeof demandNotices;
  fieldAccess: typeof fieldAccess;
  floors: typeof floors;
  gpsAccuracy: typeof gpsAccuracy;
  helpers: typeof helpers;
  http: typeof http;
  "lib/auditActor": typeof lib_auditActor;
  "lib/gpsValidation": typeof lib_gpsValidation;
  "lib/mastersLoad": typeof lib_mastersLoad;
  "lib/propertyIdLookup": typeof lib_propertyIdLookup;
  "lib/qcWardStats": typeof lib_qcWardStats;
  "lib/qc/buildDemandNoticeDocument": typeof lib_qc_buildDemandNoticeDocument;
  "lib/qc/demandNoticeDocumentTypes": typeof lib_qc_demandNoticeDocumentTypes;
  "lib/qc/normalizeTaxRates": typeof lib_qc_normalizeTaxRates;
  "lib/qc/taxRateDefaults": typeof lib_qc_taxRateDefaults;
  "lib/qc/taxRateMatrix": typeof lib_qc_taxRateMatrix;
  "lib/reports/demandNoticeFilename": typeof lib_reports_demandNoticeFilename;
  "lib/surveyProgress": typeof lib_surveyProgress;
  "lib/surveyScopeStats": typeof lib_surveyScopeStats;
  "lib/surveySearch": typeof lib_surveySearch;
  "lib/surveyStatsAggregate": typeof lib_surveyStatsAggregate;
  "lib/surveyUniqueness": typeof lib_surveyUniqueness;
  "lib/surveyWardStats": typeof lib_surveyWardStats;
  "lib/wardAccess": typeof lib_wardAccess;
  masterCatalog: typeof masterCatalog;
  masters: typeof masters;
  ownerConstants: typeof ownerConstants;
  ownerMobile: typeof ownerMobile;
  ownerRules: typeof ownerRules;
  permissionCatalog: typeof permissionCatalog;
  photos: typeof photos;
  propertyId: typeof propertyId;
  qc: typeof qc;
  rbac: typeof rbac;
  serviceMasters: typeof serviceMasters;
  survey: typeof survey;
  surveyEditRules: typeof surveyEditRules;
  surveyExport: typeof surveyExport;
  surveyReassignment: typeof surveyReassignment;
  surveys: typeof surveys;
  taxRates: typeof taxRates;
  taxationMasters: typeof taxationMasters;
  tenancy: typeof tenancy;
  tenants: typeof tenants;
  users: typeof users;
  webDashboard: typeof webDashboard;
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

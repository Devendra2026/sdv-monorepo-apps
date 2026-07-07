import type { QcStatus, SurveyStatus } from "@/lib/domain";

/** Shared row shape for survey/QC registry tables and queue navigation. */
export interface SurveyRow {
  _id: string;
  _creationTime: number;
  propertyId?: string;
  municipalityId?: string;
  propertyUse?: string;
  parcelNo: string;
  unitNo?: string;
  respondentName?: string;
  owners?: { name?: string }[];
  surveyorName?: string;
  mobileNo: string;
  wardNo: string;
  city: string;
  status: SurveyStatus;
  qcStatus: QcStatus;
  submittedAt?: number;
}

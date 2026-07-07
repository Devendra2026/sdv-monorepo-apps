import { Badge } from "@/components/ui/badge";
import { QC_STATUS_BADGE, SURVEY_STATUS_BADGE } from "@/lib/design-system";
import { QC_STATUS_LABEL, SURVEY_STATUS_LABEL, type QcStatus, type SurveyStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", SURVEY_STATUS_BADGE[status])}>
      {SURVEY_STATUS_LABEL[status]}
    </Badge>
  );
}

export function QcStatusBadge({ status }: { status: QcStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", QC_STATUS_BADGE[status])}>
      {QC_STATUS_LABEL[status]}
    </Badge>
  );
}

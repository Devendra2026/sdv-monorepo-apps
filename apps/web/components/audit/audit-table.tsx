import { actionStyle, avatarColor, entityColor, initials, relativeTime } from "@/components/audit/audit-helpers";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, fmtDate } from "@/lib/utils";
import type { AuditEntry } from "@/schema/audit/index";
import { Bot, ScrollText } from "lucide-react";
import { memo } from "react";

const AuditRow = memo(function AuditRow({ entry, isLast }: { entry: AuditEntry; isLast: boolean }) {
  const style = actionStyle(entry.action);
  const Icon = style.icon;
  const actorName = entry.actor?.name ?? "System";
  const isSystem = !entry.actor;

  return (
    <div className="group flex gap-4 px-5 py-4 transition-colors hover:bg-muted/30 sm:gap-5 sm:py-5">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105 dark:ring-white/10",
            style.bg,
          )}
        >
          <Icon className={cn("h-4 w-4", style.text)} />
        </div>
        {!isLast && <div className="mt-2 w-px flex-1 bg-border/80" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="font-mono text-sm font-semibold leading-snug tracking-tight text-foreground">
              {entry.action}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-[11px] font-medium", entityColor(entry.entity))}>
                {entry.entity}
              </Badge>
              {entry.entityId && (
                <span className="max-w-50 truncate rounded-md bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:max-w-xs">
                  {entry.entityId}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-left sm:text-right">
            <p className="text-xs font-medium text-foreground">{relativeTime(entry._creationTime)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDate(entry._creationTime)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          {isSystem ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ) : (
            <Avatar className="h-7 w-7">
              <AvatarFallback className={cn("text-[10px] font-semibold", avatarColor(actorName))}>
                {initials(actorName)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-none">{actorName}</p>
            {entry.actor?.email && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{entry.actor.email}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/** Renders an audit feed. Reused by the Audit page and the survey detail
 *  "Audit History" tab. */
export function AuditTable({
  rows,
  compact = false,
  skeletonRows = 10,
}: {
  rows?: AuditEntry[];
  compact?: boolean;
  skeletonRows?: number;
}) {
  if (rows === undefined) return <TableSkeleton rows={compact ? 4 : skeletonRows} />;
  if (rows.length === 0)
    return (
      <EmptyState
        title="No audit entries"
        description="Activity will appear here as users make changes across the system."
        icon={ScrollText}
      />
    );

  if (compact) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a._id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(a._creationTime)}</TableCell>
              <TableCell className="font-mono text-xs">{a.action}</TableCell>
              <TableCell>{a.actor?.name ?? "System"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="divide-y divide-border">
      {rows.map((entry, i) => (
        <AuditRow key={entry._id} entry={entry} isLast={i === rows.length - 1} />
      ))}
    </div>
  );
}

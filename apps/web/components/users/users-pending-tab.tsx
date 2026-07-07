"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading";
import { RoleGate } from "@/components/shared/role-gate";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SheetUser } from "@/components/users/user-edit-sheet";
import {
  avatarColor,
  initials,
  pendingAge,
  ROLE_COLORS,
  toPendingSheet,
  type PendingUser,
} from "@/components/users/users-page-shared";
import { cn } from "@/lib/utils";
import { UserCheck } from "lucide-react";

export function PendingApprovalsTab({
  pending,
  setSheetUser,
}: {
  pending: PendingUser[] | undefined;
  setSheetUser: (user: SheetUser) => void;
}) {
  return (
    <div>
      {pending === undefined ? (
        <div className="p-5">
          <TableSkeleton rows={3} />
        </div>
      ) : pending.length === 0 ? (
        <div className="py-12">
          <EmptyState
            title="Queue is clear"
            description="New sign-ups awaiting approval will appear here."
            icon={UserCheck}
          />
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {pending.map((u) => {
            const age = pendingAge(u.createdAt);
            return (
              <div
                key={u._id}
                className="flex w-full items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40 sm:gap-4"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
                  onClick={() => setSheetUser(toPendingSheet(u))}
                >
                  <Avatar>
                    <AvatarFallback className={cn("text-sm font-semibold", avatarColor(u.name))}>
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </button>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {u.requestedRole && (
                    <Badge variant="outline" className={cn("text-xs", ROLE_COLORS[u.requestedRole] ?? "")}>
                      {u.requestedRole}
                    </Badge>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      age.urgent
                        ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {age.label}
                  </span>
                  <RoleGate capability="users.approve" fallback={null}>
                    <Button
                      size="sm"
                      className="h-7 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
                      onClick={() => setSheetUser(toPendingSheet(u))}
                    >
                      <UserCheck className="h-3 w-3" aria-hidden /> Review
                    </Button>
                  </RoleGate>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

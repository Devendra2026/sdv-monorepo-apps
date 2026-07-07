"use client";

import { ADMIN_TABS_LIST, AdminTabPill } from "@/components/admin/admin-tabs";
import { SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard } from "@/components/design-system/glass-card";
import { FadeIn } from "@/components/design-system/motion";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import type { SheetUser } from "@/components/users/user-edit-sheet";
import { AllUsersDirectoryTab } from "@/components/users/users-directory-tab";
import { type ListedUser, type PendingUser, type UsersDirectoryTabModel } from "@/components/users/users-page-shared";
import { Clock, Users } from "lucide-react";
import { PendingApprovalsTab } from "./users-pending-tab";

export function UsersPageTabs({
  pending,
  users,
  directory,
  setSheetUser,
}: {
  pending: PendingUser[] | undefined;
  users: ListedUser[] | undefined;
  directory: UsersDirectoryTabModel;
  setSheetUser: (user: SheetUser) => void;
}) {
  return (
    <FadeIn delay={0.08}>
      <div id="users-registry">
        <GlassCard padding="none" className="overflow-hidden">
          <div className="border-b border-border/60 px-4 py-4 sm:px-5">
            <SectionHeader
              title="User Registry"
              description="Approval queue and directory — filter by system or custom roles"
            />
          </div>
          <Tabs defaultValue="pending">
            <div className="border-b border-border/60 bg-muted/20 px-3 py-2.5 sm:px-4">
              <TabsList className={ADMIN_TABS_LIST}>
                <AdminTabPill
                  value="pending"
                  label="Pending"
                  count={pending?.length ?? 0}
                  icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
                  activeColor="data-[state=active]:bg-warning data-[state=active]:text-amber-950"
                />
                <AdminTabPill
                  value="all"
                  label="All Users"
                  count={users?.length}
                  icon={<Users className="h-3.5 w-3.5" aria-hidden />}
                />
              </TabsList>
            </div>

            <TabsContent value="pending" className="mt-0">
              <PendingApprovalsTab pending={pending} setSheetUser={setSheetUser} />
            </TabsContent>

            <TabsContent value="all" className="mt-0">
              <AllUsersDirectoryTab {...directory} />
            </TabsContent>
          </Tabs>
        </GlassCard>
      </div>
    </FadeIn>
  );
}

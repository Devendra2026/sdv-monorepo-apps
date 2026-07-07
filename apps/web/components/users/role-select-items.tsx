"use client";

import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { partitionRoles } from "@/lib/tenancy-ui";

type RoleOption = {
  key: string;
  name: string;
  isSystem?: boolean;
  description?: string;
};

export function RoleSelectItems({ roles }: { roles: RoleOption[] }) {
  const { system, custom } = partitionRoles(roles);

  return (
    <>
      {system.length > 0 && (
        <SelectGroup>
          <SelectLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            System roles
          </SelectLabel>
          {system.map((r) => (
            <SelectItem key={r.key} value={r.key}>
              <span className="flex items-center gap-2">
                <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  SYS
                </span>
                {r.name}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      )}
      {custom.length > 0 && (
        <SelectGroup>
          <SelectLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Custom roles
          </SelectLabel>
          {custom.map((r) => (
            <SelectItem key={r.key} value={r.key}>
              <span className="flex items-center gap-2">
                <span className="rounded bg-violet-100 px-1 py-0.5 text-[9px] font-bold uppercase text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                  CUSTOM
                </span>
                {r.name}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      )}
    </>
  );
}

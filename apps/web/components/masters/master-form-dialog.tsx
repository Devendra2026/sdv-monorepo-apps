"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type MasterEditRow = { _id?: string; value: string; label: string; position: number; isActive: boolean };

export function MasterFormDialog({
  row,
  onChange,
  onSave,
  onClose,
}: {
  row: MasterEditRow | null;
  onChange: (row: MasterEditRow) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row?._id ? "Edit option" : "Add option"}</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Label (shown to users)</Label>
              <Input value={row.label} onChange={(e) => onChange({ ...row, label: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Value (stored key — must match survey validators)</Label>
              <Input
                className="font-mono"
                value={row.value}
                disabled={!!row._id}
                onChange={(e) => onChange({ ...row, value: e.target.value })}
              />
              {row._id && (
                <p className="text-[11px] text-muted-foreground">
                  Value is the upsert key and cannot change; delete &amp; re-add to rename.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Input
                type="number"
                value={row.position}
                onChange={(e) => onChange({ ...row, position: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={row.isActive} onCheckedChange={(v) => onChange({ ...row, isActive: v })} />
              <Label>Active</Label>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!row?.value.trim() || !row?.label.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

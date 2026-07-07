"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import type { DistrictDraft, MunicipalityDraft, WardDraft } from "./tenant-types";

function DistrictDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: DistrictDraft | null;
  onClose: () => void;
  onSave: (d: DistrictDraft) => Promise<void>;
}) {
  const [form, setForm] = useState<DistrictDraft>(
    draft ?? { code: "", name: "", stateName: "Uttar Pradesh", isActive: true },
  );
  const [busy, setBusy] = useState(false);

  const canSave = form.code.trim().length >= 2 && form.name.trim().length > 0 && form.stateName.trim().length > 0;

  async function handleSave() {
    setBusy(true);
    try {
      await onSave({ ...form, code: form.code.trim().toUpperCase() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Edit District" : "New District"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-code">Code</Label>
              <Input
                id="d-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="MTH"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-state">State</Label>
              <Input
                id="d-state"
                value={form.stateName}
                onChange={(e) => setForm((f) => ({ ...f, stateName: e.target.value }))}
                placeholder="Uttar Pradesh"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-name">District name</Label>
            <Input
              id="d-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Mathura"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={(c) => setForm((f) => ({ ...f, isActive: c }))} />
            <Label>{form.isActive ? "Active" : "Inactive"}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy || !canSave}>
            {busy ? "Saving…" : "Save district"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MunicipalityDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: MunicipalityDraft | null;
  onClose: () => void;
  onSave: (d: MunicipalityDraft) => Promise<void>;
}) {
  const [form, setForm] = useState<MunicipalityDraft>(
    draft ?? {
      districtId: "" as Id<"districts">,
      code: "",
      name: "",
      bodyType: "municipal_council",
      postalCode: "",
      isActive: true,
    },
  );
  const [busy, setBusy] = useState(false);

  const canSave = form.code.trim().length >= 2 && form.name.trim().length > 0 && form.postalCode.trim().length === 6;

  async function handleSave() {
    setBusy(true);
    try {
      await onSave({ ...form, code: form.code.trim().toUpperCase() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Edit ULB / Municipality" : "New ULB / Municipality"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-code">ULB code</Label>
              <Input
                id="m-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="MTH-MC-001"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-pin">PIN code</Label>
              <Input
                id="m-pin"
                value={form.postalCode}
                maxLength={6}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value.replace(/\D/g, "") }))}
                placeholder="281001"
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-name">Name</Label>
            <Input
              id="m-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Mathura Municipal Corporation"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Body type</Label>
            <Select
              value={form.bodyType}
              onValueChange={(v) => setForm((f) => ({ ...f, bodyType: v as MunicipalityDraft["bodyType"] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="municipal_council">Municipal Council / Corporation</SelectItem>
                <SelectItem value="town_panchayat">Town Panchayat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={(c) => setForm((f) => ({ ...f, isActive: c }))} />
            <Label>{form.isActive ? "Active" : "Inactive"}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy || !canSave}>
            {busy ? "Saving…" : "Save ULB"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WardDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: WardDraft | null;
  onClose: () => void;
  onSave: (d: WardDraft) => Promise<void>;
}) {
  const [form, setForm] = useState<WardDraft>(
    draft ?? { municipalityId: "" as Id<"municipalities">, wardNo: "", wardCode: "", name: "" },
  );
  const [busy, setBusy] = useState(false);
  const canSave = form.wardNo.trim().length > 0 && form.name.trim().length > 0;

  async function handleSave() {
    setBusy(true);
    try {
      await onSave(form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Edit Ward" : "New Ward"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="w-no">Ward number</Label>
              <Input
                id="w-no"
                value={form.wardNo}
                onChange={(e) => setForm((f) => ({ ...f, wardNo: e.target.value }))}
                placeholder="1"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-code">Ward code (optional)</Label>
              <Input
                id="w-code"
                value={form.wardCode}
                onChange={(e) => setForm((f) => ({ ...f, wardCode: e.target.value.toUpperCase() }))}
                placeholder="MTH-W01"
                className="font-mono uppercase"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-name">Ward name</Label>
            <Input
              id="w-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Krishna Nagar"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy || !canSave}>
            {busy ? "Saving…" : "Save ward"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TenantDialogs({
  districtDraft,
  muniDraft,
  wardDraft,
  onCloseDistrict,
  onCloseMuni,
  onCloseWard,
  onSaveDistrict,
  onSaveMunicipality,
  onSaveWard,
}: {
  districtDraft: DistrictDraft | null;
  muniDraft: MunicipalityDraft | null;
  wardDraft: WardDraft | null;
  onCloseDistrict: () => void;
  onCloseMuni: () => void;
  onCloseWard: () => void;
  onSaveDistrict: (d: DistrictDraft) => Promise<void>;
  onSaveMunicipality: (d: MunicipalityDraft) => Promise<void>;
  onSaveWard: (d: WardDraft) => Promise<void>;
}) {
  return (
    <>
      {districtDraft !== null && (
        <DistrictDialog draft={districtDraft} onClose={onCloseDistrict} onSave={onSaveDistrict} />
      )}
      {muniDraft !== null && <MunicipalityDialog draft={muniDraft} onClose={onCloseMuni} onSave={onSaveMunicipality} />}
      {wardDraft !== null && <WardDialog draft={wardDraft} onClose={onCloseWard} onSave={onSaveWard} />}
    </>
  );
}

import type { AuditEntry } from "@/schema/audit/index";
import { Activity, Building2, ClipboardList, Image, MapPin, ShieldCheck, User, type LucideIcon } from "lucide-react";

const AVATAR_PALETTE = [
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
];

const ENTITY_COLORS: Record<string, string> = {
  survey:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  user: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30",
  qc: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
  qcRemark:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
  photo: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30",
  storage:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30",
  masters: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
  district:
    "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
  municipality:
    "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
  ward: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
};

type ActionStyle = { icon: LucideIcon; bg: string; text: string };

const ACTION_STYLES: Record<string, ActionStyle> = {
  survey: {
    icon: ClipboardList,
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  user: {
    icon: User,
    bg: "bg-violet-100 dark:bg-violet-500/20",
    text: "text-violet-600 dark:text-violet-400",
  },
  qc: {
    icon: ShieldCheck,
    bg: "bg-orange-100 dark:bg-orange-500/20",
    text: "text-orange-600 dark:text-orange-400",
  },
  photo: {
    icon: Image,
    bg: "bg-cyan-100 dark:bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
  },
  district: {
    icon: MapPin,
    bg: "bg-indigo-100 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  municipality: {
    icon: Building2,
    bg: "bg-indigo-100 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  ward: {
    icon: MapPin,
    bg: "bg-indigo-100 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  master: {
    icon: Building2,
    bg: "bg-blue-100 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
  },
  tenants: {
    icon: Building2,
    bg: "bg-blue-100 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
  },
};

const DEFAULT_ACTION_STYLE: ActionStyle = {
  icon: Activity,
  bg: "bg-slate-100 dark:bg-slate-500/20",
  text: "text-slate-600 dark:text-slate-400",
};

function actionCategory(action: string) {
  return action.split(".")[0] ?? action;
}

export function actionStyle(action: string): ActionStyle {
  return ACTION_STYLES[actionCategory(action)] ?? DEFAULT_ACTION_STYLE;
}

export function entityColor(entity: string) {
  return ENTITY_COLORS[entity] ?? "bg-muted text-muted-foreground border-border";
}

export function avatarColor(name: string) {
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function relativeTime(ms: number) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function filterAuditRows(rows: AuditEntry[], search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.action.toLowerCase().includes(q) ||
      r.entity.toLowerCase().includes(q) ||
      (r.entityId?.toLowerCase().includes(q) ?? false) ||
      (r.actor?.name.toLowerCase().includes(q) ?? false) ||
      (r.actor?.email.toLowerCase().includes(q) ?? false),
  );
}

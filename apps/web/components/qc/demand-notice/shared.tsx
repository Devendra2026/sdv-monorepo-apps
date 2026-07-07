/** Official Uttar Pradesh government emblem for demand notice letterhead. */
export const DEMAND_NOTICE_GOVT_LOGO = "/govt-of-up-logo.png";

export function pctLabel(val: number): string {
  return `${(val * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

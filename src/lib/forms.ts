import type { StoredStatus } from "@/lib/dashboard";
import type { Locale } from "@/lib/i18n";

const STORED_STATUSES: StoredStatus[] = ["todo", "done", "skipped"];

export function parseLink(rawLabel: string, rawUrl: string) {
  const label = rawLabel.trim();
  let url = rawUrl.trim();
  if (!label || label.length > 60 || !url || url.length > 2048) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? { label, url } : null;
  } catch {
    return null;
  }
}

export function parseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function parseItemStatus(raw: unknown): StoredStatus | null {
  return STORED_STATUSES.find((status) => status === raw) ?? null;
}

export function parseLocale(raw: string | undefined): Locale {
  return raw === "en" ? "en" : "de";
}

/** A batch's last maintainer can't delete their account, or nobody could manage the batch. */
export function canDeleteAccount(role: "student" | "maintainer", otherMaintainers: number): boolean {
  return role !== "maintainer" || otherMaintainers > 0;
}

export function parseTitle(raw: string): string | null {
  const title = raw.trim();
  return title && title.length <= 200 ? title : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checks a person's calendar choices before saving them. */
export function parseCalendarChoices(raw: { cohortIds?: unknown; hiddenGroups?: unknown; view?: unknown }) {
  const { cohortIds, hiddenGroups, view } = raw;
  if (!Array.isArray(cohortIds) || cohortIds.length > 20) return null;
  if (!cohortIds.every((id) => typeof id === "string" && UUID.test(id))) return null;
  if (!Array.isArray(hiddenGroups) || hiddenGroups.length > 200) return null;
  if (!hiddenGroups.every((group) => typeof group === "string" && group.length <= 300)) return null;
  if (view !== "month" && view !== "week" && view !== "day") return null;
  return { cohort_ids: cohortIds as string[], hidden_groups: hiddenGroups as string[], view };
}

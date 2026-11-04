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

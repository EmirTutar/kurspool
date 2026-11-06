import type { AttachmentType, ItemCategory, ItemKind } from "@/lib/sync/map";

export type StoredStatus = "todo" | "done" | "skipped";
export type ItemStatus = "new" | StoredStatus;

export type ItemView = {
  id: string;
  module_id: string;
  topic_id: string | null;
  kind: ItemKind;
  category: ItemCategory;
  title: string;
  description: string | null;
  classroom_url: string | null;
  posted_at: string | null;
  due_at: string | null;
  item_attachments: { id: string; type: AttachmentType; title: string | null; url: string | null }[];
  status: ItemStatus;
  /** This person's own note on the item, if any. */
  note: string | null;
};

export const CATEGORIES: ItemCategory[] = ["session", "recording", "feedback", "reading", "organization", "other"];
export const STATUSES: ItemStatus[] = ["new", "todo", "done", "skipped"];

const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
const DUE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Removes the leading emoji and flags teachers put in titles. Keeps the title if nothing else remains. */
export function displayTitle(title: string): string {
  return title.replace(/^[^\p{L}\p{N}]+/u, "") || title;
}

export function isStale(lastSyncedAt: string | null, now: Date): boolean {
  return Boolean(lastSyncedAt) && now.getTime() - new Date(lastSyncedAt as string).getTime() > STALE_AFTER_MS;
}

/** Unfinished items that are past due or due within two weeks, earliest first. */
export function dueItems(items: ItemView[], now: Date) {
  return items
    .filter(
      (item) =>
        item.due_at &&
        item.status !== "done" &&
        item.status !== "skipped" &&
        new Date(item.due_at).getTime() <= now.getTime() + DUE_WINDOW_MS,
    )
    .sort((a, b) => new Date(a.due_at as string).getTime() - new Date(b.due_at as string).getTime())
    .map((item) => ({ ...item, past: new Date(item.due_at as string).getTime() < now.getTime() }));
}

export function groupByModule(items: ItemView[], modules: { id: string; title: string }[]) {
  return modules
    .map((module) => ({ id: module.id, title: module.title, items: items.filter((item) => item.module_id === module.id) }))
    .filter((group) => group.items.length > 0);
}

export function searchItems(items: ItemView[], rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];
  return items.filter((item) =>
    [item.title, item.description, ...item.item_attachments.map((attachment) => attachment.title)].some((value) =>
      value?.toLowerCase().includes(query),
    ),
  );
}

/** Splits text into plain parts and http(s) links, so descriptions can show clickable links. */
export function splitLinks(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = match[0].replace(/[.,;:!?)\]]+$/, "");
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: url, href: url });
    last = match.index + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function statusOf(progress: Map<string, StoredStatus>, itemId: string): ItemStatus {
  return progress.get(itemId) ?? "new";
}

export function moduleProgress(items: Pick<ItemView, "status">[]) {
  const finished = items.filter((item) => item.status === "done" || item.status === "skipped").length;
  return {
    finished,
    total: items.length,
    percent: items.length ? Math.round((finished / items.length) * 100) : 0,
    newCount: items.filter((item) => item.status === "new").length,
  };
}

export function filterItems(items: ItemView[], filters: { category?: string; status?: string }) {
  const category = CATEGORIES.find((value) => value === filters.category);
  const status = STATUSES.find((value) => value === filters.status);
  return items.filter((item) => (!category || item.category === category) && (!status || item.status === status));
}

export function groupByTopic(items: ItemView[], topics: { id: string; title: string }[], restTitle = "Weitere Einträge") {
  const known = new Set(topics.map((topic) => topic.id));
  const groups = topics
    .map((topic) => ({ id: topic.id, title: topic.title, items: items.filter((item) => item.topic_id === topic.id) }))
    .filter((group) => group.items.length > 0);
  const rest = items.filter((item) => !item.topic_id || !known.has(item.topic_id));
  return rest.length ? [...groups, { id: "rest", title: restTitle, items: rest }] : groups;
}

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
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  session: "Session",
  recording: "Aufzeichnung",
  feedback: "Feedback",
  reading: "Weiterlesen",
  organization: "Organisation",
  other: "Sonstiges",
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  new: "Neu",
  todo: "Offen",
  done: "Erledigt",
  skipped: "Übersprungen",
};

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
  const category = filters.category && filters.category in CATEGORY_LABELS ? filters.category : undefined;
  const status = filters.status && filters.status in STATUS_LABELS ? filters.status : undefined;
  return items.filter((item) => (!category || item.category === category) && (!status || item.status === status));
}

export function groupByTopic(items: ItemView[], topics: { id: string; title: string }[]) {
  const known = new Set(topics.map((topic) => topic.id));
  const groups = topics
    .map((topic) => ({ id: topic.id, title: topic.title, items: items.filter((item) => item.topic_id === topic.id) }))
    .filter((group) => group.items.length > 0);
  const rest = items.filter((item) => !item.topic_id || !known.has(item.topic_id));
  return rest.length ? [...groups, { id: "rest", title: "Weitere Einträge", items: rest }] : groups;
}

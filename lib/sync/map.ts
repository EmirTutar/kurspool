export type ItemKind = "coursework" | "material" | "announcement";
export type ItemCategory = "session" | "recording" | "feedback" | "reading" | "organization" | "other";
export type AttachmentType = "link" | "driveFile" | "youtubeVideo" | "form";

export type ClassroomDate = { year?: number; month?: number; day?: number };
export type ClassroomTime = { hours?: number; minutes?: number };

export type ClassroomMaterial = {
  link?: { url?: string; title?: string };
  driveFile?: { driveFile?: { alternateLink?: string; title?: string } };
  youtubeVideo?: { alternateLink?: string; title?: string };
  form?: { formUrl?: string; title?: string };
  [key: string]: unknown;
};

export type ClassroomItem = {
  id: string;
  title?: string;
  text?: string;
  description?: string;
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  topicId?: string;
  dueDate?: ClassroomDate;
  dueTime?: ClassroomTime;
  materials?: ClassroomMaterial[];
  [key: string]: unknown;
};

export type AttachmentRow = { type: AttachmentType; url: string | null; title: string | null };

export type ItemRow = {
  classroom_id: string;
  kind: ItemKind;
  category: ItemCategory;
  title: string;
  description: string | null;
  classroom_url: string | null;
  posted_at: string | null;
  classroom_updated_at: string | null;
  due_at: string | null;
  topic_id: string | null;
};

const RULES: [RegExp, ItemCategory][] = [
  [/📹/u, "recording"],
  [/✅/u, "feedback"],
  [/🔗|📑|🎙/u, "reading"],
  [/📆|🗓|📋/u, "organization"],
  [/👨/u, "session"],
  [/🇬🇧/u, "session"],
];

export function categorize(title: string): ItemCategory {
  return RULES.find(([pattern]) => pattern.test(title))?.[1] ?? "other";
}

export function modulePosition(name: string): number {
  const match = name.match(/^\s*(\d+)\s*\./);
  return match ? Number(match[1]) : 9999;
}

export function toDueAt(date?: ClassroomDate, time?: ClassroomTime): string | null {
  if (!date?.year || !date.month || !date.day) return null;
  const hours = time ? (time.hours ?? 0) : 23;
  const minutes = time ? (time.minutes ?? 0) : 59;
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hours, minutes)).toISOString();
}

function safeUrl(value?: string): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

export function toAttachments(materials?: ClassroomMaterial[]): AttachmentRow[] {
  return (materials ?? []).flatMap((material): AttachmentRow[] => {
    if (material.link) {
      return [{ type: "link", url: safeUrl(material.link.url), title: material.link.title ?? null }];
    }
    if (material.driveFile) {
      const file = material.driveFile.driveFile;
      return [{ type: "driveFile", url: safeUrl(file?.alternateLink), title: file?.title ?? null }];
    }
    if (material.youtubeVideo) {
      const video = material.youtubeVideo;
      return [{ type: "youtubeVideo", url: safeUrl(video.alternateLink), title: video.title ?? null }];
    }
    if (material.form) {
      return [{ type: "form", url: safeUrl(material.form.formUrl), title: material.form.title ?? null }];
    }
    return [];
  });
}

export function toItemRow(kind: ItemKind, item: ClassroomItem, topics: Map<string, string>): ItemRow {
  const title = kind === "announcement" ? (item.text ?? "").split("\n")[0].trim() || "Ankündigung" : (item.title ?? "Ohne Titel");
  return {
    classroom_id: item.id,
    kind,
    category: categorize(title),
    title,
    description: (kind === "announcement" ? item.text : item.description) ?? null,
    classroom_url: safeUrl(item.alternateLink),
    posted_at: item.creationTime ?? null,
    classroom_updated_at: item.updateTime ?? null,
    due_at: toDueAt(item.dueDate, item.dueTime),
    topic_id: (item.topicId && topics.get(item.topicId)) || null,
  };
}

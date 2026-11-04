import type { SupabaseClient } from "@supabase/supabase-js";
import { modulePosition, toAttachments, toItemRow, type ClassroomItem, type ItemKind } from "./map";

export type ClassroomCourse = { id: string; name: string; section?: string; alternateLink?: string };
export type ClassroomTopic = { topicId: string; name: string };

/** The Classroom reads a sync needs. Injected so tests can use a fake. */
export type ClassroomSource = {
  listCourses(): Promise<ClassroomCourse[]>;
  listTopics(courseId: string): Promise<ClassroomTopic[]>;
  listCourseWork(courseId: string): Promise<ClassroomItem[]>;
  listMaterials(courseId: string): Promise<ClassroomItem[]>;
  listAnnouncements(courseId: string): Promise<ClassroomItem[]>;
};

export type SyncResult = {
  status: "success" | "partial" | "failed" | "skipped";
  modules: number;
  items: number;
  hidden: number;
  errors: string[];
};

const STALE_RUN_MS = 10 * 60 * 1000;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : "unknown error";
}

async function syncModule(db: SupabaseClient, batchId: string, course: ClassroomCourse, source: ClassroomSource) {
  // Read everything first: a failed read must not change anything for this module.
  const [topics, courseWork, materials, announcements] = await Promise.all([
    source.listTopics(course.id),
    source.listCourseWork(course.id),
    source.listMaterials(course.id),
    source.listAnnouncements(course.id),
  ]);

  const moduleRow = unwrap(
    await db
      .from("modules")
      .upsert(
        {
          batch_id: batchId,
          classroom_course_id: course.id,
          title: course.name,
          position: modulePosition(course.name),
          classroom_url: course.alternateLink ?? null,
        },
        { onConflict: "batch_id,classroom_course_id" },
      )
      .select("id")
      .single(),
    "module",
  ) as { id: string };

  const topicIds = new Map<string, string>();
  if (topics.length) {
    const saved = unwrap(
      await db
        .from("topics")
        .upsert(
          topics.map((topic) => ({ module_id: moduleRow.id, classroom_topic_id: topic.topicId, title: topic.name })),
          { onConflict: "module_id,classroom_topic_id" },
        )
        .select("id, classroom_topic_id"),
      "topics",
    ) as { id: string; classroom_topic_id: string }[];
    saved.forEach((topic) => topicIds.set(topic.classroom_topic_id, topic.id));
  }

  const incoming: { kind: ItemKind; item: ClassroomItem }[] = [
    ...courseWork.map((item) => ({ kind: "coursework" as const, item })),
    ...materials.map((item) => ({ kind: "material" as const, item })),
    ...announcements.map((item) => ({ kind: "announcement" as const, item })),
  ];

  const seen = new Set(incoming.map(({ kind, item }) => `${kind}:${item.id}`));
  const existing = unwrap(
    await db.from("items").select("id, kind, classroom_id").eq("module_id", moduleRow.id).is("hidden_at", null),
    "existing items",
  ) as { id: string; kind: ItemKind; classroom_id: string }[];

  if (incoming.length) {
    const saved = unwrap(
      await db
        .from("items")
        .upsert(
          incoming.map(({ kind, item }) => ({
            ...toItemRow(kind, item, topicIds),
            module_id: moduleRow.id,
            hidden_at: null,
          })),
          { onConflict: "module_id,kind,classroom_id" },
        )
        .select("id, kind, classroom_id"),
      "items",
    ) as { id: string; kind: ItemKind; classroom_id: string }[];

    const idByKey = new Map(saved.map((row) => [`${row.kind}:${row.classroom_id}`, row.id]));
    unwrap(await db.from("item_attachments").delete().in("item_id", saved.map((row) => row.id)), "old attachments");
    const attachments = incoming.flatMap(({ kind, item }) =>
      toAttachments(item.materials).map((attachment) => ({
        ...attachment,
        item_id: idByKey.get(`${kind}:${item.id}`),
      })),
    );
    if (attachments.length) unwrap(await db.from("item_attachments").insert(attachments), "attachments");
  }

  const gone = existing.filter((row) => !seen.has(`${row.kind}:${row.classroom_id}`)).map((row) => row.id);
  if (gone.length) {
    unwrap(await db.from("items").update({ hidden_at: new Date().toISOString() }).in("id", gone), "hide items");
  }

  return { items: incoming.length, hidden: gone.length };
}

/** Imports one batch. Each module succeeds or fails on its own, and a failure never hides existing items. */
export async function runSync(db: SupabaseClient, batchId: string, section: string, source: ClassroomSource): Promise<SyncResult> {
  const running = unwrap(
    await db
      .from("sync_runs")
      .select("id")
      .eq("batch_id", batchId)
      .eq("status", "running")
      .gt("started_at", new Date(Date.now() - STALE_RUN_MS).toISOString()),
    "running check",
  ) as { id: string }[];
  if (running.length) return { status: "skipped", modules: 0, items: 0, hidden: 0, errors: [] };

  const run = unwrap(
    await db.from("sync_runs").insert({ batch_id: batchId }).select("id").single(),
    "start run",
  ) as { id: string };

  const result: SyncResult = { status: "success", modules: 0, items: 0, hidden: 0, errors: [] };
  try {
    const courses = (await source.listCourses()).filter((course) => course.section === section);
    if (!courses.length) throw new Error("no_matching_courses");

    for (const course of courses) {
      try {
        const counts = await syncModule(db, batchId, course, source);
        result.modules += 1;
        result.items += counts.items;
        result.hidden += counts.hidden;
      } catch (error) {
        result.errors.push(`${course.name}: ${errorCode(error)}`);
      }
    }
    if (result.errors.length) result.status = result.modules ? "partial" : "failed";
  } catch (error) {
    result.status = "failed";
    result.errors.push(errorCode(error));
  }

  unwrap(
    await db
      .from("sync_runs")
      .update({
        status: result.status,
        finished_at: new Date().toISOString(),
        stats: { modules: result.modules, items: result.items, hidden: result.hidden },
        error: result.errors.join("; ") || null,
      })
      .eq("id", run.id),
    "finish run",
  );
  return result;
}

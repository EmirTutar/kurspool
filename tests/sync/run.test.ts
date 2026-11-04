import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import type { ClassroomItem } from "@/lib/sync/map";
import { runSync, type ClassroomCourse, type ClassroomSource } from "@/lib/sync/run";

function localEnv() {
  const output = execSync("npx supabase status -o env", { encoding: "utf8" });
  const env = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="?([^"]*)"?$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1], match[2]]),
  );
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.API_URL ?? "")) {
    throw new Error("Sync tests only run against the local Supabase stack");
  }
  return { url: env.API_URL, serviceKey: env.SECRET_KEY ?? env.SERVICE_ROLE_KEY };
}

const env = localEnv();
const db = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const SECTION = "Batch A";
type Content = { courseWork?: ClassroomItem[]; materials?: ClassroomItem[]; failing?: boolean };

function fakeSource(courses: ClassroomCourse[], content: Record<string, Content>): ClassroomSource {
  const read = (key: "courseWork" | "materials") => async (courseId: string) => {
    if (content[courseId]?.failing) throw new Error("courseWork: 500");
    return content[courseId]?.[key] ?? [];
  };
  return {
    listCourses: async () => courses,
    listTopics: async () => [{ topicId: "t1", name: "Week 1" }],
    listCourseWork: read("courseWork"),
    listMaterials: read("materials"),
    listAnnouncements: async () => [],
  };
}

const course = (id: string, name: string, section = SECTION): ClassroomCourse => ({ id, name, section });
const work = (id: string, title: string, extra: Partial<ClassroomItem> = {}): ClassroomItem => ({ id, title, topicId: "t1", ...extra });

describe("runSync", () => {
  let batchId: string;

  beforeEach(async () => {
    const { data, error } = await db
      .from("batches")
      .insert({ name: "Sync test", slug: `sync-${randomUUID()}` })
      .select("id")
      .single();
    if (error) throw error;
    batchId = data.id;
  });

  async function visibleItems() {
    const { data } = await db
      .from("items")
      .select("classroom_id, title, category, topic_id, modules!inner(batch_id)")
      .eq("modules.batch_id", batchId)
      .is("hidden_at", null);
    return data ?? [];
  }

  it("imports modules, topics, items and attachments in order", async () => {
    const source = fakeSource([course("c1", "1. Second"), course("c0", "0. First")], {
      c1: { courseWork: [work("w1", "📹 Recording", { materials: [{ link: { url: "https://example.com", title: "L" } }] })] },
      c0: { materials: [work("m1", "📆 Dates")] },
    });

    const result = await runSync(db, batchId, SECTION, source);

    expect(result).toMatchObject({ status: "success", modules: 2, items: 2, hidden: 0 });
    const { data: modules } = await db.from("modules").select("title, position").eq("batch_id", batchId).order("position");
    expect(modules).toEqual([
      { title: "0. First", position: 0 },
      { title: "1. Second", position: 1 },
    ]);
    const items = await visibleItems();
    expect(items.map((item) => item.category).sort()).toEqual(["organization", "recording"]);
    expect(items.every((item) => item.topic_id)).toBe(true);
    const { data: attachments } = await db.from("item_attachments").select("type, url, items!inner(classroom_id)").eq("items.classroom_id", "w1");
    expect(attachments?.[0]).toMatchObject({ type: "link", url: "https://example.com" });
  });

  it("creates no duplicates and refreshes content when run twice", async () => {
    const source = (title: string, url: string) =>
      fakeSource([course("c1", "1. M")], { c1: { courseWork: [work("w1", title, { materials: [{ link: { url } }] })] } });

    await runSync(db, batchId, SECTION, source("Old", "https://example.com/old"));
    await runSync(db, batchId, SECTION, source("New", "https://example.com/new"));

    const items = await visibleItems();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("New");
    const { data: attachments } = await db.from("item_attachments").select("url, items!inner(classroom_id, modules!inner(batch_id))").eq("items.modules.batch_id", batchId);
    expect(attachments?.map((row) => row.url)).toEqual(["https://example.com/new"]);
    const { data: modules } = await db.from("modules").select("id").eq("batch_id", batchId);
    expect(modules).toHaveLength(1);
  });

  it("hides removed items, keeps progress, and restores them when they return", async () => {
    const withItems = (...ids: string[]) =>
      fakeSource([course("c1", "1. M")], { c1: { courseWork: ids.map((id) => work(id, id)) } });
    await runSync(db, batchId, SECTION, withItems("w1", "w2"));

    const { data: item } = await db.from("items").select("id, modules!inner(batch_id)").eq("classroom_id", "w2").eq("modules.batch_id", batchId).single();
    const email = `sync-${randomUUID()}@kurspool.test`;
    const { data: user, error: userError } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (userError) throw userError;
    await db.from("item_progress").insert({ user_id: user.user.id, item_id: item!.id, status: "done" });

    const removed = await runSync(db, batchId, SECTION, withItems("w1"));
    expect(removed.hidden).toBe(1);
    expect((await visibleItems()).map((row) => row.classroom_id)).toEqual(["w1"]);

    await runSync(db, batchId, SECTION, withItems("w1", "w2"));
    expect(await visibleItems()).toHaveLength(2);
    const { data: progress } = await db.from("item_progress").select("status").eq("item_id", item!.id);
    expect(progress).toEqual([{ status: "done" }]);
  });

  it("keeps a failed module's items and still updates the others", async () => {
    const courses = [course("c1", "1. Bad"), course("c2", "2. Good")];
    await runSync(db, batchId, SECTION, fakeSource(courses, {
      c1: { courseWork: [work("bad1", "Stays")] },
      c2: { courseWork: [work("good1", "Old")] },
    }));

    const result = await runSync(db, batchId, SECTION, fakeSource(courses, {
      c1: { failing: true },
      c2: { courseWork: [work("good1", "New")] },
    }));

    expect(result.status).toBe("partial");
    expect(result.hidden).toBe(0);
    expect(result.errors[0]).toContain("1. Bad");
    const titles = (await visibleItems()).map((row) => row.title).sort();
    expect(titles).toEqual(["New", "Stays"]);
  });

  it("imports only the batch's section", async () => {
    const result = await runSync(db, batchId, SECTION, fakeSource(
      [course("c1", "1. Mine"), course("x1", "Other class", "Different")],
      { c1: { courseWork: [work("w1", "Mine")] }, x1: { courseWork: [work("x", "Private")] } },
    ));
    expect(result.modules).toBe(1);
    expect((await visibleItems()).map((row) => row.classroom_id)).toEqual(["w1"]);
  });

  it("fails without hiding anything when no course matches", async () => {
    await runSync(db, batchId, SECTION, fakeSource([course("c1", "1. M")], { c1: { courseWork: [work("w1", "Keep")] } }));

    const result = await runSync(db, batchId, SECTION, fakeSource([], {}));

    expect(result.status).toBe("failed");
    expect(result.errors).toEqual(["no_matching_courses"]);
    expect(await visibleItems()).toHaveLength(1);
  });

  it("skips while another run is in progress and records finished runs", async () => {
    await db.from("sync_runs").insert({ batch_id: batchId, status: "running" });
    const skipped = await runSync(db, batchId, SECTION, fakeSource([course("c1", "1. M")], {}));
    expect(skipped.status).toBe("skipped");
    expect(await visibleItems()).toHaveLength(0);

    await db.from("sync_runs").update({ status: "failed", started_at: new Date(0).toISOString() }).eq("batch_id", batchId);
    const done = await runSync(db, batchId, SECTION, fakeSource([course("c1", "1. M")], { c1: { courseWork: [work("w1", "x")] } }));
    expect(done.status).toBe("success");
    const { data: runs } = await db.from("sync_runs").select("status, finished_at, stats").eq("batch_id", batchId).order("started_at", { ascending: false }).limit(1);
    expect(runs?.[0]).toMatchObject({ status: "success", stats: { modules: 1, items: 1, hidden: 0 } });
    expect(runs?.[0].finished_at).not.toBeNull();
  });
});

import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

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
    throw new Error("Browser tests only run against the local Supabase stack");
  }
  return { url: env.API_URL, publicKey: env.PUBLISHABLE_KEY ?? env.ANON_KEY, serviceKey: env.SECRET_KEY ?? env.SERVICE_ROLE_KEY };
}

const env = localEnv();
export const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function insert<T extends object>(table: string, row: T) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

/** A batch with two modules and items, plus quick links, on the local database only. */
export async function createBatch() {
  const id = randomUUID().slice(0, 8);
  const batch = await insert("batches", { name: `Test batch ${id}`, slug: `e2e-${id}`, last_synced_at: new Date().toISOString() });
  const first = await insert("modules", { batch_id: batch.id, classroom_course_id: `a-${id}`, title: "0. First module", position: 0 });
  await insert("modules", { batch_id: batch.id, classroom_course_id: `b-${id}`, title: "1. Empty module", position: 1 });
  const topic = await insert("topics", { module_id: first.id, classroom_topic_id: `t-${id}`, title: "Week one" });
  const makeItem = (title: string, extra: object = {}) =>
    insert("items", {
      module_id: first.id,
      topic_id: topic.id,
      classroom_id: `${title}-${id}`,
      kind: "coursework",
      category: "session",
      title,
      posted_at: new Date().toISOString(),
      ...extra,
    });
  const session = await makeItem("🇬🇧 👨🏼‍💻 Git session", { description: "Read https://example.com/guide first." });
  await insert("item_attachments", { item_id: session.id, type: "link", title: "Handout", url: "https://example.com/handout" });
  await makeItem("📹 Recording", { category: "recording" });
  await makeItem("Upload form", { category: "other", due_at: "2020-01-01T10:00:00Z" });
  await insert("quick_links", { batch_id: batch.id, label: "Slack", url: "https://example.com/slack", icon: "chat", position: 1 });
  return batch as { id: string };
}

/** Signs a test user in by writing the same cookies the app uses. Test accounts exist only locally. */
export async function signInAs(context: BrowserContext, batchId: string | null, role: "student" | "maintainer" = "student") {
  const email = `e2e-${randomUUID().slice(0, 8)}@kurspool.test`;
  const password = `test-${randomUUID()}`;
  if (batchId) await insert("batch_allowed_emails", { batch_id: batchId, email, role });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;

  const jar = new Map<string, string>();
  const client = createServerClient(env.url, env.publicKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  if (batchId) {
    const join = await client.rpc("join_batch_if_allowed");
    if (join.error) throw join.error;
  }
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));
  return { id: data.user.id, email };
}

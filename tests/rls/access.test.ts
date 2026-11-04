import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

function localEnv() {
  const output = execSync("npx supabase status -o env", { encoding: "utf8" });
  const env = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="?([^"]*)"?$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1], match[2]]),
  );
  const url = env.API_URL;
  if (!url || !/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    throw new Error("Access tests only run against the local Supabase stack");
  }
  return {
    url,
    publicKey: env.PUBLISHABLE_KEY ?? env.ANON_KEY,
    serviceKey: env.SECRET_KEY ?? env.SERVICE_ROLE_KEY,
  };
}

const env = localEnv();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.url, env.serviceKey, options);
const run = randomUUID().slice(0, 8);
const emailOf = (name: string) => `${name}-${run}@kurspool.test`;
const password = `test-${randomUUID()}`;

async function signUp(name: string): Promise<{ client: SupabaseClient; id: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: emailOf(name),
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(env.url, env.publicKey, options);
  const signIn = await client.auth.signInWithPassword({ email: emailOf(name), password });
  if (signIn.error) throw signIn.error;
  return { client, id: data.user.id };
}

async function insert<T extends object>(table: string, row: T) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

describe("access rules", () => {
  let alice: Awaited<ReturnType<typeof signUp>>;
  let bob: Awaited<ReturnType<typeof signUp>>;
  let mia: Awaited<ReturnType<typeof signUp>>;
  let carl: Awaited<ReturnType<typeof signUp>>;
  let uma: Awaited<ReturnType<typeof signUp>>;
  let batchA: { id: string };
  let batchB: { id: string };
  let moduleA: { id: string };
  let itemA: { id: string };
  let hiddenItem: { id: string };
  let itemB: { id: string };

  const makeModule = (batchId: string, label: string) =>
    insert("modules", {
      batch_id: batchId,
      classroom_course_id: `${label}-${run}`,
      title: label,
      position: 0,
    });
  const makeItem = (moduleId: string, label: string, hiddenAt: string | null = null) =>
    insert("items", {
      module_id: moduleId,
      classroom_id: `${label}-${run}`,
      kind: "coursework",
      category: "session",
      title: label,
      hidden_at: hiddenAt,
    });

  beforeAll(async () => {
    batchA = await insert("batches", { name: "A", slug: `a-${run}` });
    batchB = await insert("batches", { name: "B", slug: `b-${run}` });
    await insert("batch_allowed_emails", { batch_id: batchA.id, email: emailOf("alice") });
    await insert("batch_allowed_emails", { batch_id: batchA.id, email: emailOf("bob") });
    await insert("batch_allowed_emails", { batch_id: batchA.id, email: emailOf("mia"), role: "maintainer" });
    await insert("batch_allowed_emails", { batch_id: batchB.id, email: emailOf("carl") });
    moduleA = await makeModule(batchA.id, "module-a");
    const moduleB = await makeModule(batchB.id, "module-b");
    itemA = await makeItem(moduleA.id, "item-a");
    hiddenItem = await makeItem(moduleA.id, "item-hidden", new Date().toISOString());
    itemB = await makeItem(moduleB.id, "item-b");
    await insert("quick_links", { batch_id: batchA.id, label: "Slack", url: "https://example.com", position: 0 });
    await insert("sync_runs", { batch_id: batchA.id, status: "success" });
    await insert("sync_credentials", { batch_id: batchA.id, encrypted_refresh_token: "secret" });

    [alice, bob, mia, carl, uma] = await Promise.all(["alice", "bob", "mia", "carl", "uma"].map(signUp));
    for (const user of [alice, bob, mia, carl]) {
      const { error } = await user.client.rpc("join_batch_if_allowed");
      if (error) throw error;
    }
  });

  describe("joining", () => {
    it("rejects an unlisted user, who then reads nothing", async () => {
      const { data, error } = await uma.client.rpc("join_batch_if_allowed");
      expect(error).toBeNull();
      expect(data).toBeNull();
      expect((await uma.client.from("modules").select()).data).toEqual([]);
      expect((await uma.client.from("batches").select()).data).toEqual([]);
    });

    it("joins a listed user to their batch with the listed role", async () => {
      const student = await alice.client.from("batch_members").select("batch_id, role").eq("user_id", alice.id).single();
      expect(student.data).toEqual({ batch_id: batchA.id, role: "student" });
      const maintainer = await mia.client.from("batch_members").select("role").eq("user_id", mia.id).single();
      expect(maintainer.data?.role).toBe("maintainer");
    });

    it("is safe to call again", async () => {
      const { data } = await alice.client.rpc("join_batch_if_allowed");
      expect(data).toBe(batchA.id);
    });

    it("ends access as soon as the email is removed from the batch list", async () => {
      await insert("batch_allowed_emails", { batch_id: batchA.id, email: emailOf("dana") });
      const dana = await signUp("dana");
      expect((await dana.client.rpc("join_batch_if_allowed")).data).toBe(batchA.id);
      expect((await dana.client.from("items").select("id")).data).toEqual([{ id: itemA.id }]);

      const removal = await admin.from("batch_allowed_emails").delete().eq("email", emailOf("dana"));
      expect(removal.error).toBeNull();

      expect((await dana.client.from("items").select("id")).data).toEqual([]);
      expect((await dana.client.rpc("join_batch_if_allowed")).data).toBeNull();
    });

    it("cannot be called without a session", async () => {
      const anonymous = createClient(env.url, env.publicKey, options);
      const { error } = await anonymous.rpc("join_batch_if_allowed");
      expect(error).not.toBeNull();
    });
  });

  describe("batch content", () => {
    it("lets members read their own batch's modules and items", async () => {
      expect((await alice.client.from("modules").select("id")).data).toEqual([{ id: moduleA.id }]);
      expect((await alice.client.from("items").select("id")).data).toEqual([{ id: itemA.id }]);
    });

    it("hides another batch's content", async () => {
      expect((await alice.client.from("items").select().eq("id", itemB.id)).data).toEqual([]);
      expect((await carl.client.from("items").select().eq("id", itemA.id)).data).toEqual([]);
      expect((await alice.client.from("batches").select().eq("id", batchB.id)).data).toEqual([]);
    });

    it("hides hidden items from members", async () => {
      expect((await alice.client.from("items").select().eq("id", hiddenItem.id)).data).toEqual([]);
    });

    it("blocks students and maintainers from writing imported content", async () => {
      for (const user of [alice, mia]) {
        const { error } = await user.client.from("items").insert({
          module_id: moduleA.id,
          classroom_id: `forged-${run}`,
          kind: "material",
          category: "other",
          title: "forged",
        });
        expect(error).not.toBeNull();
      }
      await alice.client.from("items").update({ title: "changed" }).eq("id", itemA.id);
      const { data } = await admin.from("items").select("title").eq("id", itemA.id).single();
      expect(data?.title).toBe("item-a");
    });
  });

  describe("personal data", () => {
    it("keeps progress private to its owner", async () => {
      const write = await alice.client.from("item_progress").insert({ user_id: alice.id, item_id: itemA.id, status: "done" });
      expect(write.error).toBeNull();
      expect((await alice.client.from("item_progress").select("status")).data).toEqual([{ status: "done" }]);
      expect((await bob.client.from("item_progress").select()).data).toEqual([]);
      expect((await mia.client.from("item_progress").select()).data).toEqual([]);
    });

    it("blocks writing progress for someone else or for another batch", async () => {
      const forUser = await bob.client.from("item_progress").insert({ user_id: alice.id, item_id: hiddenItem.id, status: "done" });
      expect(forUser.error).not.toBeNull();
      const otherBatch = await alice.client.from("item_progress").insert({ user_id: alice.id, item_id: itemB.id, status: "done" });
      expect(otherBatch.error).not.toBeNull();
    });

    it("keeps tasks and links private to their owner", async () => {
      await alice.client.from("personal_tasks").insert({ user_id: alice.id, title: "mine" });
      await alice.client.from("user_links").insert({ user_id: alice.id, label: "Miro", url: "https://example.com", position: 0 });
      expect((await alice.client.from("personal_tasks").select("title")).data).toEqual([{ title: "mine" }]);
      expect((await alice.client.from("user_links").select("label")).data).toEqual([{ label: "Miro" }]);
      expect((await bob.client.from("personal_tasks").select()).data).toEqual([]);
      expect((await bob.client.from("user_links").select()).data).toEqual([]);
      const forged = await bob.client.from("personal_tasks").insert({ user_id: alice.id, title: "forged" });
      expect(forged.error).not.toBeNull();
    });
  });

  describe("account deletion", () => {
    it("removes the user's progress, tasks, links and membership", async () => {
      await insert("batch_allowed_emails", { batch_id: batchA.id, email: emailOf("erin") });
      const erin = await signUp("erin");
      await erin.client.rpc("join_batch_if_allowed");
      await erin.client.from("item_progress").insert({ user_id: erin.id, item_id: itemA.id, status: "done" });
      await erin.client.from("personal_tasks").insert({ user_id: erin.id, title: "t" });
      await erin.client.from("user_links").insert({ user_id: erin.id, label: "l", url: "https://example.com", position: 0 });

      const { error } = await admin.auth.admin.deleteUser(erin.id);
      expect(error).toBeNull();

      for (const table of ["item_progress", "personal_tasks", "user_links", "batch_members"]) {
        const { data } = await admin.from(table).select("user_id").eq("user_id", erin.id);
        expect(data, table).toEqual([]);
      }
      await admin.from("batch_allowed_emails").delete().eq("email", emailOf("erin"));
    });
  });

  describe("batch settings", () => {
    it("blocks self-promotion and joining by direct insert", async () => {
      await alice.client.from("batch_members").update({ role: "maintainer" }).eq("user_id", alice.id);
      const { data } = await admin.from("batch_members").select("role").eq("user_id", alice.id).single();
      expect(data?.role).toBe("student");
      const direct = await uma.client.from("batch_members").insert({ user_id: uma.id, batch_id: batchA.id, role: "maintainer" });
      expect(direct.error).not.toBeNull();
    });

    it("lets members read quick links but only maintainers edit them", async () => {
      expect((await alice.client.from("quick_links").select("label")).data).toEqual([{ label: "Slack" }]);
      const row = { batch_id: batchA.id, label: "New", url: "https://example.com/new", position: 1 };
      expect((await alice.client.from("quick_links").insert(row)).error).not.toBeNull();
      expect((await mia.client.from("quick_links").insert(row)).error).toBeNull();
      expect((await carl.client.from("quick_links").select()).data).toEqual([]);
    });

    it("lets only maintainers read and edit the batch list", async () => {
      expect((await alice.client.from("batch_allowed_emails").select()).data).toEqual([]);
      expect((await mia.client.from("batch_allowed_emails").select()).data?.length).toBe(3);
      const row = { batch_id: batchA.id, email: emailOf("new") };
      expect((await alice.client.from("batch_allowed_emails").insert(row)).error).not.toBeNull();
      expect((await mia.client.from("batch_allowed_emails").insert(row)).error).toBeNull();
    });

    it("rejects non-web links", async () => {
      const quick = await mia.client.from("quick_links").insert({ batch_id: batchA.id, label: "x", url: "javascript:alert(1)", position: 2 });
      expect(quick.error).not.toBeNull();
      const personal = await alice.client.from("user_links").insert({ user_id: alice.id, label: "x", url: "javascript:alert(1)", position: 2 });
      expect(personal.error).not.toBeNull();
    });
  });

  describe("sync data", () => {
    it("never exposes credentials to signed-in users", async () => {
      for (const user of [alice, mia]) {
        const { data, error } = await user.client.from("sync_credentials").select();
        expect(error !== null || data?.length === 0).toBe(true);
      }
    });

    it("shows sync history only to maintainers", async () => {
      expect((await alice.client.from("sync_runs").select()).data).toEqual([]);
      expect((await mia.client.from("sync_runs").select()).data?.length).toBe(1);
    });
  });
});

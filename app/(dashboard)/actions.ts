"use server";

import { revalidatePath } from "next/cache";
import { parseEmail, parseItemStatus, parseLink, parseTitle } from "@/lib/forms";
import { getMembership } from "@/lib/membership";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const refresh = () => revalidatePath("/", "layout");

async function requireMember() {
  const membership = await getMembership();
  if (!membership) throw new Error("not_a_member");
  return membership;
}

async function requireMaintainer() {
  const membership = await requireMember();
  if (membership.role !== "maintainer") throw new Error("not_a_maintainer");
  return membership;
}

export async function setItemStatus(form: FormData) {
  const { supabase, user } = await requireMember();
  const status = parseItemStatus(form.get("status"));
  const itemId = text(form, "itemId");
  if (!status || !itemId) return;
  await supabase
    .from("item_progress")
    .upsert({ user_id: user.id, item_id: itemId, status, updated_at: new Date().toISOString() });
  refresh();
}

/** Opening an item moves it from New to To do, and never overwrites Done or Skipped. */
export async function markItemSeen(itemId: string) {
  const { supabase, user } = await requireMember();
  await supabase
    .from("item_progress")
    .upsert({ user_id: user.id, item_id: itemId, status: "todo" }, { onConflict: "user_id,item_id", ignoreDuplicates: true });
  refresh();
}

export async function markAllSeen() {
  const { supabase, user } = await requireMember();
  const { data: items } = await supabase.from("items").select("id");
  if (items?.length) {
    await supabase
      .from("item_progress")
      .upsert(
        items.map((item) => ({ user_id: user.id, item_id: item.id, status: "todo" })),
        { onConflict: "user_id,item_id", ignoreDuplicates: true },
      );
  }
  refresh();
}

export async function addTask(form: FormData) {
  const { supabase, user } = await requireMember();
  const title = parseTitle(text(form, "title"));
  if (!title) return;
  await supabase.from("personal_tasks").insert({ user_id: user.id, title, due_on: text(form, "dueOn") || null });
  refresh();
}

export async function toggleTask(form: FormData) {
  const { supabase, user } = await requireMember();
  await supabase
    .from("personal_tasks")
    .update({ done: text(form, "done") === "true" })
    .eq("id", text(form, "taskId"))
    .eq("user_id", user.id);
  refresh();
}

export async function deleteTask(form: FormData) {
  const { supabase, user } = await requireMember();
  await supabase.from("personal_tasks").delete().eq("id", text(form, "taskId")).eq("user_id", user.id);
  refresh();
}

export async function addUserLink(form: FormData) {
  const { supabase, user } = await requireMember();
  const link = parseLink(text(form, "label"), text(form, "url"));
  if (!link) return;
  await supabase.from("user_links").insert({ ...link, user_id: user.id, position: Date.now() % 2147483647 });
  refresh();
}

export async function deleteUserLink(form: FormData) {
  const { supabase, user } = await requireMember();
  await supabase.from("user_links").delete().eq("id", text(form, "linkId")).eq("user_id", user.id);
  refresh();
}

export async function addQuickLink(form: FormData) {
  const { supabase, batchId } = await requireMaintainer();
  const link = parseLink(text(form, "label"), text(form, "url"));
  if (!link) return;
  await supabase.from("quick_links").insert({ ...link, batch_id: batchId, position: Date.now() % 2147483647 });
  refresh();
}

export async function deleteQuickLink(form: FormData) {
  const { supabase, batchId } = await requireMaintainer();
  await supabase.from("quick_links").delete().eq("id", text(form, "linkId")).eq("batch_id", batchId);
  refresh();
}

export async function addAllowedEmail(form: FormData) {
  const { supabase, batchId } = await requireMaintainer();
  const email = parseEmail(text(form, "email"));
  if (!email) return;
  await supabase.from("batch_allowed_emails").upsert({ batch_id: batchId, email }, { onConflict: "batch_id,email", ignoreDuplicates: true });
  refresh();
}

export async function removeAllowedEmail(form: FormData) {
  const { supabase, batchId, user } = await requireMaintainer();
  const email = parseEmail(text(form, "email"));
  // A maintainer removing their own email would lock the batch out of its settings.
  if (!email || email === user.email?.toLowerCase()) return;
  await supabase.from("batch_allowed_emails").delete().eq("batch_id", batchId).eq("email", email);
  refresh();
}

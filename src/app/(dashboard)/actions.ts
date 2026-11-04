"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { canDeleteAccount, parseEmail, parseItemStatus, parseLink, parseLocale, parseTitle } from "@/lib/forms";
import type { Dictionary } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";
import { createAdminClient } from "@/lib/supabase/admin";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const refresh = () => revalidatePath("/", "layout");

class NotAllowedError extends Error {}

async function requireMember() {
  const membership = await getMembership();
  if (!membership) throw new NotAllowedError();
  return membership;
}

async function requireMaintainer() {
  const membership = await requireMember();
  if (membership.role !== "maintainer") throw new NotAllowedError();
  return membership;
}

/** Turns every failure into a message the person can act on. */
async function guarded(work: (t: Dictionary) => Promise<ActionResult>): Promise<ActionResult> {
  const { t } = await getDictionary();
  try {
    return await work(t);
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: error instanceof NotAllowedError ? t.feedback.notAllowed : t.feedback.saveFailed };
  }
}

function saved(error: unknown, t: Dictionary, message?: string): ActionResult {
  if (error) return { ok: false, message: t.feedback.saveFailed };
  refresh();
  return { ok: true, message };
}

export async function setItemStatus(itemId: string, rawStatus: string) {
  return guarded(async (t) => {
    const { supabase, user } = await requireMember();
    const status = parseItemStatus(rawStatus);
    if (!status || !itemId) return { ok: false, message: t.feedback.saveFailed };
    const { error } = await supabase
      .from("item_progress")
      .upsert({ user_id: user.id, item_id: itemId, status, updated_at: new Date().toISOString() });
    return saved(error, t);
  });
}

/** Opening an item moves it from New to To do, and never overwrites Done or Skipped. */
export async function markItemSeen(itemId: string) {
  return guarded(async (t) => {
    const { supabase, user } = await requireMember();
    const { error } = await supabase
      .from("item_progress")
      .upsert({ user_id: user.id, item_id: itemId, status: "todo" }, { onConflict: "user_id,item_id", ignoreDuplicates: true });
    // No refresh: the open item stays in place to be read, and moves on the next page load.
    return error ? { ok: false, message: t.feedback.saveFailed } : { ok: true };
  });
}

export async function markAllSeen() {
  return guarded(async (t) => {
    const { supabase, user } = await requireMember();
    const { data: items, error } = await supabase.from("items").select("id");
    if (error) return { ok: false, message: t.feedback.saveFailed };
    if (!items.length) return { ok: true };
    const write = await supabase
      .from("item_progress")
      .upsert(
        items.map((item) => ({ user_id: user.id, item_id: item.id, status: "todo" })),
        { onConflict: "user_id,item_id", ignoreDuplicates: true },
      );
    return saved(write.error, t, t.feedback.allSeen);
  });
}

export async function addTask(form: FormData) {
  return guarded(async (t) => {
    const { supabase, user } = await requireMember();
    const title = parseTitle(text(form, "title"));
    if (!title) return { ok: false, message: t.feedback.invalidTitle };
    const { error } = await supabase.from("personal_tasks").insert({ user_id: user.id, title });
    return saved(error, t, t.feedback.taskAdded);
  });
}

export async function toggleTask(form: FormData) {
  return guarded(async (t) => {
    const { supabase, user } = await requireMember();
    const { error } = await supabase
      .from("personal_tasks")
      .update({ done: text(form, "done") === "true" })
      .eq("id", text(form, "taskId"))
      .eq("user_id", user.id);
    return saved(error, t);
  });
}

export async function deleteTask(form: FormData) {
  return guarded(async (t) => {
    const { supabase, user } = await requireMember();
    const { error } = await supabase.from("personal_tasks").delete().eq("id", text(form, "taskId")).eq("user_id", user.id);
    return saved(error, t);
  });
}

export async function addUserLink(form: FormData) {
  return guarded(async (t) => {
    const { supabase, user } = await requireMember();
    const link = parseLink(text(form, "label"), text(form, "url"));
    if (!link) return { ok: false, message: t.feedback.invalidLink };
    const { error } = await supabase
      .from("user_links")
      .insert({ ...link, user_id: user.id, position: Math.floor(Date.now() / 1000) });
    return saved(error, t, t.feedback.linkAdded);
  });
}

export async function deleteUserLink(form: FormData) {
  return guarded(async (t) => {
    const { supabase, user } = await requireMember();
    const { error } = await supabase.from("user_links").delete().eq("id", text(form, "linkId")).eq("user_id", user.id);
    return saved(error, t, t.feedback.linkDeleted);
  });
}

export async function addQuickLink(form: FormData) {
  return guarded(async (t) => {
    const { supabase, batchId } = await requireMaintainer();
    const link = parseLink(text(form, "label"), text(form, "url"));
    if (!link) return { ok: false, message: t.feedback.invalidLink };
    const { error } = await supabase
      .from("quick_links")
      .insert({ ...link, batch_id: batchId, position: Math.floor(Date.now() / 1000) });
    return saved(error, t, t.feedback.linkAdded);
  });
}

export async function deleteQuickLink(form: FormData) {
  return guarded(async (t) => {
    const { supabase, batchId } = await requireMaintainer();
    const { error } = await supabase.from("quick_links").delete().eq("id", text(form, "linkId")).eq("batch_id", batchId);
    return saved(error, t, t.feedback.linkDeleted);
  });
}

export async function addAllowedEmail(form: FormData) {
  return guarded(async (t) => {
    const { supabase, batchId } = await requireMaintainer();
    const email = parseEmail(text(form, "email"));
    if (!email) return { ok: false, message: t.feedback.invalidEmail };
    const { error } = await supabase
      .from("batch_allowed_emails")
      .upsert({ batch_id: batchId, email }, { onConflict: "batch_id,email", ignoreDuplicates: true });
    return saved(error, t, t.feedback.personAdded);
  });
}

export async function removeAllowedEmail(form: FormData) {
  return guarded(async (t) => {
    const { supabase, batchId, user } = await requireMaintainer();
    const email = parseEmail(text(form, "email"));
    if (!email) return { ok: false, message: t.feedback.invalidEmail };
    // A maintainer removing their own email would lock the batch out of its settings.
    if (email === user.email?.toLowerCase()) return { ok: false, message: t.feedback.ownEmail };
    const { error } = await supabase.from("batch_allowed_emails").delete().eq("batch_id", batchId).eq("email", email);
    return saved(error, t, t.feedback.personRemoved);
  });
}

export async function setLocale(form: FormData) {
  const store = await cookies();
  store.set("locale", parseLocale(text(form, "locale")), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

export async function deleteAccount(form: FormData) {
  const result = await guarded(async (t) => {
    const { supabase, user, role, batchId } = await requireMember();
    if (text(form, "confirm").trim() !== t.settings.confirmWord) {
      return { ok: false, message: t.feedback.confirmMismatch };
    }
    const admin = createAdminClient();
    const { count, error: countError } = await admin
      .from("batch_members")
      .select("user_id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .eq("role", "maintainer")
      .neq("user_id", user.id);
    if (countError) return { ok: false, message: t.feedback.saveFailed };
    if (!canDeleteAccount(role, count ?? 0)) return { ok: false, message: t.feedback.lastMaintainer };

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return { ok: false, message: t.feedback.saveFailed };
    await supabase.auth.signOut();
    return { ok: true };
  });
  if (result.ok) redirect("/");
  return result;
}

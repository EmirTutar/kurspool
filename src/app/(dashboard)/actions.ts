"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { describeActionError } from "@/lib/action-log";
import type { ActionResult } from "@/lib/action-result";
import { isCohortName, parseIcalUrl, shortCalendarName } from "@/lib/calendar/ical";
import { applyEvents, FeedError, readFeed, refreshBatchCalendars } from "@/lib/calendar/sync";
import { canDeleteAccount, parseCalendarChoices, parseEmail, parseIdea, parseNote, parseItemStatus, parseLink, parseLocale, parseTitle } from "@/lib/forms";
import { fill, type Dictionary } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";
import { encryptToken } from "@/lib/sync/crypto";
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

/** Turns every failure into a message the person can act on, and logs the ones they can't fix themselves. */
async function guarded(action: string, work: (t: Dictionary) => Promise<ActionResult>): Promise<ActionResult> {
  const { t } = await getDictionary();
  try {
    return await work(t);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof NotAllowedError) return { ok: false, message: t.feedback.notAllowed };
    console.error("Action failed", describeActionError(action, error));
    return { ok: false, message: t.feedback.saveFailed };
  }
}

function saved(error: unknown, message?: string): ActionResult {
  if (error) throw error;
  refresh();
  return { ok: true, message };
}

export async function setItemStatus(itemId: string, rawStatus: string) {
  return guarded("setItemStatus", async (t) => {
    const { supabase, user } = await requireMember();
    const status = parseItemStatus(rawStatus);
    if (!status || !itemId) return { ok: false, message: t.feedback.saveFailed };
    const { error } = await supabase
      .from("item_progress")
      .upsert({ user_id: user.id, item_id: itemId, status, updated_at: new Date().toISOString() });
    return saved(error);
  });
}

/** Opening an item moves it from New to To do, and never overwrites Done or Skipped. */
export async function markItemSeen(itemId: string) {
  return guarded("markItemSeen", async () => {
    const { supabase, user } = await requireMember();
    const { error } = await supabase
      .from("item_progress")
      .upsert({ user_id: user.id, item_id: itemId, status: "todo" }, { onConflict: "user_id,item_id", ignoreDuplicates: true });
    // No refresh: the open item stays in place to be read, and moves on the next page load.
    if (error) throw error;
    return { ok: true };
  });
}

export async function markAllSeen() {
  return guarded("markAllSeen", async (t) => {
    const { supabase, user } = await requireMember();
    const { data: items, error } = await supabase.from("items").select("id");
    if (error) throw error;
    if (!items.length) return { ok: true };
    const write = await supabase
      .from("item_progress")
      .upsert(
        items.map((item) => ({ user_id: user.id, item_id: item.id, status: "todo" })),
        { onConflict: "user_id,item_id", ignoreDuplicates: true },
      );
    return saved(write.error, t.feedback.allSeen);
  });
}

export async function addTask(form: FormData) {
  return guarded("addTask", async (t) => {
    const { supabase, user } = await requireMember();
    const title = parseTitle(text(form, "title"));
    if (!title) return { ok: false, message: t.feedback.invalidTitle };
    const { error } = await supabase.from("personal_tasks").insert({ user_id: user.id, title });
    return saved(error, t.feedback.taskAdded);
  });
}

export async function toggleTask(form: FormData) {
  return guarded("toggleTask", async () => {
    const { supabase, user } = await requireMember();
    const { error } = await supabase
      .from("personal_tasks")
      .update({ done: text(form, "done") === "true" })
      .eq("id", text(form, "taskId"))
      .eq("user_id", user.id);
    return saved(error);
  });
}

export async function deleteTask(form: FormData) {
  return guarded("deleteTask", async () => {
    const { supabase, user } = await requireMember();
    const { error } = await supabase.from("personal_tasks").delete().eq("id", text(form, "taskId")).eq("user_id", user.id);
    return saved(error);
  });
}

export async function addUserLink(form: FormData) {
  return guarded("addUserLink", async (t) => {
    const { supabase, user } = await requireMember();
    const link = parseLink(text(form, "label"), text(form, "url"));
    if (!link) return { ok: false, message: t.feedback.invalidLink };
    const { error } = await supabase
      .from("user_links")
      .insert({ ...link, user_id: user.id, position: Math.floor(Date.now() / 1000) });
    return saved(error, t.feedback.linkAdded);
  });
}

export async function deleteUserLink(form: FormData) {
  return guarded("deleteUserLink", async (t) => {
    const { supabase, user } = await requireMember();
    const { error } = await supabase.from("user_links").delete().eq("id", text(form, "linkId")).eq("user_id", user.id);
    return saved(error, t.feedback.linkDeleted);
  });
}

export async function addQuickLink(form: FormData) {
  return guarded("addQuickLink", async (t) => {
    const { supabase, batchId } = await requireMaintainer();
    const link = parseLink(text(form, "label"), text(form, "url"));
    if (!link) return { ok: false, message: t.feedback.invalidLink };
    const { error } = await supabase
      .from("quick_links")
      .insert({ ...link, batch_id: batchId, position: Math.floor(Date.now() / 1000) });
    return saved(error, t.feedback.linkAdded);
  });
}

export async function deleteQuickLink(form: FormData) {
  return guarded("deleteQuickLink", async (t) => {
    const { supabase, batchId } = await requireMaintainer();
    const { error } = await supabase.from("quick_links").delete().eq("id", text(form, "linkId")).eq("batch_id", batchId);
    return saved(error, t.feedback.linkDeleted);
  });
}

export async function addAllowedEmail(form: FormData) {
  return guarded("addAllowedEmail", async (t) => {
    const { supabase, batchId } = await requireMaintainer();
    const email = parseEmail(text(form, "email"));
    if (!email) return { ok: false, message: t.feedback.invalidEmail };
    const { error } = await supabase
      .from("batch_allowed_emails")
      .upsert({ batch_id: batchId, email }, { onConflict: "batch_id,email", ignoreDuplicates: true });
    return saved(error, t.feedback.personAdded);
  });
}

export async function removeAllowedEmail(form: FormData) {
  return guarded("removeAllowedEmail", async (t) => {
    const { supabase, batchId, user } = await requireMaintainer();
    const email = parseEmail(text(form, "email"));
    if (!email) return { ok: false, message: t.feedback.invalidEmail };
    // A maintainer removing their own email would lock the batch out of its settings.
    if (email === user.email?.toLowerCase()) return { ok: false, message: t.feedback.ownEmail };
    const { error } = await supabase.from("batch_allowed_emails").delete().eq("batch_id", batchId).eq("email", email);
    return saved(error, t.feedback.personRemoved);
  });
}

/** Saves what this person ticked. Nothing else ever writes these choices. */
export async function saveCalendarChoices(choices: { cohortIds: string[]; hiddenGroups: string[]; view: string }) {
  return guarded("saveCalendarChoices", async (t) => {
    const { supabase, user } = await requireMember();
    const parsed = parseCalendarChoices(choices);
    if (!parsed) return { ok: false, message: t.calendar.saveFailed };
    const { error } = await supabase
      .from("calendar_preferences")
      .upsert({ ...parsed, user_id: user.id, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { ok: true };
  });
}

/** Called when the page opens. Reads calendars not tried in the last 10 minutes, and never bothers the visitor if that fails. */
export async function refreshCalendarEvents(): Promise<ActionResult> {
  try {
    const membership = await getMembership();
    const key = process.env.SYNC_TOKEN_KEY;
    if (!membership || !key || !process.env.SUPABASE_SECRET_KEY) return { ok: true };
    if (await refreshBatchCalendars(createAdminClient(), membership.batchId, { key })) refresh();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Action failed", describeActionError("refreshCalendarEvents", error));
  }
  return { ok: true };
}

export async function addCalendar(form: FormData) {
  return guarded("addCalendar", async (t) => {
    const { batchId } = await requireMaintainer();
    const m = t.calendar.manage;
    const url = parseIcalUrl(text(form, "url"));
    if (!url) return { ok: false, message: m.invalidAddress };
    const key = process.env.SYNC_TOKEN_KEY;
    if (!key) return { ok: false, message: t.maintainer.runError.missing_configuration };

    const now = new Date();
    let feed;
    try {
      feed = await readFeed(url, now);
    } catch (error) {
      if (error instanceof FeedError) return { ok: false, message: m.errors[error.code] };
      throw error;
    }
    if (!feed.name) return { ok: false, message: m.noName };

    const title = shortCalendarName(feed.name);
    const admin = createAdminClient();
    const { data: calendar, error } = await admin
      .from("calendars")
      .upsert(
        { batch_id: batchId, title, is_cohort: isCohortName(title), last_synced_at: now.toISOString(), last_attempt_at: now.toISOString(), last_error: null },
        { onConflict: "batch_id,title" },
      )
      .select("id")
      .single();
    if (error) throw error;
    const source = await admin.from("calendar_sources").upsert({ calendar_id: calendar.id, encrypted_url: encryptToken(url, key) });
    if (source.error) throw source.error;
    await applyEvents(admin, calendar.id, feed.events, now);
    return saved(null, fill(m.added, { name: title }));
  });
}

export async function removeCalendar(form: FormData) {
  return guarded("removeCalendar", async (t) => {
    const { batchId } = await requireMaintainer();
    const { error } = await createAdminClient().from("calendars").delete().eq("id", text(form, "calendarId")).eq("batch_id", batchId);
    return saved(error, t.calendar.manage.removed);
  });
}

/** The note on one course item. Saving it empty removes it. */
export async function saveItemNote(itemId: string, rawBody: string) {
  return guarded("saveItemNote", async (t) => {
    const { supabase, user } = await requireMember();
    const body = rawBody.trim();
    if (!itemId || body.length > 10000) return { ok: false, message: t.notes.invalid };
    if (!body) {
      const { error } = await supabase.from("notes").delete().eq("user_id", user.id).eq("item_id", itemId);
      return saved(error, t.notes.removed);
    }
    const { error } = await supabase
      .from("notes")
      .upsert({ user_id: user.id, item_id: itemId, body, updated_at: new Date().toISOString() }, { onConflict: "user_id,item_id" });
    return saved(error, t.notes.saved);
  });
}

export async function addNote(form: FormData) {
  return guarded("addNote", async (t) => {
    const { supabase, user } = await requireMember();
    const note = parseNote(text(form, "title"), text(form, "body"));
    if (!note) return { ok: false, message: t.notes.invalid };
    const { error } = await supabase.from("notes").insert({ ...note, user_id: user.id });
    return saved(error, t.notes.saved);
  });
}

export async function updateNote(form: FormData) {
  return guarded("updateNote", async (t) => {
    const { supabase, user } = await requireMember();
    const note = parseNote(text(form, "title"), text(form, "body"));
    if (!note) return { ok: false, message: t.notes.invalid };
    // A note on course material keeps the material's title, so only the text changes there.
    const changes = form.has("title") ? note : { body: note.body };
    const { error } = await supabase
      .from("notes")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", text(form, "noteId"))
      .eq("user_id", user.id);
    return saved(error, t.notes.saved);
  });
}

export async function deleteNote(form: FormData) {
  return guarded("deleteNote", async (t) => {
    const { supabase, user } = await requireMember();
    const { error } = await supabase.from("notes").delete().eq("id", text(form, "noteId")).eq("user_id", user.id);
    return saved(error, t.notes.removed);
  });
}

export async function addIdea(form: FormData) {
  return guarded("addIdea", async (t) => {
    const { supabase, user, batchId } = await requireMember();
    const body = parseIdea(text(form, "body"));
    if (!body) return { ok: false, message: t.ideas.invalid };
    const { error } = await supabase.from("ideas").insert({ body, user_id: user.id, batch_id: batchId });
    return saved(error, t.ideas.added);
  });
}

/** Access rules let authors remove their own ideas and maintainers remove any in their batch. */
export async function deleteIdea(form: FormData) {
  return guarded("deleteIdea", async (t) => {
    const { supabase } = await requireMember();
    const { error } = await supabase.from("ideas").delete().eq("id", text(form, "ideaId"));
    return saved(error, t.ideas.removed);
  });
}

export async function setLocale(form: FormData) {
  const store = await cookies();
  store.set("locale", parseLocale(text(form, "locale")), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

export async function deleteAccount(form: FormData) {
  const result = await guarded("deleteAccount", async (t) => {
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
    if (countError) throw countError;
    if (!canDeleteAccount(role, count ?? 0)) return { ok: false, message: t.feedback.lastMaintainer };

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    await supabase.auth.signOut();
    return { ok: true };
  });
  if (result.ok) redirect("/");
  return result;
}

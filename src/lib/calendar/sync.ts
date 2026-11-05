import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/sync/crypto";
import { parseIcal, type ParsedCalendar, type ParsedEvent } from "./ical";
import { dayKey } from "./view";

export const REFRESH_AFTER_MS = 10 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_DAYS = 120;
const FUTURE_DAYS = 400;
const MAX_FEED_BYTES = 5 * 1024 * 1024;

type FetchLike = typeof fetch;

/** A short code without the address, because the address is a secret and these codes end up in the database. */
export class FeedError extends Error {
  constructor(public code: "feed_unavailable" | "feed_denied" | "feed_invalid" | "feed_empty" | "database_error") {
    super(code);
    this.name = "FeedError";
  }
}

export function feedWindow(now: Date) {
  return { from: new Date(now.getTime() - PAST_DAYS * DAY_MS), to: new Date(now.getTime() + FUTURE_DAYS * DAY_MS) };
}

export async function readFeed(url: string, now: Date, fetchImpl: FetchLike = fetch): Promise<ParsedCalendar> {
  let text: string;
  try {
    const response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (response.status === 401 || response.status === 403 || response.status === 404) throw new FeedError("feed_denied");
    if (!response.ok) throw new FeedError("feed_unavailable");
    text = await response.text();
  } catch (error) {
    throw error instanceof FeedError ? error : new FeedError("feed_unavailable");
  }
  if (text.length > MAX_FEED_BYTES) throw new FeedError("feed_invalid");
  try {
    return parseIcal(text, feedWindow(now));
  } catch {
    throw new FeedError("feed_invalid");
  }
}

function must<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw new FeedError("database_error");
  return result.data as T;
}

/** Stores a feed's events. A future event that left the feed is kept and marked as cancelled. */
export async function applyEvents(db: SupabaseClient, calendarId: string, events: ParsedEvent[], now: Date) {
  const { to } = feedWindow(now);
  const existing = must(
    await db
      .from("calendar_events")
      .select("id, event_key, uid, starts_at, cancelled_at")
      .eq("calendar_id", calendarId)
      .gte("starts_at", now.toISOString())
      .lte("starts_at", to.toISOString())
      .limit(5000),
  ) as { id: string; event_key: string; uid: string; starts_at: string; cancelled_at: string | null }[];
  const active = existing.filter((row) => !row.cancelled_at);

  // An empty feed is more likely a fault than every event being cancelled at once.
  if (!events.length && active.length) throw new FeedError("feed_empty");

  for (let start = 0; start < events.length; start += 500) {
    const rows = events.slice(start, start + 500).map((event) => ({ ...event, calendar_id: calendarId, cancelled_at: null }));
    must(await db.from("calendar_events").upsert(rows, { onConflict: "calendar_id,event_key" }));
  }

  const seen = new Set(events.map((event) => event.event_key));
  const newDays = new Set(events.map((event) => `${event.uid}|${dayKey(event.starts_at, event.all_day)}`));
  const gone = active.filter((row) => !seen.has(row.event_key));
  // Changing a whole series gives its events new keys. On the same day that's a move, not a cancellation.
  const moved = gone.filter((row) => newDays.has(`${row.uid}|${dayKey(row.starts_at, false)}`)).map((row) => row.id);
  const cancelled = gone.map((row) => row.id).filter((id) => !moved.includes(id));
  if (moved.length) must(await db.from("calendar_events").delete().in("id", moved));
  if (cancelled.length) {
    must(await db.from("calendar_events").update({ cancelled_at: now.toISOString() }).in("id", cancelled));
  }
}

async function syncOne(db: SupabaseClient, calendarId: string, encryptedUrl: string, key: string, now: Date, fetchImpl: FetchLike) {
  try {
    const feed = await readFeed(decryptToken(encryptedUrl, key), now, fetchImpl);
    await applyEvents(db, calendarId, feed.events, now);
    await db.from("calendars").update({ last_synced_at: now.toISOString(), last_error: null }).eq("id", calendarId);
    return true;
  } catch (error) {
    const code = error instanceof FeedError ? error.code : "feed_unavailable";
    await db.from("calendars").update({ last_error: code }).eq("id", calendarId);
    return false;
  }
}

/**
 * Reads a batch's calendars. Without `force`, only those not tried in the last 10 minutes, and each is
 * claimed first so that many visitors opening the page at once cause one read. Returns whether anything was read.
 */
export async function refreshBatchCalendars(
  db: SupabaseClient,
  batchId: string,
  options: { key: string; force?: boolean; now?: Date; fetchImpl?: FetchLike },
): Promise<boolean> {
  const now = options.now ?? new Date();
  const { data, error } = await db
    .from("calendars")
    .select("id, calendar_sources(encrypted_url)")
    .eq("batch_id", batchId);
  if (error) throw new FeedError("database_error");

  const staleBefore = new Date(now.getTime() - REFRESH_AFTER_MS).toISOString();
  const results = await Promise.all(
    ((data ?? []) as unknown as { id: string; calendar_sources: { encrypted_url: string } | null }[]).map(async (calendar) => {
      if (!calendar.calendar_sources) return false;
      let claim = db.from("calendars").update({ last_attempt_at: now.toISOString() }).eq("id", calendar.id);
      if (!options.force) claim = claim.or(`last_attempt_at.is.null,last_attempt_at.lt.${staleBefore}`);
      const claimed = await claim.select("id");
      if (claimed.error) throw new FeedError("database_error");
      if (!claimed.data.length) return false;
      await syncOne(db, calendar.id, calendar.calendar_sources.encrypted_url, options.key, now, options.fetchImpl ?? fetch);
      return true;
    }),
  );
  return results.some(Boolean);
}

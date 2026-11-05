import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { refreshBatchCalendars } from "@/lib/calendar/sync";
import { encryptToken } from "@/lib/sync/crypto";

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
    throw new Error("Calendar tests only run against the local Supabase stack");
  }
  return { url: env.API_URL, serviceKey: env.SECRET_KEY ?? env.SERVICE_ROLE_KEY };
}

const env = localEnv();
const db = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const key = randomBytes(32).toString("base64");
const SECRET_URL = "https://calendar.google.com/calendar/ical/a/private-secret/basic.ics";
const NOW = new Date("2026-11-05T12:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

const vevent = (uid: string, start: string, title = "Daily") =>
  ["BEGIN:VEVENT", `UID:${uid}`, "DTSTAMP:20261101T000000Z", `DTSTART:${start}`, `DTEND:${start}`, `SUMMARY:${title}`, "END:VEVENT"].join("\r\n");
const feed = (...events: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const serving = (body: string, status = 200) => (async () => new Response(body, { status })) as typeof fetch;

describe("refreshBatchCalendars", () => {
  let batchId: string;
  let calendarId: string;

  const rows = async () => {
    const { data } = await db
      .from("calendar_events")
      .select("uid, title, starts_at, cancelled_at")
      .eq("calendar_id", calendarId)
      .order("starts_at");
    return data ?? [];
  };
  const calendar = async () => (await db.from("calendars").select("last_synced_at, last_error").eq("id", calendarId).single()).data;
  const refresh = (body: string, minutes = 0, status = 200, force = true) =>
    refreshBatchCalendars(db, batchId, { key, force, now: later(minutes), fetchImpl: serving(body, status) });

  beforeEach(async () => {
    const id = randomUUID().slice(0, 8);
    const batch = await db.from("batches").insert({ name: `Calendar ${id}`, slug: `cal-${id}` }).select("id").single();
    batchId = batch.data!.id;
    const created = await db.from("calendars").insert({ batch_id: batchId, title: "Kohorte 1", is_cohort: true }).select("id").single();
    calendarId = created.data!.id;
    await db.from("calendar_sources").insert({ calendar_id: calendarId, encrypted_url: encryptToken(SECRET_URL, key) });
  });

  it("imports events and repeats without duplicates", async () => {
    const body = feed(vevent("a", "20261110T090000Z"), vevent("b", "20261111T090000Z"));
    expect(await refresh(body)).toBe(true);
    await refresh(body, 20);
    expect(await rows()).toHaveLength(2);
    expect((await calendar())?.last_error).toBeNull();
  });

  it("marks a future event that left the feed as cancelled, and clears the mark if it returns", async () => {
    await refresh(feed(vevent("a", "20261110T090000Z"), vevent("b", "20261111T090000Z")));
    await refresh(feed(vevent("a", "20261110T090000Z")), 20);
    const after = await rows();
    expect(after.find((row) => row.uid === "a")?.cancelled_at).toBeNull();
    expect(after.find((row) => row.uid === "b")?.cancelled_at).not.toBeNull();

    await refresh(feed(vevent("a", "20261110T090000Z"), vevent("b", "20261111T090000Z")), 40);
    expect((await rows()).every((row) => row.cancelled_at === null)).toBe(true);
  });

  it("treats a series moved within the day as a move, not a cancellation", async () => {
    const series = (time: string) =>
      feed(["BEGIN:VEVENT", "UID:s", "DTSTAMP:20261101T000000Z", `DTSTART:20261110T${time}Z`, `DTEND:20261110T${time}Z`, "RRULE:FREQ=DAILY;COUNT=1", "SUMMARY:Daily", "END:VEVENT"].join("\r\n"));
    await refresh(series("090000"));
    await refresh(series("100000"), 20);
    const after = await rows();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ cancelled_at: null, starts_at: "2026-11-10T10:00:00+00:00" });
  });

  it("keeps past events that have left the feed unmarked", async () => {
    await db.from("calendar_events").insert({
      calendar_id: calendarId,
      event_key: "past",
      uid: "past",
      title: "Past",
      starts_at: "2026-11-01T09:00:00Z",
      ends_at: "2026-11-01T10:00:00Z",
    });
    await refresh(feed(vevent("a", "20261110T090000Z")));
    expect((await rows()).find((row) => row.uid === "past")?.cancelled_at).toBeNull();
  });

  it("keeps stored events and records a code without the address when reading fails", async () => {
    await refresh(feed(vevent("a", "20261110T090000Z")));
    const before = (await calendar())?.last_synced_at;

    await refresh("nope", 20, 404);
    expect(await calendar()).toMatchObject({ last_error: "feed_denied", last_synced_at: before });

    await refresh("<html>not a calendar</html>", 40);
    expect((await calendar())?.last_error).toBe("feed_invalid");

    await refresh(feed(), 60);
    expect((await calendar())?.last_error).toBe("feed_empty");

    const after = await rows();
    expect(after).toHaveLength(1);
    expect(after[0].cancelled_at).toBeNull();
    expect(JSON.stringify(await calendar())).not.toContain("private-secret");
  });

  it("reads only once within ten minutes unless forced", async () => {
    let reads = 0;
    const fetchImpl = (async () => {
      reads += 1;
      return new Response(feed(vevent("a", "20261110T090000Z")));
    }) as typeof fetch;
    const run = (minutes: number, force = false) => refreshBatchCalendars(db, batchId, { key, force, now: later(minutes), fetchImpl });

    expect(await run(0)).toBe(true);
    expect(await run(5)).toBe(false);
    expect(reads).toBe(1);
    expect(await run(11)).toBe(true);
    expect(await run(12, true)).toBe(true);
    expect(reads).toBe(3);
  });
});

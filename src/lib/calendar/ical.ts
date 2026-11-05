import ICAL from "ical.js";

export type ParsedEvent = {
  event_key: string;
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
};

export type ParsedCalendar = { name: string | null; events: ParsedEvent[] };

const MAX_OCCURRENCES = 5000;
const MEETING_HOSTS = /https:\/\/(?:meet\.google\.com|[\w.-]*zoom\.us|teams\.microsoft\.com|teams\.live\.com|app\.gather\.town)\/[^\s<>"')]+/i;

/** Accepts only Google Calendar's iCal addresses, so the server never fetches an address someone made up. */
export function parseIcalUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const valid = url.protocol === "https:" && url.hostname === "calendar.google.com" && !url.port && !url.username && !url.password;
    return valid && /^\/calendar\/ical\/[^/]+\/[^/]+\/basic\.ics$/.test(url.pathname) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "AI Software Engineering · Batch 10/26 · Kohorte 1" becomes "Kohorte 1". */
export function shortCalendarName(name: string): string {
  return name.split("·").pop()?.trim() || name.trim();
}

export function isCohortName(name: string): boolean {
  return /\b(kohorte|cohort)\b/i.test(name);
}

/** Calendar descriptions can hold HTML. This keeps the words and link addresses as plain text. */
export function cleanDescription(raw: string | null): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const words = label.replace(/<[^>]+>/g, "").trim();
      return !words || words === href || /^https?:\/\//i.test(words) ? href : `${words}: ${href}`;
    })
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

function findMeetingUrl(event: ICAL.Event, description: string | null): string | null {
  const conference = event.component.getFirstPropertyValue("x-google-conference");
  if (typeof conference === "string" && conference.startsWith("https://")) return conference;
  return `${description ?? ""} ${event.location ?? ""}`.match(MEETING_HOSTS)?.[0] ?? null;
}

function toIso(time: ICAL.Time): string {
  // All-day events have no time zone. Midnight UTC keeps their date the same everywhere.
  return time.isDate ? `${time.toString()}T00:00:00.000Z` : time.toJSDate().toISOString();
}

function toParsed(event: ICAL.Event, key: string, start: ICAL.Time, end: ICAL.Time): ParsedEvent | null {
  if (String(event.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") return null;
  const description = cleanDescription(event.description ?? null);
  return {
    event_key: key,
    uid: event.uid,
    title: event.summary?.trim() || "(ohne Titel)",
    description,
    location: event.location?.trim() || null,
    meeting_url: findMeetingUrl(event, description),
    starts_at: toIso(start),
    ends_at: toIso(end),
    all_day: start.isDate,
  };
}

/** Reads a feed and lists each event between the two dates, with repeating events written out one by one. */
export function parseIcal(text: string, window: { from: Date; to: Date }): ParsedCalendar {
  const root = new ICAL.Component(ICAL.parse(text));
  root.getAllSubcomponents("vtimezone").forEach((zone) => ICAL.TimezoneService.register(zone));

  const from = window.from.getTime();
  const to = window.to.getTime();
  const inWindow = (time: ICAL.Time) => {
    const at = time.toJSDate().getTime();
    return at >= from && at <= to;
  };

  const all = root.getAllSubcomponents("vevent").map((component) => new ICAL.Event(component));
  const exceptions = all.filter((event) => event.isRecurrenceException());
  const masters = all.filter((event) => !event.isRecurrenceException());
  const masterUids = new Set(masters.map((event) => event.uid));
  masters.forEach((master) => {
    exceptions.filter((event) => event.uid === master.uid).forEach((event) => master.relateException(event));
  });

  const events: ParsedEvent[] = [];
  const add = (event: ParsedEvent | null) => {
    if (event) events.push(event);
  };

  for (const master of masters) {
    if (!master.isRecurring()) {
      if (inWindow(master.startDate)) add(toParsed(master, master.uid, master.startDate, master.endDate));
      continue;
    }
    const iterator = master.iterator();
    for (let count = 0, next = iterator.next(); next && count < MAX_OCCURRENCES; count += 1, next = iterator.next()) {
      if (next.toJSDate().getTime() > to + 30 * 24 * 60 * 60 * 1000) break;
      const details = master.getOccurrenceDetails(next);
      if (inWindow(details.startDate)) {
        add(toParsed(details.item, `${master.uid}|${toIso(details.recurrenceId)}`, details.startDate, details.endDate));
      }
    }
  }
  // A changed single occurrence whose series isn't in the feed still counts as an event.
  for (const event of exceptions) {
    if (!masterUids.has(event.uid) && inWindow(event.startDate)) {
      add(toParsed(event, `${event.uid}|${toIso(event.recurrenceId)}`, event.startDate, event.endDate));
    }
  }

  const name = root.getFirstPropertyValue("x-wr-calname");
  return { name: typeof name === "string" && name.trim() ? name.trim() : null, events };
}

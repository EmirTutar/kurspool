export type CalendarViewName = "month" | "week" | "day";

export type CalendarInfo = { id: string; title: string; is_cohort: boolean };

export type CalendarEvent = {
  id: string;
  calendar_id: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  cancelled_at: string | null;
};

export type EventGroup = { key: string; label: string; kind: "calendar" | "deadline" | "title" };

const DAY_MS = 24 * 60 * 60 * 1000;
const ZONE = "Europe/Berlin";
const berlinParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(iso: string) {
  const found = Object.fromEntries(berlinParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return { day: `${found.year}-${found.month}-${found.day}`, minutes: Number(found.hour) * 60 + Number(found.minute) };
}

const fromKey = (key: string) => new Date(`${key}T00:00:00.000Z`);
const toKey = (date: Date) => date.toISOString().slice(0, 10);

/** The calendar day an instant falls on in Berlin. All-day events are stored at midnight UTC, so they use that date. */
export function dayKey(iso: string, allDay: boolean): string {
  return allDay ? iso.slice(0, 10) : parts(iso).day;
}

export function minutesIntoDay(iso: string): number {
  return parts(iso).minutes;
}

export function addDays(key: string, amount: number): string {
  return toKey(new Date(fromKey(key).getTime() + amount * DAY_MS));
}

/** Monday to Sunday around the given day. */
export function weekDays(key: string): string[] {
  const mondayOffset = (fromKey(key).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, index) => addDays(key, index - mondayOffset));
}

/** Whole weeks covering the month, so every row of the grid has seven days. */
export function monthDays(key: string): string[] {
  const first = `${key.slice(0, 7)}-01`;
  const start = weekDays(first)[0];
  const next = fromKey(first);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const count = Math.ceil((next.getTime() - fromKey(start).getTime()) / DAY_MS / 7) * 7;
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function shiftDate(key: string, view: CalendarViewName, direction: 1 | -1): string {
  if (view === "day") return addDays(key, direction);
  if (view === "week") return addDays(key, 7 * direction);
  const date = fromKey(`${key.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + direction);
  return toKey(date);
}

/** Which days an event appears on. An all-day event's end date is exclusive, as in iCal. */
export function eventDays(event: Pick<CalendarEvent, "starts_at" | "ends_at" | "all_day">): string[] {
  const first = dayKey(event.starts_at, event.all_day);
  if (!event.all_day) return [first];
  const days = [first];
  const end = event.ends_at.slice(0, 10);
  for (let next = addDays(first, 1); next < end && days.length < 60; next = addDays(next, 1)) days.push(next);
  return days;
}

/** The filter an event belongs to. Cohort calendars repeat the same titles, so those group by title. */
export function eventGroup(calendar: CalendarInfo | undefined, title: string): EventGroup {
  if (/^\s*(abgabe|deadline|submission)\b/i.test(title)) return { key: "deadlines", label: "", kind: "deadline" };
  if (calendar && !calendar.is_cohort) return { key: `calendar:${calendar.id}`, label: calendar.title, kind: "calendar" };
  const label = title.trim();
  return { key: `title:${label.toLowerCase()}`, label, kind: "title" };
}

/** Lists each filter once: whole calendars, then deadlines, then titles alphabetically. */
export function listGroups(events: Pick<CalendarEvent, "calendar_id" | "title">[], calendars: CalendarInfo[]): EventGroup[] {
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const groups = new Map<string, EventGroup>();
  for (const event of events) {
    const group = eventGroup(byId.get(event.calendar_id), event.title);
    if (!groups.has(group.key)) groups.set(group.key, group);
  }
  const rank = { calendar: 0, deadline: 1, title: 2 };
  return [...groups.values()].sort((a, b) => rank[a.kind] - rank[b.kind] || a.label.localeCompare(b.label));
}

export function visibleEvents<T extends Pick<CalendarEvent, "calendar_id" | "title">>(
  events: T[],
  calendars: CalendarInfo[],
  cohortIds: string[],
  hiddenGroups: string[],
): T[] {
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  return events.filter((event) => {
    const calendar = byId.get(event.calendar_id);
    if (calendar?.is_cohort && !cohortIds.includes(calendar.id)) return false;
    return !hiddenGroups.includes(eventGroup(calendar, event.title).key);
  });
}

/** Office hours by default, stretched for events outside them and for the current time. */
export function visibleHours(events: Pick<CalendarEvent, "starts_at" | "ends_at">[], nowMinutes: number | null): number[] {
  const ends = events.map((event) => minutesIntoDay(event.starts_at) + (new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60_000);
  const starts = events.map((event) => minutesIntoDay(event.starts_at));
  if (nowMinutes !== null) {
    starts.push(nowMinutes);
    ends.push(nowMinutes + 1);
  }
  const first = Math.min(8, ...starts.map((minutes) => Math.floor(minutes / 60)));
  const last = Math.min(24, Math.max(19, ...ends.map((minutes) => Math.ceil(minutes / 60))));
  return Array.from({ length: last - first }, (_, index) => first + index);
}

/** What's running now and the next two after it. Cancelled events count as neither, and all-day events only as coming up. */
export function currentAndNext<T extends Pick<CalendarEvent, "starts_at" | "ends_at" | "all_day" | "cancelled_at">>(
  events: T[],
  now: Date,
): { current: T | null; next: T[] } {
  const at = now.getTime();
  const today = dayKey(now.toISOString(), false);
  const active = events
    .filter((event) => !event.cancelled_at)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const running = active.filter(
    (event) => !event.all_day && new Date(event.starts_at).getTime() <= at && new Date(event.ends_at).getTime() > at,
  );
  const next = active.filter((event) => (event.all_day ? dayKey(event.starts_at, true) > today : new Date(event.starts_at).getTime() > at));
  return { current: running.at(-1) ?? null, next: next.slice(0, 2) };
}

export type PlacedEvent<T> = { event: T; start: number; end: number; column: number; columns: number };

/** Places a day's timed events side by side where they overlap. */
export function placeEvents<T extends Pick<CalendarEvent, "starts_at" | "ends_at">>(events: T[]): PlacedEvent<T>[] {
  const items = events
    .map((event) => {
      const start = minutesIntoDay(event.starts_at);
      const sameDay = dayKey(event.ends_at, false) === dayKey(event.starts_at, false);
      return { event, start, end: sameDay ? Math.max(minutesIntoDay(event.ends_at), start + 15) : 24 * 60, column: 0, columns: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  let cluster: typeof items = [];
  let clusterEnd = -1;
  const close = () => {
    const columns = Math.max(0, ...cluster.map((item) => item.column)) + 1;
    cluster.forEach((item) => {
      item.columns = columns;
    });
    cluster = [];
  };
  for (const item of items) {
    if (item.start >= clusterEnd) {
      close();
      clusterEnd = -1;
    }
    const taken = new Set(cluster.filter((other) => other.end > item.start).map((other) => other.column));
    while (taken.has(item.column)) item.column += 1;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  close();
  return items;
}

/** Splits text so that web addresses can be shown as links. Nothing else in the text can become a link. */
export function splitLinks(text: string): { text: string; href?: string }[] {
  const pieces: { text: string; href?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    const href = match[0].replace(/[.,;:!?)\]]+$/, "");
    if (match.index > last) pieces.push({ text: text.slice(last, match.index) });
    pieces.push({ text: href, href });
    last = match.index + href.length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last) });
  return pieces;
}

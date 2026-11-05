import { describe, expect, it } from "vitest";
import { cleanDescription, isCohortName, parseIcal, parseIcalUrl, shortCalendarName } from "@/lib/calendar/ical";
import {
  dayKey,
  eventDays,
  eventGroup,
  listGroups,
  monthDays,
  placeEvents,
  shiftDate,
  splitLinks,
  visibleEvents,
  weekDays,
} from "@/lib/calendar/view";

const lines = (...parts: string[]) => parts.join("\r\n");
const ZONE = lines(
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
);
const feed = (...events: string[]) =>
  lines("BEGIN:VCALENDAR", "VERSION:2.0", "X-WR-CALNAME:Kurs · Batch · Kohorte 1", ZONE, ...events, "END:VCALENDAR");
const event = (...parts: string[]) => lines("BEGIN:VEVENT", "DTSTAMP:20261101T000000Z", ...parts, "END:VEVENT");
const WINDOW = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2027-03-01T00:00:00Z") };

describe("parseIcal", () => {
  it("reads the calendar's name and a single event with its meeting link", () => {
    const parsed = parseIcal(
      feed(
        event(
          "UID:one",
          "DTSTART;TZID=Europe/Berlin:20261109T180000",
          "DTEND;TZID=Europe/Berlin:20261109T210000",
          "SUMMARY:Foundations",
          "LOCATION:Online",
          "DESCRIPTION:Trainer: A\\nGoogle Meet: https://meet.google.com/abc-defg-hij",
        ),
      ),
      WINDOW,
    );
    expect(parsed.name).toBe("Kurs · Batch · Kohorte 1");
    expect(parsed.events).toEqual([
      {
        event_key: "one",
        uid: "one",
        title: "Foundations",
        description: "Trainer: A\nGoogle Meet: https://meet.google.com/abc-defg-hij",
        location: "Online",
        meeting_url: "https://meet.google.com/abc-defg-hij",
        starts_at: "2026-11-09T17:00:00.000Z",
        ends_at: "2026-11-09T20:00:00.000Z",
        all_day: false,
      },
    ]);
  });

  it("writes out a series, skips removed dates and cancelled ones, and applies a moved occurrence", () => {
    const parsed = parseIcal(
      feed(
        event(
          "UID:daily",
          "DTSTART;TZID=Europe/Berlin:20261102T100000",
          "DTEND;TZID=Europe/Berlin:20261102T102000",
          "RRULE:FREQ=DAILY;COUNT=5",
          "EXDATE;TZID=Europe/Berlin:20261103T100000",
          "SUMMARY:Daily",
        ),
        event(
          "UID:daily",
          "RECURRENCE-ID;TZID=Europe/Berlin:20261104T100000",
          "DTSTART;TZID=Europe/Berlin:20261104T120000",
          "DTEND;TZID=Europe/Berlin:20261104T122000",
          "SUMMARY:Daily (moved)",
        ),
        event(
          "UID:daily",
          "RECURRENCE-ID;TZID=Europe/Berlin:20261105T100000",
          "DTSTART;TZID=Europe/Berlin:20261105T100000",
          "DTEND;TZID=Europe/Berlin:20261105T102000",
          "STATUS:CANCELLED",
          "SUMMARY:Daily",
        ),
      ),
      WINDOW,
    );
    expect(parsed.events.map((row) => [row.title, row.starts_at])).toEqual([
      ["Daily", "2026-11-02T09:00:00.000Z"],
      ["Daily (moved)", "2026-11-04T11:00:00.000Z"],
      ["Daily", "2026-11-06T09:00:00.000Z"],
    ]);
    // The key follows the original date, so a moved occurrence updates its stored row.
    expect(parsed.events[1].event_key).toBe("daily|2026-11-04T09:00:00.000Z");
  });

  it("keeps the local time across a clock change", () => {
    const parsed = parseIcal(
      feed(
        event(
          "UID:weekly",
          "DTSTART;TZID=Europe/Berlin:20261020T100000",
          "DTEND;TZID=Europe/Berlin:20261020T110000",
          "RRULE:FREQ=WEEKLY;COUNT=2",
          "SUMMARY:Weekly",
        ),
      ),
      WINDOW,
    );
    expect(parsed.events.map((row) => row.starts_at)).toEqual(["2026-10-20T08:00:00.000Z", "2026-10-27T09:00:00.000Z"]);
  });

  it("keeps an all-day event's date and leaves out events outside the window", () => {
    const parsed = parseIcal(
      feed(
        event("UID:due", "DTSTART;VALUE=DATE:20261119", "DTEND;VALUE=DATE:20261120", "SUMMARY:Abgabe Modul 1"),
        event("UID:old", "DTSTART;VALUE=DATE:20200101", "DTEND;VALUE=DATE:20200102", "SUMMARY:Old"),
      ),
      WINDOW,
    );
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]).toMatchObject({ all_day: true, starts_at: "2026-11-19T00:00:00.000Z", ends_at: "2026-11-20T00:00:00.000Z" });
  });

  it("prefers the event's own conference link", () => {
    const parsed = parseIcal(
      feed(
        event(
          "UID:c",
          "DTSTART;TZID=Europe/Berlin:20261109T180000",
          "DTEND;TZID=Europe/Berlin:20261109T190000",
          "X-GOOGLE-CONFERENCE:https://meet.google.com/own-link",
          "DESCRIPTION:See https://zoom.us/j/1",
          "SUMMARY:Call",
        ),
      ),
      WINDOW,
    );
    expect(parsed.events[0].meeting_url).toBe("https://meet.google.com/own-link");
  });

  it("rejects text that isn't a calendar", () => {
    expect(() => parseIcal("<html>Sign in</html>", WINDOW)).toThrow();
  });
});

describe("calendar addresses and names", () => {
  it("accepts only Google's iCal addresses", () => {
    const good = "https://calendar.google.com/calendar/ical/c_1%40group.calendar.google.com/private-abc/basic.ics";
    expect(parseIcalUrl(` ${good} `)).toBe(good);
    expect(parseIcalUrl("https://calendar.google.com/calendar/u/1?cid=abc")).toBeNull();
    expect(parseIcalUrl("http://calendar.google.com/calendar/ical/a/b/basic.ics")).toBeNull();
    expect(parseIcalUrl("https://calendar.google.com.evil.test/calendar/ical/a/b/basic.ics")).toBeNull();
    expect(parseIcalUrl("https://user@calendar.google.com/calendar/ical/a/b/basic.ics")).toBeNull();
    expect(parseIcalUrl("not a url")).toBeNull();
  });

  it("shortens names and recognizes cohorts", () => {
    expect(shortCalendarName("AI Software Engineering · Batch 10/26 · Kohorte 2")).toBe("Kohorte 2");
    expect(shortCalendarName("Sessions")).toBe("Sessions");
    expect(isCohortName("Kohorte 2")).toBe(true);
    expect(isCohortName("Sessions")).toBe(false);
  });

  it("turns HTML descriptions into plain text and keeps link addresses", () => {
    expect(cleanDescription('Trainer: A<br><a href="https://meet.google.com/x">Join</a> &amp; go<script>bad</script>')).toBe(
      "Trainer: A\nJoin: https://meet.google.com/x & gobad",
    );
    expect(cleanDescription('<a href="https://a.test">https://a.test</a>')).toBe("https://a.test");
    expect(cleanDescription("<p></p>")).toBeNull();
    expect(cleanDescription(null)).toBeNull();
  });
});

describe("calendar dates", () => {
  it("uses the Berlin day for timed events and the stored date for all-day ones", () => {
    expect(dayKey("2026-11-09T23:30:00.000Z", false)).toBe("2026-11-10");
    expect(dayKey("2026-11-19T00:00:00.000Z", true)).toBe("2026-11-19");
  });

  it("builds Monday-first weeks and whole-week months", () => {
    expect(weekDays("2026-11-05")[0]).toBe("2026-11-02");
    expect(weekDays("2026-11-08")[6]).toBe("2026-11-08");
    const month = monthDays("2026-11-05");
    expect(month[0]).toBe("2026-10-26");
    expect(month.at(-1)).toBe("2026-12-06");
    expect(month.length % 7).toBe(0);
  });

  it("moves by the chosen view", () => {
    expect(shiftDate("2026-11-05", "day", 1)).toBe("2026-11-06");
    expect(shiftDate("2026-11-05", "week", -1)).toBe("2026-10-29");
    expect(shiftDate("2026-01-31", "month", 1)).toBe("2026-02-01");
  });

  it("shows an all-day event on each of its days", () => {
    const days = eventDays({ starts_at: "2026-11-19T00:00:00.000Z", ends_at: "2026-11-21T00:00:00.000Z", all_day: true });
    expect(days).toEqual(["2026-11-19", "2026-11-20"]);
  });

  it("places overlapping events side by side and separate ones alone", () => {
    const at = (start: string, end: string) => ({ starts_at: `2026-11-09T${start}:00.000Z`, ends_at: `2026-11-09T${end}:00.000Z` });
    const placed = placeEvents([at("09:00", "10:00"), at("09:30", "10:30"), at("12:00", "13:00")]);
    expect(placed.map((row) => [row.column, row.columns])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });
});

describe("calendar filters", () => {
  const cohort = { id: "c1", title: "Kohorte 1", is_cohort: true };
  const other = { id: "c2", title: "Kohorte 2", is_cohort: true };
  const sessions = { id: "s", title: "Sessions", is_cohort: false };
  const calendars = [cohort, other, sessions];
  const events = [
    { calendar_id: "c1", title: "Daily" },
    { calendar_id: "c2", title: "Daily" },
    { calendar_id: "c1", title: "Lean Coffee" },
    { calendar_id: "c1", title: "Abgabe Modul 1" },
    { calendar_id: "s", title: "Foundations" },
    { calendar_id: "s", title: "Prompting" },
  ];

  it("groups events into one filter each, from the events themselves", () => {
    expect(listGroups(events, calendars).map((group) => group.key)).toEqual([
      "calendar:s",
      "deadlines",
      "title:daily",
      "title:lean coffee",
    ]);
    expect(eventGroup(sessions, "Abgabe Projekt").key).toBe("deadlines");
  });

  it("hides cohorts until ticked and honors unticked filters", () => {
    const titles = (cohorts: string[], hidden: string[]) =>
      visibleEvents(events, calendars, cohorts, hidden).map((event) => `${event.calendar_id}:${event.title}`);
    expect(titles([], [])).toEqual(["s:Foundations", "s:Prompting"]);
    expect(titles(["c1"], ["title:lean coffee", "calendar:s"])).toEqual(["c1:Daily", "c1:Abgabe Modul 1"]);
    expect(titles(["c2"], ["calendar:s"])).toEqual(["c2:Daily"]);
  });
});

describe("splitLinks", () => {
  it("links only web addresses and leaves closing punctuation out", () => {
    expect(splitLinks("Join https://meet.google.com/x. Or javascript:alert(1)")).toEqual([
      { text: "Join " },
      { text: "https://meet.google.com/x", href: "https://meet.google.com/x" },
      { text: ". Or javascript:alert(1)" },
    ]);
  });
});

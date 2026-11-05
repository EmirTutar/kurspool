import type { Locale } from "@/lib/i18n";
import type { CalendarEvent } from "./view";

const tag = (locale: Locale) => (locale === "de" ? "de-DE" : "en-GB");

/** Formats a calendar day. Noon UTC keeps the date the same whatever the viewer's time zone. */
export function dayFormat(locale: Locale, key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(tag(locale), { ...options, timeZone: "UTC" }).format(new Date(`${key}T12:00:00.000Z`));
}

export function timeOf(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(tag(locale), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
}

export function timeRange(locale: Locale, event: Pick<CalendarEvent, "starts_at" | "ends_at" | "all_day">, allDay: string): string {
  return event.all_day ? allDay : `${timeOf(locale, event.starts_at)} – ${timeOf(locale, event.ends_at)}`;
}

import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarRefresh } from "@/components/kurspool/calendar-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dayFormat, timeRange } from "@/lib/calendar/format";
import { currentAndNext, dayKey, visibleEvents, type CalendarEvent, type CalendarInfo } from "@/lib/calendar/view";
import { dictionaries, fill, type Locale } from "@/lib/i18n";
import { getMembership } from "@/lib/membership";

type Membership = NonNullable<Awaited<ReturnType<typeof getMembership>>>;

const LOOK_AHEAD = 500;

function EventCard({ badge, event, locale, today }: { badge: ReactNode; event: CalendarEvent; locale: Locale; today: string }) {
  const t = dictionaries[locale].calendar;
  const day = dayKey(event.starts_at, event.all_day);
  const when = day === today ? t.todayAt : dayFormat(locale, day, { weekday: "short", day: "numeric", month: "short" });

  return (
    <Link
      href={`/calendar?event=${event.id}`}
      aria-label={fill(t.openAt, { title: event.title })}
      className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card size="sm" className="h-full transition-[box-shadow,transform] duration-200 group-hover:shadow-md group-active:scale-[0.99] motion-reduce:transition-none motion-reduce:group-active:scale-100">
        <CardHeader>
          <div>{badge}</div>
          <CardTitle className="mt-1 break-words">{event.title}</CardTitle>
          <CardDescription>
            {when}, {timeRange(locale, event, t.allDay)}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

function EmptyCard({ badge, text }: { badge: ReactNode; text: string }) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <div>{badge}</div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

/** What's running and what's next, by this person's own calendar choices. Hidden while a batch has no calendars. */
export async function UpcomingEvents({ membership, locale, now }: { membership: Membership; locale: Locale; now: Date }) {
  const { supabase, user } = membership;
  const t = dictionaries[locale].calendar;

  const [calendarRows, choices, eventRows] = await Promise.all([
    supabase.from("calendars").select("id, title, is_cohort"),
    supabase.from("calendar_preferences").select("cohort_ids, hidden_groups").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("calendar_events")
      .select("id, calendar_id, title, description, location, meeting_url, starts_at, ends_at, all_day, cancelled_at")
      .gt("ends_at", now.toISOString())
      .is("cancelled_at", null)
      .order("starts_at")
      .limit(LOOK_AHEAD),
  ]);

  const calendars = (calendarRows.data ?? []) as CalendarInfo[];
  if (!calendars.length) return null;

  const cohortIds = (choices.data?.cohort_ids as string[] | undefined) ?? [];
  const hiddenGroups = (choices.data?.hidden_groups as string[] | undefined) ?? [];
  const shown = visibleEvents((eventRows.data ?? []) as CalendarEvent[], calendars, cohortIds, hiddenGroups);
  const { current, next } = currentAndNext(shown, now);
  const today = dayKey(now.toISOString(), false);
  const cohortMissing = calendars.some((calendar) => calendar.is_cohort) && !calendars.some((calendar) => calendar.is_cohort && cohortIds.includes(calendar.id));

  const nowBadge = (
    <Badge variant={current ? "default" : "secondary"}>
      {current && <span aria-hidden className="size-1.5 rounded-full bg-blue-400 motion-safe:animate-pulse" />}
      {t.nowLabel}
    </Badge>
  );
  const nextBadge = <Badge variant="secondary">{t.nextLabel}</Badge>;

  return (
    <section aria-labelledby="upcoming-heading">
      <CalendarRefresh />
      <h2 id="upcoming-heading" className="font-heading text-lg font-bold text-primary">
        {t.title}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {current ? <EventCard badge={nowBadge} event={current} locale={locale} today={today} /> : <EmptyCard badge={nowBadge} text={t.nothingNow} />}
        {next ? <EventCard badge={nextBadge} event={next} locale={locale} today={today} /> : <EmptyCard badge={nextBadge} text={t.nothingNext} />}
      </div>
      {cohortMissing && <p className="mt-2 text-xs text-muted-foreground">{t.pickCohortHint}</p>}
    </section>
  );
}

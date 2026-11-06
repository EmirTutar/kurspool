import { CalendarRefresh } from "@/components/kurspool/calendar-refresh";
import { UpcomingCards, type UpcomingSlot } from "@/components/kurspool/upcoming-cards";
import { currentAndNext, dayKey, visibleEvents, type CalendarEvent, type CalendarInfo } from "@/lib/calendar/view";
import { dictionaries, type Locale } from "@/lib/i18n";
import { getMembership } from "@/lib/membership";

type Membership = NonNullable<Awaited<ReturnType<typeof getMembership>>>;

const LOOK_AHEAD = 500;

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
  // With nothing running, the second card shows the one after next instead of an empty "now".
  const slots: UpcomingSlot[] = current
    ? [
        { label: "now", event: current },
        { label: "next", event: next[0] ?? null },
      ]
    : [
        { label: "next", event: next[0] ?? null },
        { label: "afterNext", event: next[1] ?? null },
      ];
  const cohortMissing = calendars.some((calendar) => calendar.is_cohort) && !calendars.some((calendar) => calendar.is_cohort && cohortIds.includes(calendar.id));

  return (
    <section aria-labelledby="upcoming-heading">
      <CalendarRefresh />
      <h2 id="upcoming-heading" className="font-heading text-lg font-bold text-primary">
        {t.title}
      </h2>
      <UpcomingCards slots={slots} calendars={calendars} locale={locale} today={dayKey(now.toISOString(), false)} />
      {cohortMissing && <p className="mt-2 text-xs text-muted-foreground">{t.pickCohortHint}</p>}
    </section>
  );
}

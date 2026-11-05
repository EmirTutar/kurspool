import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarPage as CalendarScreen } from "@/components/kurspool/calendar-page";
import { CalendarSkeleton } from "@/components/kurspool/skeletons";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";
import { dayKey, type CalendarEvent, type CalendarInfo, type CalendarViewName } from "@/lib/calendar/view";

export const metadata: Metadata = { title: "Kurspool" };

const PAGE_SIZE = 1000;

async function CalendarContent() {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { supabase, user } = membership;
  const { locale } = await getDictionary();

  const [calendars, choices] = await Promise.all([
    supabase.from("calendars").select("id, title, is_cohort, last_synced_at").order("title"),
    supabase.from("calendar_preferences").select("cohort_ids, hidden_groups, view").eq("user_id", user.id).maybeSingle(),
  ]);

  // Supabase returns at most 1000 rows per request, and a course can have more events than that.
  const events: CalendarEvent[] = [];
  for (let page = 0; ; page += 1) {
    const { data } = await supabase
      .from("calendar_events")
      .select("id, calendar_id, title, description, location, meeting_url, starts_at, ends_at, all_day, cancelled_at")
      .order("starts_at")
      .order("id")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    events.push(...((data ?? []) as CalendarEvent[]));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  const rows = (calendars.data ?? []) as (CalendarInfo & { last_synced_at: string | null })[];
  const read = rows.map((row) => row.last_synced_at);
  // The oldest read, so the page never claims to be fresher than its stalest calendar.
  const updatedAt = read.length && read.every(Boolean) ? (read as string[]).sort()[0] : null;

  return (
    <CalendarScreen
      calendars={rows}
      events={events}
      initialCohortIds={(choices.data?.cohort_ids as string[] | undefined) ?? []}
      initialHiddenGroups={(choices.data?.hidden_groups as string[] | undefined) ?? []}
      initialView={(choices.data?.view as CalendarViewName | undefined) ?? "week"}
      locale={locale}
      today={dayKey(new Date().toISOString(), false)}
      updatedAt={updatedAt}
    />
  );
}

export default function CalendarRoute() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarContent />
    </Suspense>
  );
}

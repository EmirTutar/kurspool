"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { saveCalendarChoices } from "@/app/(dashboard)/actions";
import { CalendarRefresh } from "@/components/kurspool/calendar-refresh";
import { EventDetails } from "@/components/kurspool/event-details";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  dayKey,
  eventDays,
  eventGroup,
  listGroups,
  minutesIntoDay,
  monthDays,
  placeEvents,
  shiftDate,
  visibleEvents,
  visibleHours,
  weekDays,
  type CalendarEvent,
  type CalendarInfo,
  type CalendarViewName,
} from "@/lib/calendar/view";
import { dayFormat, timeOf, timeRange } from "@/lib/calendar/format";
import { dictionaries, fill, formatDate, type Locale } from "@/lib/i18n";
import { runAction } from "@/lib/run-action";

const HOUR_PX = 64;

function eventStyle(kind: "calendar" | "deadline" | "title", cancelled: boolean) {
  const color =
    kind === "deadline"
      ? "border-l-destructive bg-destructive/10 hover:bg-destructive/20 dark:hover:bg-destructive/25"
      : kind === "calendar"
        ? "border-l-primary bg-primary/15 hover:bg-primary/25 dark:hover:bg-primary/30"
        : "border-l-muted-foreground/50 bg-muted hover:bg-muted-foreground/20 dark:hover:bg-muted-foreground/25";
  const base =
    "h-auto rounded-sm border-0 border-l-2 font-normal text-foreground shadow-none animate-in fade-in-0 duration-200 hover:shadow-md hover:text-foreground active:scale-[0.98] motion-reduce:animate-none motion-reduce:active:scale-100";
  return `${base} ${color} ${cancelled ? "line-through opacity-60" : ""}`;
}

const SLIDE = {
  next: "slide-in-from-right-4",
  previous: "slide-in-from-left-4",
  none: "",
};

// The server can't know the viewer's moment, so the line appears once the page runs in the browser.
const subscribeToClock = (onChange: () => void) => {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
};
const useNow = () =>
  useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => null,
  );

export function CalendarPage({
  calendars,
  events,
  focusEvent,
  initialCohortIds,
  initialHiddenGroups,
  initialView,
  locale,
  today,
  updatedAt,
}: {
  calendars: CalendarInfo[];
  events: CalendarEvent[];
  /** Opened from the overview: start on this event's day and scroll to it. */
  focusEvent: CalendarEvent | null;
  initialCohortIds: string[];
  initialHiddenGroups: string[];
  initialView: CalendarViewName;
  locale: Locale;
  today: string;
  updatedAt: string | null;
}) {
  const t = dictionaries[locale].calendar;
  const [choices, setChoices] = useState({ cohortIds: initialCohortIds, hiddenGroups: initialHiddenGroups, view: initialView });
  const [date, setDate] = useState(focusEvent ? dayKey(focusEvent.starts_at, focusEvent.all_day) : today);
  // The month view has no times to land on. This switch is for this visit only, so the saved view stays.
  const [viewOverride, setViewOverride] = useState<CalendarViewName | null>(focusEvent && initialView === "month" ? "day" : null);
  const view = viewOverride ?? choices.view;
  const [slide, setSlide] = useState<keyof typeof SLIDE>("none");
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // On a phone the week is wider than the screen, so today's column (and the time line) is brought into view.
  useEffect(() => {
    if (focusEvent) return;
    const todayHeader = document.querySelector<HTMLElement>('main [aria-current="date"]');
    const frame = todayHeader?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (frame && frame.scrollWidth > frame.clientWidth) todayHeader?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [focusEvent, view, date]);

  const focusId = focusEvent?.id ?? null;
  useEffect(() => {
    if (!focusId) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector(`[data-event-id="${focusId}"]`)?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
  }, [focusId]);

  const save = async (next: typeof choices) => {
    const previous = choices;
    setChoices(next);
    const result = await runAction(() => saveCalendarChoices(next));
    if (!result.ok) {
      setChoices(previous);
      toast.error(t.saveFailed);
    }
  };

  const toggle = (list: string[], value: string, on: boolean) => (on ? [...list, value] : list.filter((entry) => entry !== value));
  const byId = useMemo(() => new Map(calendars.map((calendar) => [calendar.id, calendar])), [calendars]);
  const cohorts = calendars.filter((calendar) => calendar.is_cohort);
  const groups = useMemo(() => listGroups(events, calendars), [events, calendars]);
  const shown = useMemo(
    () => visibleEvents(events, calendars, choices.cohortIds, choices.hiddenGroups),
    [events, calendars, choices.cohortIds, choices.hiddenGroups],
  );
  const chosenCohort = cohorts.some((cohort) => choices.cohortIds.includes(cohort.id));

  const goTo = (next: string) => {
    setSlide(next > date ? "next" : next < date ? "previous" : "none");
    setDate(next);
  };
  const open = (event: CalendarEvent) => {
    setSelected(event);
    setDetailsOpen(true);
  };
  const kindOf = (event: CalendarEvent) => eventGroup(byId.get(event.calendar_id), event.title).kind;

  const days = view === "month" ? monthDays(date) : view === "week" ? weekDays(date) : [date];
  const inPeriod = shown.some((event) => eventDays(event).some((day) => days.includes(day)));
  const heading =
    view === "month"
      ? dayFormat(locale, date, { month: "long", year: "numeric" })
      : view === "week"
        ? `${dayFormat(locale, days[0], { day: "numeric", month: "short" })} – ${dayFormat(locale, days[6], { day: "numeric", month: "short", year: "numeric" })}`
        : dayFormat(locale, date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8">
      <CalendarRefresh />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-heading text-3xl font-bold text-primary">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {updatedAt ? fill(t.updated, { date: formatDate(locale, updatedAt, true) }) : t.neverUpdated}
        </p>
      </div>

      {calendars.length === 0 ? (
        <p className="text-muted-foreground">{t.empty}</p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <aside aria-label={t.filters} className="flex flex-wrap gap-x-8 gap-y-4 lg:block lg:space-y-6">
            {cohorts.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">{t.cohort}</legend>
                {cohorts.map((cohort) => (
                  <Label key={cohort.id} className="font-normal">
                    <Checkbox
                      checked={choices.cohortIds.includes(cohort.id)}
                      onCheckedChange={(on: boolean) => void save({ ...choices, cohortIds: toggle(choices.cohortIds, cohort.id, on) })}
                    />
                    {cohort.title}
                  </Label>
                ))}
              </fieldset>
            )}
            {groups.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">{t.kinds}</legend>
                {groups.map((group) => (
                  <Label key={group.key} className="font-normal leading-snug">
                    <Checkbox
                      checked={!choices.hiddenGroups.includes(group.key)}
                      onCheckedChange={(on: boolean) => void save({ ...choices, hiddenGroups: toggle(choices.hiddenGroups, group.key, !on) })}
                    />
                    <span className="min-w-0 break-words">{group.kind === "deadline" ? t.deadlines : group.label}</span>
                  </Label>
                ))}
              </fieldset>
            )}
          </aside>

          <section aria-label={t.title} className="min-w-0 space-y-3">
            {cohorts.length > 0 && !chosenCohort && <Alert role="status">{t.pickCohort}</Alert>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => goTo(today)}>
                  {t.today}
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label={t.previous} onClick={() => goTo(shiftDate(date, view, -1))}>
                  <ChevronLeft aria-hidden className="size-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label={t.next} onClick={() => goTo(shiftDate(date, view, 1))}>
                  <ChevronRight aria-hidden className="size-4" />
                </Button>
                <h2 aria-live="polite" className="font-medium">
                  <span key={heading} className="inline-block animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                    {heading}
                  </span>
                </h2>
              </div>
              <ToggleGroup
                aria-label={t.viewLabel}
                variant="outline"
                value={[view]}
                onValueChange={(value: string[]) => {
                  if (value[0] === "month" || value[0] === "week" || value[0] === "day") {
                    setSlide("none");
                    setViewOverride(null);
                    void save({ ...choices, view: value[0] });
                  }
                }}
              >
                <ToggleGroupItem value="month">{t.month}</ToggleGroupItem>
                <ToggleGroupItem value="week">{t.week}</ToggleGroupItem>
                <ToggleGroupItem value="day">{t.day}</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Card className="gap-0 py-0">
              <ScrollArea>
                <div className={`overflow-hidden ${view === "day" ? "" : "min-w-[46rem]"}`}>
                  <div
                    key={`${view}:${view === "month" ? date.slice(0, 7) : days[0]}`}
                    className={`animate-in fade-in-0 duration-300 ease-out motion-reduce:animate-none ${SLIDE[slide]}`}
                  >
            {view === "month" ? (
              <MonthGrid
                anchor={date}
                days={days}
                events={shown}
                kindOf={kindOf}
                locale={locale}
                onOpen={open}
                onShowDay={(day) => {
                  setSlide("none");
                  setDate(day);
                  void save({ ...choices, view: "day" });
                }}
                today={today}
              />
            ) : (
              <TimeGrid days={days} events={shown} focusId={focusId} kindOf={kindOf} locale={locale} onOpen={open} today={today} />
            )}
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Card>
            {!inPeriod && <p className="text-sm text-muted-foreground">{t.noneVisible}</p>}
          </section>
        </div>
      )}

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="overflow-y-auto">
          {selected && (
            <div key={selected.id} className="flex animate-in flex-col gap-4 fade-in-0 slide-in-from-right-2 duration-300 ease-out motion-reduce:animate-none">
              <EventDetails event={selected} calendar={byId.get(selected.calendar_id)} locale={locale} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

const FOCUS_STYLE = "z-[5] ring-2 ring-primary";

type GridProps = {
  days: string[];
  events: CalendarEvent[];
  focusId?: string | null;
  kindOf: (event: CalendarEvent) => "calendar" | "deadline" | "title";
  locale: Locale;
  onOpen: (event: CalendarEvent) => void;
  today: string;
};

function eventLabel(event: CalendarEvent, locale: Locale) {
  const t = dictionaries[locale].calendar;
  const when = timeRange(locale, event, t.allDay);
  return `${event.title}, ${when}${event.cancelled_at ? `, ${t.cancelled}` : ""}`;
}

function EventChip({ event, focused = false, kind, locale, onOpen, showTime }: { event: CalendarEvent; focused?: boolean; kind: "calendar" | "deadline" | "title"; locale: Locale; onOpen: (event: CalendarEvent) => void; showTime: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      aria-label={eventLabel(event, locale)}
      data-event-id={event.id}
      onClick={() => onOpen(event)}
      className={`w-full justify-start px-1.5 py-0.5 ${eventStyle(kind, Boolean(event.cancelled_at))} ${focused ? FOCUS_STYLE : ""}`}
    >
      <span className="truncate">
        {showTime && !event.all_day && <span className="mr-1 tabular-nums">{timeOf(locale, event.starts_at)}</span>}
        {event.title}
      </span>
    </Button>
  );
}

function MonthGrid({ anchor, days, events, kindOf, locale, onOpen, onShowDay, today }: GridProps & { anchor: string; onShowDay: (day: string) => void }) {
  const t = dictionaries[locale].calendar;
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    for (const day of eventDays(event)) byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  const month = anchor.slice(0, 7);

  return (
    <>
      <div className="grid grid-cols-7">
        {days.slice(0, 7).map((day) => (
          <div key={day} className="border-b border-border p-2 text-center text-xs font-medium text-muted-foreground">
            {dayFormat(locale, day, { weekday: "short" })}
          </div>
        ))}
        {days.map((day) => {
          const list = [...(byDay.get(day) ?? [])].sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.starts_at.localeCompare(b.starts_at));
          const hidden = list.length - 3;
          return (
            <div key={day} className={`min-h-28 space-y-1 border-b border-r border-border p-1 ${day.slice(0, 7) === month ? "" : "bg-muted/40"}`}>
              <Button
                type="button"
                variant={day === today ? "default" : "ghost"}
                size="icon-xs"
                aria-label={dayFormat(locale, day, { weekday: "long", day: "numeric", month: "long" })}
                aria-current={day === today ? "date" : undefined}
                onClick={() => onShowDay(day)}
                className="rounded-full font-normal"
              >
                {Number(day.slice(8))}
              </Button>
              {list.slice(0, 3).map((event) => (
                <EventChip key={event.id} event={event} kind={kindOf(event)} locale={locale} onOpen={onOpen} showTime />
              ))}
              {hidden > 0 && (
                <Button type="button" variant="link" size="xs" onClick={() => onShowDay(day)} className="h-auto px-1.5 font-normal text-muted-foreground">
                  {fill(t.more, { count: hidden })}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TimeGrid({ days, events, focusId, kindOf, locale, onOpen, today }: GridProps) {
  const t = dictionaries[locale].calendar;
  const inDay = (day: string, event: CalendarEvent) => eventDays(event).includes(day);
  const timed = events.filter((event) => !event.all_day && days.some((day) => inDay(day, event)));
  const allDay = events.filter((event) => event.all_day && days.some((day) => inDay(day, event)));
  const now = useNow();
  const nowIso = now === null ? null : new Date(now).toISOString();
  const nowDay = nowIso && days.some((day) => day === dayKey(nowIso, false)) ? dayKey(nowIso, false) : null;
  const nowMinutes = nowIso && nowDay ? minutesIntoDay(nowIso) : null;
  const hours = visibleHours(timed, nowMinutes);
  const first = hours[0];
  const columns = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <>
        <div className="grid border-b border-border" style={columns}>
          <div className="sticky left-0 z-20 bg-card" />
          {days.map((day) => (
            <div key={day} aria-current={day === today ? "date" : undefined} className={`p-2 text-center text-xs font-medium ${day === today ? "text-primary" : "text-muted-foreground"}`}>
              {dayFormat(locale, day, { weekday: "short", day: "numeric", month: "numeric" })}
            </div>
          ))}
        </div>
        {allDay.length > 0 && (
          <div className="grid border-b border-border" style={columns}>
            <div className="sticky left-0 z-20 bg-card p-1 text-right text-[0.7rem] leading-tight text-muted-foreground">{t.allDay}</div>
            {days.map((day) => (
              <div key={day} className="space-y-1 border-l border-border p-1">
                {allDay.filter((event) => inDay(day, event)).map((event) => (
                  <EventChip key={event.id} event={event} focused={event.id === focusId} kind={kindOf(event)} locale={locale} onOpen={onOpen} showTime={false} />
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="grid" style={columns}>
          <div className="sticky left-0 z-20 bg-card">
            {hours.map((hour) => (
              <div key={hour} style={{ height: HOUR_PX }} className="pr-2 text-right text-xs tabular-nums text-muted-foreground">
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day} className="relative border-l border-border" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((hour, index) => (
                <div key={hour} aria-hidden className="absolute inset-x-0 border-t border-border/60" style={{ top: index * HOUR_PX }} />
              ))}
              {day === nowDay && nowMinutes !== null && (
                <div
                  data-testid="now-line"
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 -translate-y-px bg-blue-500 transition-[top] duration-500 motion-reduce:transition-none"
                  style={{ top: ((nowMinutes - first * 60) / 60) * HOUR_PX }}
                >
                  <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-blue-500" />
                </div>
              )}
              {placeEvents(timed.filter((event) => inDay(day, event))).map(({ event, start, end: finish, column, columns: count }) => (
                <Button
                  key={event.id}
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={eventLabel(event, locale)}
                  data-event-id={event.id}
                  onClick={() => onOpen(event)}
                  style={{
                    top: ((start - first * 60) / 60) * HOUR_PX,
                    height: Math.max(((finish - start) / 60) * HOUR_PX - 2, 20),
                    left: `${(column / count) * 100}%`,
                    width: `calc(${100 / count}% - 2px)`,
                  }}
                  className={`absolute flex-col items-start justify-start gap-0 overflow-hidden px-1.5 py-0.5 text-left focus-visible:z-20 ${eventStyle(kindOf(event), Boolean(event.cancelled_at))} ${event.id === focusId ? FOCUS_STYLE : ""}`}
                >
                  <span className="block w-full truncate font-medium">{event.title}</span>
                  {finish - start >= 45 && <span className="block w-full truncate tabular-nums">{timeRange(locale, event, t.allDay)}</span>}
                </Button>
              ))}
            </div>
          ))}
        </div>
    </>
  );
}

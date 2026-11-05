"use client";

import { ChevronLeft, ChevronRight, MapPin, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { refreshCalendarEvents, saveCalendarChoices } from "@/app/(dashboard)/actions";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  splitLinks,
  visibleEvents,
  weekDays,
  type CalendarEvent,
  type CalendarInfo,
  type CalendarViewName,
} from "@/lib/calendar/view";
import { dictionaries, fill, formatDate, type Locale } from "@/lib/i18n";
import { runAction } from "@/lib/run-action";

const HOUR_PX = 64;
const ZONE = "Europe/Berlin";

const tag = (locale: Locale) => (locale === "de" ? "de-DE" : "en-GB");
const dayFormat = (locale: Locale, key: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(tag(locale), { ...options, timeZone: "UTC" }).format(new Date(`${key}T12:00:00.000Z`));
const timeOf = (locale: Locale, iso: string) =>
  new Intl.DateTimeFormat(tag(locale), { hour: "2-digit", minute: "2-digit", timeZone: ZONE }).format(new Date(iso));

function timeRange(locale: Locale, event: CalendarEvent, allDay: string) {
  return event.all_day ? allDay : `${timeOf(locale, event.starts_at)} – ${timeOf(locale, event.ends_at)}`;
}

function eventStyle(kind: "calendar" | "deadline" | "title", cancelled: boolean) {
  const color =
    kind === "deadline"
      ? "border-destructive bg-destructive/10"
      : kind === "calendar"
        ? "border-primary bg-primary/15"
        : "border-muted-foreground/50 bg-muted";
  return `${color} ${cancelled ? "line-through opacity-60" : ""}`;
}

export function CalendarPage({
  calendars,
  events,
  initialCohortIds,
  initialHiddenGroups,
  initialView,
  locale,
  today,
  updatedAt,
}: {
  calendars: CalendarInfo[];
  events: CalendarEvent[];
  initialCohortIds: string[];
  initialHiddenGroups: string[];
  initialView: CalendarViewName;
  locale: Locale;
  today: string;
  updatedAt: string | null;
}) {
  const t = dictionaries[locale].calendar;
  const [choices, setChoices] = useState({ cohortIds: initialCohortIds, hiddenGroups: initialHiddenGroups, view: initialView });
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fresh data when the page opens and when someone comes back to a tab left open.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") void runAction(() => refreshCalendarEvents());
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

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

  const open = (event: CalendarEvent) => {
    setSelected(event);
    setDetailsOpen(true);
  };
  const kindOf = (event: CalendarEvent) => eventGroup(byId.get(event.calendar_id), event.title).kind;

  const days = choices.view === "month" ? monthDays(date) : choices.view === "week" ? weekDays(date) : [date];
  const inPeriod = shown.some((event) => eventDays(event).some((day) => days.includes(day)));
  const heading =
    choices.view === "month"
      ? dayFormat(locale, date, { month: "long", year: "numeric" })
      : choices.view === "week"
        ? `${dayFormat(locale, days[0], { day: "numeric", month: "short" })} – ${dayFormat(locale, days[6], { day: "numeric", month: "short", year: "numeric" })}`
        : dayFormat(locale, date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8">
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
                  <label key={cohort.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={choices.cohortIds.includes(cohort.id)}
                      onCheckedChange={(on: boolean) => void save({ ...choices, cohortIds: toggle(choices.cohortIds, cohort.id, on) })}
                    />
                    {cohort.title}
                  </label>
                ))}
              </fieldset>
            )}
            {groups.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">{t.kinds}</legend>
                {groups.map((group) => (
                  <label key={group.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={!choices.hiddenGroups.includes(group.key)}
                      onCheckedChange={(on: boolean) => void save({ ...choices, hiddenGroups: toggle(choices.hiddenGroups, group.key, !on) })}
                    />
                    <span className="min-w-0 break-words">{group.kind === "deadline" ? t.deadlines : group.label}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </aside>

          <section aria-label={t.title} className="min-w-0 space-y-3">
            {cohorts.length > 0 && !chosenCohort && <Alert role="status">{t.pickCohort}</Alert>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setDate(today)}>
                  {t.today}
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label={t.previous} onClick={() => setDate(shiftDate(date, choices.view, -1))}>
                  <ChevronLeft aria-hidden className="size-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label={t.next} onClick={() => setDate(shiftDate(date, choices.view, 1))}>
                  <ChevronRight aria-hidden className="size-4" />
                </Button>
                <h2 aria-live="polite" className="font-medium">
                  {heading}
                </h2>
              </div>
              <ToggleGroup
                aria-label={t.viewLabel}
                variant="outline"
                value={[choices.view]}
                onValueChange={(value: string[]) => {
                  if (value[0] === "month" || value[0] === "week" || value[0] === "day") void save({ ...choices, view: value[0] });
                }}
              >
                <ToggleGroupItem value="month">{t.month}</ToggleGroupItem>
                <ToggleGroupItem value="week">{t.week}</ToggleGroupItem>
                <ToggleGroupItem value="day">{t.day}</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {choices.view === "month" ? (
              <MonthGrid
                anchor={date}
                days={days}
                events={shown}
                kindOf={kindOf}
                locale={locale}
                onOpen={open}
                onShowDay={(day) => {
                  setDate(day);
                  void save({ ...choices, view: "day" });
                }}
                today={today}
              />
            ) : (
              <TimeGrid days={days} events={shown} kindOf={kindOf} locale={locale} onOpen={open} today={today} />
            )}
            {!inPeriod && <p className="text-sm text-muted-foreground">{t.noneVisible}</p>}
          </section>
        </div>
      )}

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="overflow-y-auto">
          {selected && <EventDetails event={selected} calendar={byId.get(selected.calendar_id)} locale={locale} />}
        </SheetContent>
      </Sheet>
    </main>
  );
}

type GridProps = {
  days: string[];
  events: CalendarEvent[];
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

function EventChip({ event, kind, locale, onOpen, showTime }: { event: CalendarEvent; kind: "calendar" | "deadline" | "title"; locale: Locale; onOpen: (event: CalendarEvent) => void; showTime: boolean }) {
  return (
    <button
      type="button"
      aria-label={eventLabel(event, locale)}
      onClick={() => onOpen(event)}
      className={`block w-full truncate rounded-sm border-l-2 px-1.5 py-0.5 text-left text-xs hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring ${eventStyle(kind, Boolean(event.cancelled_at))}`}
    >
      {showTime && !event.all_day && <span className="mr-1 tabular-nums">{timeOf(locale, event.starts_at)}</span>}
      {event.title}
    </button>
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
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="grid min-w-[42rem] grid-cols-7">
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
              <button
                type="button"
                aria-label={dayFormat(locale, day, { weekday: "long", day: "numeric", month: "long" })}
                aria-current={day === today ? "date" : undefined}
                onClick={() => onShowDay(day)}
                className={`grid size-6 place-items-center rounded-full text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring ${day === today ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}
              >
                {Number(day.slice(8))}
              </button>
              {list.slice(0, 3).map((event) => (
                <EventChip key={event.id} event={event} kind={kindOf(event)} locale={locale} onOpen={onOpen} showTime />
              ))}
              {hidden > 0 && (
                <button type="button" onClick={() => onShowDay(day)} className="px-1.5 text-xs text-muted-foreground underline underline-offset-2">
                  {fill(t.more, { count: hidden })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({ days, events, kindOf, locale, onOpen, today }: GridProps) {
  const t = dictionaries[locale].calendar;
  const inDay = (day: string, event: CalendarEvent) => eventDays(event).includes(day);
  const timed = events.filter((event) => !event.all_day && days.some((day) => inDay(day, event)));
  const allDay = events.filter((event) => event.all_day && days.some((day) => inDay(day, event)));
  // Office hours by default, stretched only when an event falls outside them.
  const first = Math.min(8, ...timed.map((event) => Math.floor(minutesIntoDay(event.starts_at) / 60)));
  const last = Math.max(19, ...timed.map((event) => Math.ceil((minutesIntoDay(event.starts_at) + (new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60000) / 60)));
  const end = Math.min(last, 24);
  const hours = Array.from({ length: end - first }, (_, index) => first + index);
  const columns = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className={days.length > 1 ? "min-w-[46rem]" : ""}>
        <div className="grid border-b border-border" style={columns}>
          <div />
          {days.map((day) => (
            <div key={day} aria-current={day === today ? "date" : undefined} className={`p-2 text-center text-xs font-medium ${day === today ? "text-primary" : "text-muted-foreground"}`}>
              {dayFormat(locale, day, { weekday: "short", day: "numeric", month: "numeric" })}
            </div>
          ))}
        </div>
        {allDay.length > 0 && (
          <div className="grid border-b border-border" style={columns}>
            <div className="p-1 text-right text-[0.7rem] leading-tight text-muted-foreground">{t.allDay}</div>
            {days.map((day) => (
              <div key={day} className="space-y-1 border-l border-border p-1">
                {allDay.filter((event) => inDay(day, event)).map((event) => (
                  <EventChip key={event.id} event={event} kind={kindOf(event)} locale={locale} onOpen={onOpen} showTime={false} />
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="grid" style={columns}>
          <div>
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
              {placeEvents(timed.filter((event) => inDay(day, event))).map(({ event, start, end: finish, column, columns: count }) => (
                <button
                  key={event.id}
                  type="button"
                  aria-label={eventLabel(event, locale)}
                  onClick={() => onOpen(event)}
                  style={{
                    top: ((start - first * 60) / 60) * HOUR_PX,
                    height: Math.max(((finish - start) / 60) * HOUR_PX - 2, 20),
                    left: `${(column / count) * 100}%`,
                    width: `calc(${100 / count}% - 2px)`,
                  }}
                  className={`absolute flex flex-col items-start justify-start overflow-hidden rounded-sm border-l-2 px-1.5 py-0.5 text-left text-xs hover:brightness-95 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring ${eventStyle(kindOf(event), Boolean(event.cancelled_at))}`}
                >
                  <span className="block w-full truncate font-medium">{event.title}</span>
                  {finish - start >= 45 && <span className="block w-full truncate tabular-nums">{timeRange(locale, event, t.allDay)}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventDetails({ event, calendar, locale }: { event: CalendarEvent; calendar: CalendarInfo | undefined; locale: Locale }) {
  const t = dictionaries[locale].calendar;
  const day = dayFormat(locale, dayKey(event.starts_at, event.all_day), { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <SheetHeader>
        <SheetTitle className={event.cancelled_at ? "line-through" : ""}>{event.title}</SheetTitle>
        <SheetDescription>
          {day}, {timeRange(locale, event, t.allDay)}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-6">
        {event.cancelled_at && (
          <Alert variant="destructive">
            <strong>{t.cancelled}.</strong> {t.cancelledBody}
          </Alert>
        )}
        {event.meeting_url && !event.cancelled_at && (
          <a href={event.meeting_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ className: "w-full" })}>
            <Video aria-hidden className="size-4" />
            {t.join}
          </a>
        )}
        {event.location && (
          <p className="flex items-start gap-2">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="sr-only">{t.place}: </span>
              {splitLinks(event.location).map((piece, index) => (piece.href ? <ExternalText key={index} href={piece.href} /> : <span key={index}>{piece.text}</span>))}
            </span>
          </p>
        )}
        {event.description && (
          <div className="space-y-1">
            <h3 className="font-medium">{t.details}</h3>
            <p className="whitespace-pre-wrap break-words">
              {splitLinks(event.description).map((piece, index) => (piece.href ? <ExternalText key={index} href={piece.href} /> : <span key={index}>{piece.text}</span>))}
            </p>
          </div>
        )}
        {calendar && (
          <p className="text-muted-foreground">
            {t.source}: {calendar.title}
          </p>
        )}
      </div>
    </>
  );
}

function ExternalText({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">
      {href}
    </a>
  );
}

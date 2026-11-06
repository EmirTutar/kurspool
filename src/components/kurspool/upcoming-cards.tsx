"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { EventDetails } from "@/components/kurspool/event-details";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { dayFormat, timeRange } from "@/lib/calendar/format";
import { dayKey, type CalendarEvent, type CalendarInfo } from "@/lib/calendar/view";
import { dictionaries, fill, type Locale } from "@/lib/i18n";

export type UpcomingSlot = { label: "now" | "next" | "afterNext"; event: CalendarEvent | null };

/** Two cards for what's running and what's coming. A click opens the details right here. */
export function UpcomingCards({
  slots,
  calendars,
  locale,
  today,
}: {
  slots: UpcomingSlot[];
  calendars: CalendarInfo[];
  locale: Locale;
  today: string;
}) {
  const t = dictionaries[locale].calendar;
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [open, setOpen] = useState(false);
  const calendarOf = (event: CalendarEvent) => calendars.find((calendar) => calendar.id === event.calendar_id);

  const badgeFor = (slot: UpcomingSlot): ReactNode => {
    if (slot.label === "now") {
      return (
        <Badge variant={slot.event ? "default" : "secondary"}>
          {slot.event && <span aria-hidden className="size-1.5 rounded-full bg-blue-400 motion-safe:animate-pulse" />}
          {t.nowLabel}
        </Badge>
      );
    }
    return <Badge variant="secondary">{slot.label === "next" ? t.nextLabel : t.afterNextLabel}</Badge>;
  };

  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => {
          if (!slot.event) {
            return (
              <Card key={slot.label} size="sm" className="h-full">
                <CardHeader>
                  <div>{badgeFor(slot)}</div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{slot.label === "now" ? t.nothingNow : t.nothingNext}</p>
                </CardContent>
              </Card>
            );
          }
          const event = slot.event;
          const day = dayKey(event.starts_at, event.all_day);
          const when = day === today ? t.todayAt : dayFormat(locale, day, { weekday: "short", day: "numeric", month: "short" });
          return (
            <button
              key={slot.label}
              type="button"
              aria-label={fill(t.detailsOf, { title: event.title })}
              onClick={() => {
                setSelected(event);
                setOpen(true);
              }}
              className="group block rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card
                size="sm"
                className="h-full transition-[box-shadow,transform] duration-200 group-hover:shadow-md group-active:scale-[0.99] motion-reduce:transition-none motion-reduce:group-active:scale-100"
              >
                <CardHeader>
                  <div>{badgeFor(slot)}</div>
                  <CardTitle className="mt-1 break-words">{event.title}</CardTitle>
                  <CardDescription>
                    {when}, {timeRange(locale, event, t.allDay)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </button>
          );
        })}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          {selected && (
            <div key={selected.id} className="flex animate-in flex-col gap-4 fade-in-0 slide-in-from-right-2 duration-300 ease-out motion-reduce:animate-none">
              <EventDetails event={selected} calendar={calendarOf(selected)} locale={locale}>
                <Link href={`/calendar?event=${selected.id}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                  <CalendarDays aria-hidden />
                  {t.openInCalendar}
                </Link>
              </EventDetails>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

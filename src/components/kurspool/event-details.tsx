"use client";

import { MapPin, Video } from "lucide-react";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { dayFormat, timeRange } from "@/lib/calendar/format";
import { dayKey, splitLinks, type CalendarEvent, type CalendarInfo } from "@/lib/calendar/view";
import { dictionaries, type Locale } from "@/lib/i18n";

function ExternalText({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">
      {href}
    </a>
  );
}

function WithLinks({ text }: { text: string }) {
  return <>{splitLinks(text).map((piece, index) => (piece.href ? <ExternalText key={index} href={piece.href} /> : <span key={index}>{piece.text}</span>))}</>;
}

/** The inside of an event's detail panel, used by the calendar and the overview. */
export function EventDetails({
  event,
  calendar,
  locale,
  children,
}: {
  event: CalendarEvent;
  calendar: CalendarInfo | undefined;
  locale: Locale;
  children?: ReactNode;
}) {
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
              <WithLinks text={event.location} />
            </span>
          </p>
        )}
        {event.description && (
          <div className="space-y-1">
            <h3 className="font-medium">{t.details}</h3>
            <p className="whitespace-pre-wrap break-words">
              <WithLinks text={event.description} />
            </p>
          </div>
        )}
        {calendar && (
          <p className="text-muted-foreground">
            {t.source}: {calendar.title}
          </p>
        )}
        {children}
      </div>
    </>
  );
}

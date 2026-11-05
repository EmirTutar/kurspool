# Calendar design

A "Termine" page shows the course calendars inside Kurspool.

## Source

Each Google calendar is read through its secret iCal address. Such an address covers one calendar only, so Kurspool can't reach anyone's other calendars and needs no extra Google permission.

The address works like a password:

- A maintainer pastes it on the maintainer page. Only Google Calendar iCal addresses are accepted.
- It is stored encrypted in `calendar_sources`, which signed-in users can't read.
- Pasting a new address for a calendar with the same name replaces the old one.
- It never appears in Git, in logs or in the browser.

## Import

- Calendars refresh with the daily import and with "Sync now".
- Opening the page, or returning to its tab, refreshes calendars older than 10 minutes. A claim on `last_attempt_at` stops parallel visitors from repeating the work.
- A failed read keeps the stored events and records an error code for the maintainer. The page shows when the data was last read.
- A feed that suddenly has no events is treated as a failure, so a broken feed can't cancel everything.

## Cancelled events

Google removes a cancelled event from the feed. A future event that was imported before and is now missing stays visible, crossed out and marked as cancelled. If its series only moved to a new time on the same day, the old copy is deleted instead. An event that comes back loses the mark.

An event that is only renamed, for example to "Cancelled: ...", can't be recognized and stays normal.

## Filters and saved choices

- Each cohort calendar is a tick box, off until the person ticks it.
- Other filters come from the events themselves: one per non-cohort calendar, one for deadlines (titles starting with "Abgabe"), and one per title within cohort calendars. They start ticked.
- The ticks and the chosen view are saved per person in `calendar_preferences`. Only that person's own clicks change them.

## Views

Month, week and day, with all times in Europe/Berlin. Clicking an event opens its details: time, place, description with clickable links, and a button for the meeting link. The day and week views mark the current time with a blue line.

## Overview

The overview shows what is running and what comes next, following each person's own filters. Clicking one opens the calendar at that event. If the saved view is the month, that visit uses the day view without changing what is saved.

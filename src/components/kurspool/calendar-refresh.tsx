"use client";

import { useEffect } from "react";
import { refreshCalendarEvents } from "@/app/(dashboard)/actions";
import { runAction } from "@/lib/run-action";

/** Asks for fresh events when the page opens and when someone comes back to a tab left open. */
export function CalendarRefresh() {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") void runAction(() => refreshCalendarEvents());
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);
  return null;
}

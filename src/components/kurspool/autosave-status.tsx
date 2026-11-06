"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type { AutosaveState } from "@/hooks/use-autosave";
import { dictionaries, type Locale } from "@/lib/i18n";

/** A quiet line under an editor that says whether the text is saved. */
export function AutosaveStatus({ state, locale }: { state: AutosaveState; locale: Locale }) {
  const t = dictionaries[locale].notes;
  return (
    <p role="status" aria-live="polite" className="flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground">
      {state === "idle" && t.autosaveHint}
      {(state === "pending" || state === "saving") && (
        <>
          <LoaderCircle aria-hidden className="size-3.5 motion-safe:animate-spin" />
          {t.autosaving}
        </>
      )}
      {state === "saved" && (
        <span className="flex animate-in items-center gap-1.5 fade-in-0 duration-200 motion-reduce:animate-none">
          <Check aria-hidden className="size-3.5 text-success" />
          {t.autosaved}
        </span>
      )}
      {state === "failed" && (
        <span className="flex items-center gap-1.5 text-destructive">
          <CircleAlert aria-hidden className="size-3.5" />
          {t.autosaveFailed}
        </span>
      )}
    </p>
  );
}

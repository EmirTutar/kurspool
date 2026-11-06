"use client";

import { Lightbulb } from "lucide-react";
import { useEffect, useRef } from "react";
import { addIdea } from "@/app/(dashboard)/actions";
import { ActionForm } from "@/components/kurspool/action-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dictionaries, type Locale } from "@/lib/i18n";

const DRAFT_KEY = "kurspool:idea-draft";

function readDraft(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(value: string) {
  try {
    if (value.trim()) window.localStorage.setItem(DRAFT_KEY, value);
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Without storage the draft just isn't kept. Sharing still works.
  }
}

/**
 * Sharing an idea publishes it to the whole batch, so that stays a deliberate click.
 * Until then the draft is kept in this browser, so nothing typed is lost.
 */
export function IdeaForm({ locale }: { locale: Locale }) {
  const t = dictionaries[locale].ideas;
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (field.current && !field.current.value) field.current.value = readDraft();
  }, []);

  return (
    <ActionForm action={addIdea} resetOnSuccess onSuccess={() => writeDraft("")} className="space-y-2">
      <Label htmlFor="idea-body">{t.label}</Label>
      <Textarea
        ref={field}
        id="idea-body"
        name="body"
        required
        maxLength={2000}
        placeholder={t.placeholder}
        className="min-h-24"
        onChange={(event) => writeDraft(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">{t.draftKept}</p>
      <Button type="submit">
        <Lightbulb aria-hidden />
        {t.add}
      </Button>
    </ActionForm>
  );
}

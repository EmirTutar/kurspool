"use client";

import { useRef } from "react";
import { saveItemNote } from "@/app/(dashboard)/actions";
import { AutosaveStatus } from "@/components/kurspool/autosave-status";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/use-autosave";
import { dictionaries, type Locale } from "@/lib/i18n";
import { runAction } from "@/lib/run-action";

/** The person's own note on one course item. It saves itself, and an emptied note is removed. */
export function ItemNote({
  itemId,
  note,
  locale,
  onSaved,
}: {
  itemId: string;
  note: string | null;
  locale: Locale;
  onSaved: (hasNote: boolean) => void;
}) {
  const t = dictionaries[locale].notes;
  const field = useRef<HTMLTextAreaElement>(null);
  const fieldId = `note-${itemId}`;
  const { state, schedule, flush } = useAutosave(async () => {
    const body = field.current?.value ?? "";
    const result = await runAction(() => saveItemNote(itemId, body));
    if (result.ok) onSaved(body.trim().length > 0);
    return result.ok;
  });

  return (
    <div className="max-w-prose space-y-1">
      <Label htmlFor={fieldId}>{t.itemNote}</Label>
      <Textarea
        ref={field}
        id={fieldId}
        defaultValue={note ?? ""}
        maxLength={10000}
        placeholder={t.itemNotePlaceholder}
        className="min-h-20"
        onChange={schedule}
        onBlur={() => void flush()}
      />
      <AutosaveStatus state={state} locale={locale} />
    </div>
  );
}

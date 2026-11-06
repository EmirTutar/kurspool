"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { saveItemNote } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dictionaries, type Locale } from "@/lib/i18n";
import { runAction } from "@/lib/run-action";

/** The person's own note on one course item. Saving it empty removes it. */
export function ItemNote({ itemId, note, locale }: { itemId: string; note: string | null; locale: Locale }) {
  const t = dictionaries[locale].notes;
  const [pending, startTransition] = useTransition();
  const fieldId = `note-${itemId}`;

  return (
    <form
      className="max-w-prose space-y-2"
      aria-busy={pending}
      action={(form) =>
        startTransition(async () => {
          const result = await runAction(() => saveItemNote(itemId, String(form.get("body") ?? "")));
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
    >
      <Label htmlFor={fieldId}>{t.itemNote}</Label>
      <Textarea id={fieldId} name="body" defaultValue={note ?? ""} maxLength={10000} placeholder={t.itemNotePlaceholder} className="min-h-20" />
      <Button type="submit" variant="secondary" disabled={pending}>
        {t.itemNoteSave}
      </Button>
    </form>
  );
}

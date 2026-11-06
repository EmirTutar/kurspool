"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { dictionaries, type Locale } from "@/lib/i18n";
import { runAction } from "@/lib/run-action";

/** A bin icon that asks in the middle of the screen before anything is deleted. */
export function ConfirmDelete({
  label,
  title,
  description,
  locale,
  onConfirm,
}: {
  /** What a screen reader announces for the bin, for example "Delete note: Shopping list". */
  label: string;
  title: string;
  description: string;
  locale: Locale;
  onConfirm: () => Promise<ActionResult>;
}) {
  const t = dictionaries[locale].confirm;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await runAction(onConfirm);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                setOpen(false);
                if (result.message) toast.success(result.message);
              })
            }
          >
            <Trash2 aria-hidden />
            {t.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

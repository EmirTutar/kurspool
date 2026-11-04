"use client";

import { Check, Clapperboard, Ellipsis, GraduationCap, Info, MessageSquareText, BookOpen, type LucideIcon } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { markItemSeen, setItemStatus } from "@/app/(dashboard)/actions";
import { displayTitle, splitLinks, type ItemView, type StoredStatus } from "@/lib/dashboard";
import { dictionaries, formatDate, type Locale } from "@/lib/i18n";
import type { ItemCategory } from "@/lib/sync/map";

const CATEGORY_ICONS: Record<ItemCategory, LucideIcon> = {
  session: GraduationCap,
  recording: Clapperboard,
  feedback: MessageSquareText,
  reading: BookOpen,
  organization: Info,
  other: Ellipsis,
};

export function ItemRow({ item, locale, moduleTitle }: { item: ItemView; locale: Locale; moduleTitle?: string }) {
  const t = dictionaries[locale];
  const [, startTransition] = useTransition();
  const [seen, setSeen] = useState(false);
  const [status, setOptimisticStatus] = useOptimistic(item.status);
  const shown = status === "new" && seen ? "todo" : status;
  const finished = shown === "done" || shown === "skipped";
  const title = displayTitle(item.title);
  const Icon = CATEGORY_ICONS[item.category];

  function change(next: StoredStatus) {
    startTransition(async () => {
      setOptimisticStatus(next);
      const result = await setItemStatus(item.id, next);
      if (!result.ok) toast.error(result.message);
    });
  }

  const actions = (
    [
      { status: "todo", label: t.item.actionTodo },
      { status: "done", label: t.item.actionDone },
      { status: "skipped", label: t.item.actionSkip },
    ] as const
  ).filter((action) => action.status !== shown);

  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      <button
        type="button"
        aria-label={`${shown === "done" ? t.item.markOpen : t.item.markDone}: ${title}`}
        aria-pressed={shown === "done"}
        onClick={() => change(shown === "done" ? "todo" : "done")}
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border ${
          shown === "done" ? "border-success bg-success text-white" : "border-input bg-background hover:bg-secondary"
        }`}
      >
        {shown === "done" && <Check aria-hidden className="size-4" />}
      </button>

      <details
        className="min-w-0 flex-1"
        onToggle={(event) => {
          if (event.currentTarget.open && status === "new" && !seen) {
            setSeen(true);
            startTransition(async () => {
              const result = await markItemSeen(item.id);
              if (!result.ok) {
                setSeen(false);
                toast.error(result.message);
              }
            });
          }
        }}
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-sm [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className={shown === "new" ? "marker font-medium" : finished ? "text-muted-foreground line-through decoration-1" : "font-medium"}>
              {title}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <Icon aria-hidden className="size-3.5 shrink-0" />
              {[moduleTitle, t.category[item.category], item.due_at && `${t.item.due} ${formatDate(locale, item.due_at)}`]
                .filter(Boolean)
                .join(", ")}
            </span>
          </span>
          <span className="shrink-0 text-sm text-muted-foreground">{t.status[shown]}</span>
        </summary>

        <div className="mt-3 space-y-3 pb-1">
          {item.description && (
            <p className="max-w-prose whitespace-pre-line break-words text-sm leading-relaxed">
              {splitLinks(item.description).map((part, index) =>
                part.href ? (
                  <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                    {part.text}
                  </a>
                ) : (
                  <span key={index}>{part.text}</span>
                ),
              )}
            </p>
          )}
          {item.item_attachments.length > 0 && (
            <ul className="space-y-1 text-sm">
              {item.item_attachments.map((attachment) => (
                <li key={attachment.id} className="break-words">
                  {attachment.url ? (
                    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                      {attachment.title || attachment.url}
                    </a>
                  ) : (
                    attachment.title
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.status}
                type="button"
                onClick={() => change(action.status)}
                className="min-h-9 rounded-md border border-border bg-background px-3 text-sm hover:bg-secondary"
              >
                {action.label}
              </button>
            ))}
            {item.classroom_url && (
              <a href={item.classroom_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-4">
                {t.item.openClassroom}
              </a>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

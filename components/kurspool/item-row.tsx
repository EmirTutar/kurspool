"use client";

import { useTransition } from "react";
import { markItemSeen, setItemStatus } from "@/app/(dashboard)/actions";
import { CATEGORY_LABELS, STATUS_LABELS, type ItemView } from "@/lib/dashboard";

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });

const ACTIONS = [
  { status: "todo", label: "Offen" },
  { status: "done", label: "Erledigt" },
  { status: "skipped", label: "Überspringen" },
] as const;

export function ItemRow({ item, moduleTitle }: { item: ItemView; moduleTitle?: string }) {
  const [, startTransition] = useTransition();
  const finished = item.status === "done" || item.status === "skipped";

  return (
    <details
      className="group border-b border-border py-3 last:border-b-0"
      onToggle={(event) => {
        if (event.currentTarget.open && item.status === "new") {
          startTransition(() => markItemSeen(item.id));
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span
            className={
              item.status === "new"
                ? "marker font-medium"
                : finished
                  ? "text-muted-foreground line-through decoration-1"
                  : "font-medium"
            }
          >
            {item.title}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {[
              moduleTitle,
              CATEGORY_LABELS[item.category],
              item.due_at && `fällig ${dateFormat.format(new Date(item.due_at))}`,
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        </span>
        <span className="shrink-0 text-sm text-muted-foreground">{STATUS_LABELS[item.status]}</span>
      </summary>

      <div className="mt-3 space-y-3 pb-1">
        {item.description && (
          <p className="max-w-prose whitespace-pre-line break-words text-sm leading-relaxed">{item.description}</p>
        )}
        {item.item_attachments.length > 0 && (
          <ul className="space-y-1 text-sm">
            {item.item_attachments.map((attachment) => (
              <li key={attachment.id} className="break-words">
                {attachment.url ? (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
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
          <form action={setItemStatus} className="flex flex-wrap gap-2">
            <input type="hidden" name="itemId" value={item.id} />
            {ACTIONS.filter((action) => action.status !== item.status).map((action) => (
              <button
                key={action.status}
                type="submit"
                name="status"
                value={action.status}
                className="min-h-9 rounded-md border border-border bg-background px-3 text-sm hover:bg-secondary"
              >
                {action.label}
              </button>
            ))}
          </form>
          {item.classroom_url && (
            <a
              href={item.classroom_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline underline-offset-4"
            >
              In Classroom öffnen
            </a>
          )}
        </div>
      </div>
    </details>
  );
}

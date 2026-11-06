"use client";

import {
  BookOpen,
  ClipboardList,
  Clapperboard,
  Ellipsis,
  FileText,
  GraduationCap,
  Info,
  Link as LinkIcon,
  MessageSquareText,
  StickyNote,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { markItemSeen, setItemFavorite, setItemStatus } from "@/app/(dashboard)/actions";
import { FavoriteToggle } from "@/components/kurspool/favorite-toggle";
import { ItemNote } from "@/components/kurspool/item-note";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { displayTitle, splitLinks, type ItemView, type StoredStatus } from "@/lib/dashboard";
import { dictionaries, formatDate, type Locale } from "@/lib/i18n";
import { runAction } from "@/lib/run-action";
import type { AttachmentType, ItemCategory } from "@/lib/sync/map";

const CATEGORY_ICONS: Record<ItemCategory, LucideIcon> = {
  session: GraduationCap,
  recording: Clapperboard,
  feedback: MessageSquareText,
  reading: BookOpen,
  organization: Info,
  other: Ellipsis,
};

const ATTACHMENT_ICONS: Record<AttachmentType, LucideIcon> = {
  link: LinkIcon,
  driveFile: FileText,
  youtubeVideo: Video,
  form: ClipboardList,
};

function QuickLinks({ links, label, className }: { links: ItemView["item_attachments"]; label: string; className: string }) {
  return (
    <ul aria-label={label} className={className}>
      {links.map((attachment) => {
        const LinkType = ATTACHMENT_ICONS[attachment.type] ?? LinkIcon;
        return (
          <li key={attachment.id}>
            <a
              href={attachment.url as string}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "xs", className: "max-w-56 font-normal" })}
            >
              <LinkType aria-hidden />
              <span className="truncate">{attachment.title || attachment.url}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function ItemRow({ item, locale, moduleTitle }: { item: ItemView; locale: Locale; moduleTitle?: string }) {
  const t = dictionaries[locale];
  const [, startTransition] = useTransition();
  const [seen, setSeen] = useState(false);
  const [hasNote, setHasNote] = useState(Boolean(item.note));
  const [status, setOptimisticStatus] = useOptimistic(item.status);
  const shown = status === "new" && seen ? "todo" : status;
  const finished = shown === "done" || shown === "skipped";
  const title = displayTitle(item.title);
  const Icon = CATEGORY_ICONS[item.category];
  const links = item.item_attachments.filter((attachment) => attachment.url);

  function change(next: StoredStatus) {
    startTransition(async () => {
      setOptimisticStatus(next);
      const result = await runAction(() => setItemStatus(item.id, next));
      if (!result.ok) toast.error(result.message);
    });
  }

  function markSeen(open: boolean) {
    if (!open || status !== "new" || seen) return;
    setSeen(true);
    startTransition(async () => {
      const result = await runAction(() => markItemSeen(item.id));
      if (!result.ok) {
        setSeen(false);
        toast.error(result.message);
      }
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
    <div
      id={`item-${item.id}`}
      className="flex scroll-mt-20 items-start gap-3 border-b border-border py-3 last:border-b-0 target:rounded-md target:bg-primary/5"
    >
      <Checkbox
        checked={shown === "done"}
        onCheckedChange={(checked) => change(checked ? "done" : "todo")}
        aria-label={`${t.item.markDone}: ${title}`}
        className="mt-0.5 size-6 rounded-md data-checked:border-success data-checked:bg-success data-checked:text-white dark:data-checked:bg-success [&_svg]:size-4"
      />

      <Collapsible className="min-w-0 flex-1" onOpenChange={markSeen}>
        <div className="flex items-start gap-2">
          <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-3 rounded-sm text-left">
            <span className="min-w-0">
              <span className={shown === "new" ? "marker font-medium" : finished ? "text-muted-foreground line-through decoration-1" : "font-medium"}>
                {title}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                <Icon aria-hidden className="size-3.5 shrink-0" />
                {hasNote && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <StickyNote aria-hidden className="size-3.5" />
                    {t.notes.hasNote}
                    <span aria-hidden>·</span>
                  </span>
                )}
                {[moduleTitle, t.category[item.category], item.due_at && `${t.item.due} ${formatDate(locale, item.due_at)}`]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </span>
          </CollapsibleTrigger>
          {links.length > 0 && (
            <QuickLinks links={links} label={`${t.item.links}: ${title}`} className="hidden max-w-[50%] flex-wrap justify-end gap-1.5 sm:flex" />
          )}
          <Badge variant="secondary" className="mt-0.5">
            {t.status[shown]}
          </Badge>
          <FavoriteToggle
            starred={item.favorite}
            label={`${t.item.favorite}: ${title}`}
            onChange={(on) => setItemFavorite(item.id, on)}
          />
        </div>

        {/* Always visible, so the material is one click away without opening the item. */}
        {links.length > 0 && (
          <QuickLinks links={links} label={`${t.item.links}: ${title}`} className="mt-2 flex flex-wrap gap-1.5 sm:hidden" />
        )}

        <CollapsibleContent className="mt-3 space-y-3 pb-1">
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
          {item.item_attachments.some((attachment) => !attachment.url) && (
            <ul className="space-y-1 text-sm">
              {item.item_attachments
                .filter((attachment) => !attachment.url)
                .map((attachment) => (
                  <li key={attachment.id} className="break-words">
                    {attachment.title}
                  </li>
                ))}
            </ul>
          )}
          <ItemNote itemId={item.id} note={item.note} locale={locale} onSaved={setHasNote} />
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <Button key={action.status} type="button" variant="outline" size="lg" onClick={() => change(action.status)}>
                {action.label}
              </Button>
            ))}
            {item.classroom_url && (
              <a href={item.classroom_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-4">
                {t.item.openClassroom}
              </a>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

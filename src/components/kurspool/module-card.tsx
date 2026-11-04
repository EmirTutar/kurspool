"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { ItemRow } from "@/components/kurspool/item-row";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { moduleProgress, type ItemView } from "@/lib/dashboard";
import { dictionaries, fill, type Locale } from "@/lib/i18n";

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Decorative: the card's text already states the same progress for screen readers. */
function ProgressCircle({ percent }: { percent: number }) {
  return (
    <span aria-hidden className="relative grid size-14 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90">
        <circle cx="24" cy="24" r={RADIUS} fill="none" strokeWidth="4" className="stroke-accent" />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
          className="stroke-success transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <span className="text-xs font-semibold tabular-nums">{percent}%</span>
    </span>
  );
}

export function ModuleCard({
  id,
  title,
  items,
  groups,
  locale,
}: {
  id: string;
  title: string;
  items: ItemView[];
  groups: { id: string; title: string; items: ItemView[] }[];
  locale: Locale;
}) {
  const t = dictionaries[locale].dashboard;
  const progress = moduleProgress(items);

  if (progress.total === 0) {
    return (
      <Card className="flex-row items-center gap-4 p-4">
        <span className="min-w-0 flex-1">
          <span className="block font-heading font-bold text-primary">{title}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{t.noMaterial}</span>
        </span>
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <Collapsible>
        <CollapsibleTrigger className="group/module flex w-full cursor-pointer items-center gap-4 rounded-xl p-4 text-left hover:bg-muted/50">
          <ChevronDown aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/module:rotate-180 motion-reduce:transition-none" />
          <span className="min-w-0 flex-1">
            <span className="block font-heading font-bold text-primary">{title}</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {fill(t.finishedOf, { finished: progress.finished, total: progress.total })}
              {progress.newCount > 0 && fill(t.newSuffix, { count: progress.newCount })}
            </span>
          </span>
          <ProgressCircle percent={progress.percent} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 border-t border-border p-4">
          {groups.map((group) => (
            <section key={group.id} aria-label={group.title}>
              <h3 className="font-heading font-bold text-primary">{group.title}</h3>
              <div className="mt-1">
                {group.items.map((item) => (
                  <ItemRow key={item.id} item={item} locale={locale} />
                ))}
              </div>
            </section>
          ))}
          <Link href={`/modules/${id}`} className="inline-block text-sm text-primary underline underline-offset-4">
            {t.moduleDetails}
          </Link>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

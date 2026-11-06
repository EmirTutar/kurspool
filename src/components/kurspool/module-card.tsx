"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ItemRow } from "@/components/kurspool/item-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { moduleProgress, type ItemView } from "@/lib/dashboard";
import { dictionaries, fill, type Locale } from "@/lib/i18n";
import { cn } from "cn";

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PANEL_ID = "module-panel";

export type ModuleCardData = {
  id: string;
  title: string;
  items: ItemView[];
  groups: { id: string; title: string; items: ItemView[] }[];
};

/** Decorative: the card's text already states the same progress for screen readers. */
function ProgressCircle({ percent }: { percent: number }) {
  return (
    <span aria-hidden className="relative grid size-11 shrink-0 place-items-center md:size-14">
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
      <span className="text-[0.625rem] font-semibold tabular-nums md:text-xs">{percent}%</span>
    </span>
  );
}

function CardText({ module, locale }: { module: ModuleCardData; locale: Locale }) {
  const t = dictionaries[locale].dashboard;
  const progress = moduleProgress(module.items);
  return (
    <span className="w-full min-w-0 flex-1 md:w-auto">
      <span className="block break-words font-heading text-sm font-bold text-primary md:text-base">{module.title}</span>
      <span className="mt-0.5 block text-xs font-normal text-muted-foreground md:text-sm">
        {progress.total === 0
          ? t.noMaterial
          : fill(t.finishedOf, { finished: progress.finished, total: progress.total }) +
            (progress.newCount > 0 ? fill(t.newSuffix, { count: progress.newCount }) : "")}
      </span>
    </span>
  );
}

/** Three cards per row, six on very wide screens. Opening one never moves the cards: its content appears below them. */
export function ModuleCards({ modules, locale }: { modules: ModuleCardData[]; locale: Locale }) {
  const t = dictionaries[locale].dashboard;
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = modules.find((module) => module.id === activeId);

  return (
    <div className="space-y-3">
      <div data-module-open={active ? "true" : "false"} className="grid grid-cols-3 gap-2 md:gap-3 2xl:grid-cols-6">
        {modules.map((module) => {
          const isActive = module.id === activeId;
          const dimmed = Boolean(active) && !isActive;
          if (module.items.length === 0) {
            return (
              <Card key={module.id} className={cn("flex-col items-start gap-2 p-2.5 md:flex-row md:items-center md:gap-3 md:p-4", dimmed && "opacity-60")}>
                <CardText module={module} locale={locale} />
              </Card>
            );
          }
          return (
            <Card
              key={module.id}
              className={cn(
                "gap-0 py-0 transition-[opacity,box-shadow] motion-reduce:transition-none",
                isActive && "shadow-xl ring-2 ring-primary/40",
                dimmed && "opacity-60 hover:opacity-100 focus-within:opacity-100",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                aria-expanded={isActive}
                aria-controls={isActive ? PANEL_ID : undefined}
                onClick={() => setActiveId(isActive ? null : module.id)}
                className="h-full w-full shrink flex-col items-start justify-start gap-2 whitespace-normal rounded-xl p-2.5 text-left md:flex-row md:items-center md:gap-3 md:p-4"
              >
                <CardText module={module} locale={locale} />
                <ProgressCircle percent={moduleProgress(module.items).percent} />
              </Button>
            </Card>
          );
        })}
      </div>

      {active && (
        <Card id={PANEL_ID} key={active.id} className="animate-in fade-in slide-in-from-top-2 gap-0 py-0 shadow-xl ring-2 ring-primary/40 duration-200 motion-reduce:animate-none">
          <div className="flex items-center justify-between gap-3 border-b border-border p-4 md:px-5">
            <h3 className="font-heading font-bold text-primary">{active.title}</h3>
            <Button type="button" variant="ghost" size="icon-lg" aria-label={t.closeModule} onClick={() => setActiveId(null)}>
              <X aria-hidden className="size-4" />
            </Button>
          </div>
          <div className="space-y-6 p-4 md:p-5">
            {active.groups.map((group) => (
              <section key={group.id} aria-label={group.title}>
                <h4 className="font-heading font-bold text-primary">{group.title}</h4>
                <div className="mt-1">
                  {group.items.map((item) => (
                    <ItemRow key={item.id} item={item} locale={locale} />
                  ))}
                </div>
              </section>
            ))}
            <Link href={`/modules/${active.id}`} className="inline-block text-sm text-primary underline underline-offset-4">
              {t.moduleDetails}
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

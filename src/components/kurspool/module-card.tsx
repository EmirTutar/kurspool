"use client";

import { ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { flushSync } from "react-dom";
import { ItemRow } from "@/components/kurspool/item-row";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { moduleProgress, type ItemView } from "@/lib/dashboard";
import { dictionaries, fill, type Locale } from "@/lib/i18n";
import { cn } from "cn";

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type ModuleCardData = {
  id: string;
  title: string;
  items: ItemView[];
  groups: { id: string; title: string; items: ItemView[] }[];
};

/** Decorative: the card's text already states the same progress for screen readers. */
function ProgressCircle({ percent, small }: { percent: number; small: boolean }) {
  return (
    <span aria-hidden className={cn("relative grid shrink-0 place-items-center", small ? "size-9" : "size-14")}>
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
      <span className={cn("font-semibold tabular-nums", small ? "text-[0.625rem]" : "text-xs")}>{percent}%</span>
    </span>
  );
}

function ModuleCard({
  module,
  index,
  active,
  behind,
  onToggle,
  locale,
}: {
  module: ModuleCardData;
  index: number;
  active: boolean;
  behind: boolean;
  onToggle: (open: boolean) => void;
  locale: Locale;
}) {
  const t = dictionaries[locale].dashboard;
  const progress = moduleProgress(module.items);
  const transitionName = { viewTransitionName: `module-card-${index}` };

  const summary = (
    <span className="min-w-0 flex-1">
      <span className={cn("block font-heading font-bold text-primary", behind && "line-clamp-2 text-sm leading-snug")}>{module.title}</span>
      <span className={cn("mt-0.5 block text-sm text-muted-foreground", behind && "sr-only")}>
        {progress.total === 0
          ? t.noMaterial
          : fill(t.finishedOf, { finished: progress.finished, total: progress.total }) +
            (progress.newCount > 0 ? fill(t.newSuffix, { count: progress.newCount }) : "")}
      </span>
    </span>
  );

  if (progress.total === 0) {
    return (
      <Card
        style={transitionName}
        className={cn("h-full flex-row items-center gap-3 py-0", behind ? "p-3 opacity-60" : "p-4")}
      >
        {summary}
      </Card>
    );
  }

  return (
    <Collapsible
      open={active}
      onOpenChange={onToggle}
      style={transitionName}
      className={cn(active && "order-last col-span-full")}
    >
      <Card
        className={cn(
          "h-full gap-0 py-0 transition-[opacity,box-shadow] motion-reduce:transition-none",
          active && "shadow-xl ring-2 ring-primary/40",
          behind && "opacity-60 hover:opacity-100 focus-within:opacity-100",
        )}
      >
        <CollapsibleTrigger
          className={cn(
            "flex h-full w-full cursor-pointer items-center text-left hover:bg-muted/50",
            active ? "gap-4 rounded-t-xl p-5" : "rounded-xl",
            !active && (behind ? "gap-2 p-3" : "gap-3 p-4"),
          )}
        >
          {summary}
          <ProgressCircle percent={progress.percent} small={behind} />
          {active && <ChevronUp aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 border-t border-border p-5">
          {module.groups.map((group) => (
            <section key={group.id} aria-label={group.title}>
              <h3 className="font-heading font-bold text-primary">{group.title}</h3>
              <div className="mt-1">
                {group.items.map((item) => (
                  <ItemRow key={item.id} item={item} locale={locale} />
                ))}
              </div>
            </section>
          ))}
          <Link href={`/modules/${module.id}`} className="inline-block text-sm text-primary underline underline-offset-4">
            {t.moduleDetails}
          </Link>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function ModuleCards({ modules, locale }: { modules: ModuleCardData[]; locale: Locale }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  function select(next: string | null) {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm || !document.startViewTransition) {
      setActiveId(next);
      return;
    }
    document.startViewTransition(() => flushSync(() => setActiveId(next)));
  }

  return (
    <div
      data-module-open={activeId ? "true" : "false"}
      className={cn("grid items-stretch gap-3", activeId ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-2 lg:grid-cols-3")}
    >
      {modules.map((module, index) => (
        <ModuleCard
          key={module.id}
          module={module}
          index={index}
          active={activeId === module.id}
          behind={activeId !== null && activeId !== module.id}
          onToggle={(open) => select(open ? module.id : null)}
          locale={locale}
        />
      ))}
    </div>
  );
}

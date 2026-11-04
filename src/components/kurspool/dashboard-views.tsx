"use client";

import { LayoutGrid, List } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { dictionaries, type Locale } from "@/lib/i18n";

export type DashboardView = "cards" | "list";

/** Switches between the module cards and the lists of new and open items, and remembers the choice. */
export function DashboardViews({
  initialView,
  locale,
  cards,
  list,
}: {
  initialView: DashboardView;
  locale: Locale;
  cards: ReactNode;
  list: ReactNode;
}) {
  const t = dictionaries[locale].dashboard;
  const [view, setView] = useState(initialView);

  function choose(next: DashboardView) {
    setView(next);
    document.cookie = `dashboard_view=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }

  return (
    <section aria-labelledby="path-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="path-heading" className="font-heading text-xl font-bold text-primary">
          {t.path}
        </h2>
        <ToggleGroup
          aria-label={t.viewLabel}
          variant="outline"
          value={[view]}
          onValueChange={(value: string[]) => {
            if (value[0] === "cards" || value[0] === "list") choose(value[0]);
          }}
        >
          <ToggleGroupItem value="cards" aria-label={t.cardView} title={t.cardView}>
            <LayoutGrid aria-hidden className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label={t.listView} title={t.listView}>
            <List aria-hidden className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="mt-3">{view === "cards" ? cards : list}</div>
    </section>
  );
}

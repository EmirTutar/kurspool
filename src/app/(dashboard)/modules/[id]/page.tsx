import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ModuleSkeleton } from "@/components/kurspool/skeletons";
import { ItemRow } from "@/components/kurspool/item-row";
import { buttonVariants } from "@/components/ui/button";
import { loadBatchData } from "@/lib/batch-data";
import { CATEGORIES, filterItems, groupByTopic, moduleProgress, STATUSES } from "@/lib/dashboard";
import { fill } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Kurspool" };

type Props = PageProps<"/modules/[id]">;

function FilterLinks({
  label,
  allLabel,
  param,
  options,
  current,
  other,
}: {
  label: string;
  allLabel: string;
  param: string;
  options: [string, string][];
  current?: string;
  other: Record<string, string | undefined>;
}) {
  const href = (value?: string) => {
    const query = new URLSearchParams(
      Object.entries({ ...other, [param]: value }).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return query ? `?${query}` : "?";
  };
  const chip = (active: boolean) => buttonVariants({ variant: active ? "default" : "secondary", size: "lg" });

  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Link href={href()} aria-current={!current ? "true" : undefined} className={chip(!current)}>
          {allLabel}
        </Link>
        {options.map(([value, text]) => (
          <Link key={value} href={href(value)} aria-current={current === value ? "true" : undefined} className={chip(current === value)}>
            {text}
          </Link>
        ))}
      </div>
    </div>
  );
}

async function ModuleContent({ params, searchParams }: Props) {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { locale, t } = await getDictionary();
  const { id } = await params;
  const query = await searchParams;
  const category = CATEGORIES.find((value) => value === query.category);
  const status = STATUSES.find((value) => value === query.status);

  const { modules, topics, items } = await loadBatchData(membership);
  const moduleRow = modules.find((candidate) => candidate.id === id);
  if (!moduleRow) notFound();

  const moduleItems = items.filter((item) => item.module_id === id);
  const progress = moduleProgress(moduleItems);
  const visible = filterItems(moduleItems, { category, status });
  const groups = groupByTopic(visible, topics.filter((topic) => topic.module_id === id), t.module.moreEntries);

  return (
    <main className="animate-in fade-in duration-300 motion-reduce:animate-none mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <Link href="/dashboard" className="text-sm underline underline-offset-4">
          {t.module.back}
        </Link>
        <h1 className="mt-2 font-heading text-3xl font-bold text-primary">{moduleRow.title}</h1>
        <p className="mt-1 text-muted-foreground">
          {progress.total > 0 ? fill(t.dashboard.finishedOf, { finished: progress.finished, total: progress.total }) : t.module.empty}
        </p>
      </div>

      {moduleItems.length > 0 && (
        <>
          <div className="space-y-3">
            <FilterLinks
              label={t.module.filterKind}
              allLabel={t.module.all}
              param="category"
              options={CATEGORIES.map((value) => [value, t.category[value]])}
              current={category}
              other={{ status }}
            />
            <FilterLinks
              label={t.module.filterStatus}
              allLabel={t.module.all}
              param="status"
              options={STATUSES.map((value) => [value, t.status[value]])}
              current={status}
              other={{ category }}
            />
          </div>
          {groups.length > 0 ? (
            groups.map((group) => (
              <section key={group.id} aria-label={group.title}>
                <h2 className="font-heading text-xl font-bold text-primary">{group.title}</h2>
                <div className="mt-1">
                  {group.items.map((item) => (
                    <ItemRow key={item.id} item={item} locale={locale} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p className="text-muted-foreground">{t.module.noResults}</p>
          )}
        </>
      )}
    </main>
  );
}

export default function ModulePage(props: Props) {
  return (
    <Suspense fallback={<ModuleSkeleton />}>
      <ModuleContent {...props} />
    </Suspense>
  );
}

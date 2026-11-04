import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ItemRow } from "@/components/kurspool/item-row";
import { loadBatchData } from "@/lib/batch-data";
import { CATEGORY_LABELS, filterItems, groupByTopic, moduleProgress, STATUS_LABELS } from "@/lib/dashboard";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Modul · Kurspool" };

type Props = PageProps<"/modules/[id]">;

function FilterLinks({
  label,
  param,
  options,
  current,
  other,
}: {
  label: string;
  param: string;
  options: Record<string, string>;
  current?: string;
  other: Record<string, string | undefined>;
}) {
  const href = (value?: string) => {
    const query = new URLSearchParams(
      Object.entries({ ...other, [param]: value }).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return query ? `?${query}` : "?";
  };
  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-md px-3 text-sm ${active ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"}`;

  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Link href={href()} aria-current={!current ? "true" : undefined} className={chip(!current)}>
          Alle
        </Link>
        {Object.entries(options).map(([value, text]) => (
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
  const { id } = await params;
  const query = await searchParams;
  const category = typeof query.category === "string" && query.category in CATEGORY_LABELS ? query.category : undefined;
  const status = typeof query.status === "string" && query.status in STATUS_LABELS ? query.status : undefined;

  const { modules, topics, items } = await loadBatchData(membership);
  const moduleRow = modules.find((candidate) => candidate.id === id);
  if (!moduleRow) notFound();

  const moduleItems = items.filter((item) => item.module_id === id);
  const progress = moduleProgress(moduleItems);
  const visible = filterItems(moduleItems, { category, status });
  const groups = groupByTopic(visible, topics.filter((topic) => topic.module_id === id));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <Link href="/dashboard" className="text-sm underline underline-offset-4">
          Zur Übersicht
        </Link>
        <h1 className="font-heading mt-2 text-3xl font-bold text-primary">{moduleRow.title}</h1>
        <p className="mt-1 text-muted-foreground">
          {progress.total > 0 ? `${progress.finished} von ${progress.total} erledigt` : "In diesem Modul gibt es noch kein Material."}
        </p>
      </div>

      {moduleItems.length > 0 && (
        <>
          <div className="space-y-3">
            <FilterLinks label="Art" param="category" options={CATEGORY_LABELS} current={category} other={{ status }} />
            <FilterLinks label="Status" param="status" options={STATUS_LABELS} current={status} other={{ category }} />
          </div>
          {groups.length > 0 ? (
            groups.map((group) => (
              <section key={group.id} aria-label={group.title}>
                <h2 className="font-heading text-xl font-bold text-primary">{group.title}</h2>
                <div className="mt-1">
                  {group.items.map((item) => (
                    <ItemRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p className="text-muted-foreground">Keine Einträge für diese Auswahl. Wähle bei Art oder Status „Alle“.</p>
          )}
        </>
      )}
    </main>
  );
}

export default function ModulePage(props: Props) {
  return (
    <Suspense fallback={<p className="p-4 text-muted-foreground">Wird geladen …</p>}>
      <ModuleContent {...props} />
    </Suspense>
  );
}

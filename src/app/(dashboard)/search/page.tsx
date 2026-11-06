import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SearchSkeleton } from "@/components/kurspool/skeletons";
import { ItemRow } from "@/components/kurspool/item-row";
import { loadBatchData } from "@/lib/batch-data";
import { searchItems } from "@/lib/dashboard";
import { fill } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Kurspool" };

async function SearchContent({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { locale, t } = await getDictionary();
  const raw = (await searchParams).q;
  const query = typeof raw === "string" ? raw.trim() : "";

  const { modules, items } = await loadBatchData(membership);
  const results = searchItems(items, query);
  const titleOf = new Map(modules.map((module) => [module.id, module.title]));

  return (
    <main className="animate-in fade-in duration-300 motion-reduce:animate-none w-full space-y-4 px-4 md:px-6 xl:px-10 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary">{t.search.title}</h1>
      {query.length < 2 ? (
        <p className="text-muted-foreground">{t.search.hint}</p>
      ) : results.length === 0 ? (
        <p className="text-muted-foreground">{fill(t.search.none, { query })}</p>
      ) : (
        <>
          <p role="status" className="text-muted-foreground">
            {fill(t.search.results, { count: results.length, query })}
          </p>
          <div>
            {results.map((item) => (
              <ItemRow key={item.id} item={item} locale={locale} moduleTitle={titleOf.get(item.module_id)} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}

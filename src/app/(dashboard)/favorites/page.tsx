import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ItemRow } from "@/components/kurspool/item-row";
import { NoteGrid, type NoteView } from "@/components/kurspool/notes-list";
import { SearchSkeleton } from "@/components/kurspool/skeletons";
import { loadBatchData } from "@/lib/batch-data";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Kurspool" };

async function FavoritesContent() {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { locale, t: all } = await getDictionary();
  const t = all.favorites;

  const [{ modules, items }, notes] = await Promise.all([
    loadBatchData(membership),
    membership.supabase
      .from("notes")
      .select("id, title, body, item_id, starred, updated_at, item:items(id, title, module_id)")
      .eq("user_id", membership.user.id)
      .eq("starred", true)
      .order("updated_at", { ascending: false }),
  ]);
  const titleOf = new Map(modules.map((module) => [module.id, module.title]));
  const starredItems = items.filter((item) => item.favorite);

  return (
    <main className="animate-in fade-in duration-300 motion-reduce:animate-none w-full space-y-8 px-4 md:px-6 xl:px-10 py-8">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold text-primary">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </div>
      <div className="grid items-start gap-8 xl:grid-cols-2">
      <section aria-labelledby="favorite-items" className="space-y-2">
        <h2 id="favorite-items" className="font-heading text-xl font-bold text-primary">
          {t.items}
        </h2>
        {starredItems.length ? (
          <div>
            {starredItems.map((item) => (
              <ItemRow key={item.id} item={item} locale={locale} moduleTitle={titleOf.get(item.module_id)} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">{t.emptyItems}</p>
        )}
      </section>
      <section aria-labelledby="favorite-notes" className="space-y-2">
        <h2 id="favorite-notes" className="font-heading text-xl font-bold text-primary">
          {t.notes}
        </h2>
        <NoteGrid notes={(notes.data ?? []) as unknown as NoteView[]} empty={t.emptyNotes} locale={locale} />
      </section>
      </div>
    </main>
  );
}

export default function FavoritesPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <FavoritesContent />
    </Suspense>
  );
}

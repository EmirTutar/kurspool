import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NewNote, NotesList, type NoteView } from "@/components/kurspool/notes-list";
import { SearchSkeleton } from "@/components/kurspool/skeletons";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Kurspool" };

async function NotesContent() {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { locale, t: all } = await getDictionary();
  const t = all.notes;

  const { data } = await membership.supabase
    .from("notes")
    .select("id, title, body, item_id, starred, updated_at, item:items(id, title, module_id)")
    .eq("user_id", membership.user.id)
    .order("updated_at", { ascending: false });
  const notes = (data ?? []) as unknown as NoteView[];

  return (
    <main className="animate-in fade-in duration-300 motion-reduce:animate-none mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold text-primary">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </div>
      <NewNote locale={locale} />
      <NotesList notes={notes} locale={locale} />
    </main>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <NotesContent />
    </Suspense>
  );
}

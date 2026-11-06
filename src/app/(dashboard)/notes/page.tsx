import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { addNote } from "@/app/(dashboard)/actions";
import { ActionForm } from "@/components/kurspool/action-form";
import { NotesList, type NoteView } from "@/components/kurspool/notes-list";
import { SearchSkeleton } from "@/components/kurspool/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    .select("id, title, body, item_id, updated_at, item:items(id, title, module_id)")
    .eq("user_id", membership.user.id)
    .order("updated_at", { ascending: false });
  const notes = (data ?? []) as unknown as NoteView[];

  return (
    <main className="animate-in fade-in duration-300 motion-reduce:animate-none mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold text-primary">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t.new}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={addNote} resetOnSuccess className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="note-title">{t.titleLabel}</Label>
              <Input id="note-title" name="title" maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="note-body">{t.bodyLabel}</Label>
              <Textarea id="note-body" name="body" maxLength={10000} className="min-h-28" />
            </div>
            <Button type="submit">{t.add}</Button>
          </ActionForm>
        </CardContent>
      </Card>
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

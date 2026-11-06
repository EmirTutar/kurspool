"use client";

import { BookOpen, StickyNote } from "lucide-react";
import Link from "next/link";
import { deleteNote, updateNote } from "@/app/(dashboard)/actions";
import { ActionForm } from "@/components/kurspool/action-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { displayTitle, splitLinks } from "@/lib/dashboard";
import { dictionaries, fill, formatDate, type Locale } from "@/lib/i18n";

export type NoteView = {
  id: string;
  title: string | null;
  body: string;
  item_id: string | null;
  updated_at: string;
  item: { id: string; title: string; module_id: string } | null;
};

function NoteCard({ note, locale }: { note: NoteView; locale: Locale }) {
  const t = dictionaries[locale].notes;
  const linked = note.item_id !== null;
  const heading = note.title || (note.item ? displayTitle(note.item.title) : t.untitled);

  return (
    <Card size="sm" className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          {linked ? (
            <Badge variant="secondary">
              <BookOpen aria-hidden />
              {t.material}
            </Badge>
          ) : (
            <Badge variant="outline">
              <StickyNote aria-hidden />
              {t.ownBadge}
            </Badge>
          )}
          <CardDescription>{fill(t.updated, { date: formatDate(locale, note.updated_at, true) })}</CardDescription>
        </div>
        <CardTitle className="break-words">{heading}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {note.body && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {splitLinks(note.body).map((part, index) =>
              part.href ? (
                <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                  {part.text}
                </a>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </p>
        )}
        {linked && !note.item && <p className="text-sm text-muted-foreground">{t.hiddenItem}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {note.item && (
            <Link href={`/modules/${note.item.module_id}#item-${note.item.id}`} className={buttonVariants({ variant: "outline" })}>
              {t.openMaterial}
              <span className="sr-only">: {heading}</span>
            </Link>
          )}
          <Collapsible className="contents">
            <CollapsibleTrigger className={buttonVariants({ variant: "ghost" })}>
              {t.edit}
              <span className="sr-only">: {heading}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="w-full">
              <ActionForm action={updateNote} className="mt-2 space-y-2">
                <input type="hidden" name="noteId" value={note.id} />
                {!linked && (
                  <div className="space-y-1">
                    <Label htmlFor={`title-${note.id}`}>{t.titleLabel}</Label>
                    <Input id={`title-${note.id}`} name="title" defaultValue={note.title ?? ""} maxLength={200} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor={`body-${note.id}`}>{t.bodyLabel}</Label>
                  <Textarea id={`body-${note.id}`} name="body" defaultValue={note.body} maxLength={10000} className="min-h-28" />
                </div>
                <Button type="submit">{t.save}</Button>
              </ActionForm>
            </CollapsibleContent>
          </Collapsible>
          <ActionForm action={deleteNote}>
            <input type="hidden" name="noteId" value={note.id} />
            <Button type="submit" variant="ghost" className="text-destructive hover:text-destructive">
              {t.delete}
              <span className="sr-only">: {heading}</span>
            </Button>
          </ActionForm>
        </div>
      </CardContent>
    </Card>
  );
}

function NoteGrid({ notes, empty, locale }: { notes: NoteView[]; empty: string; locale: Locale }) {
  if (!notes.length) return <p className="py-6 text-muted-foreground">{empty}</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} locale={locale} />
      ))}
    </div>
  );
}

export function NotesList({ notes, locale }: { notes: NoteView[]; locale: Locale }) {
  const t = dictionaries[locale].notes;
  const linked = notes.filter((note) => note.item_id !== null);
  const own = notes.filter((note) => note.item_id === null);

  return (
    <Tabs defaultValue="all" className="gap-4">
      <TabsList>
        <TabsTrigger value="all">{fill(t.all, { count: notes.length })}</TabsTrigger>
        <TabsTrigger value="linked">{fill(t.linked, { count: linked.length })}</TabsTrigger>
        <TabsTrigger value="own">{fill(t.own, { count: own.length })}</TabsTrigger>
      </TabsList>
      <TabsContent value="all">
        <NoteGrid notes={notes} empty={t.empty} locale={locale} />
      </TabsContent>
      <TabsContent value="linked">
        <NoteGrid notes={linked} empty={t.emptyLinked} locale={locale} />
      </TabsContent>
      <TabsContent value="own">
        <NoteGrid notes={own} empty={t.emptyOwn} locale={locale} />
      </TabsContent>
    </Tabs>
  );
}

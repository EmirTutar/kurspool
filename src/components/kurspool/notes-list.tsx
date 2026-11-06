"use client";

import { BookOpen, StickyNote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { deleteNote, saveNote, setNoteStar } from "@/app/(dashboard)/actions";
import { ActionForm } from "@/components/kurspool/action-form";
import { AutosaveStatus } from "@/components/kurspool/autosave-status";
import { FavoriteToggle } from "@/components/kurspool/favorite-toggle";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/use-autosave";
import { displayTitle, splitLinks } from "@/lib/dashboard";
import { dictionaries, fill, formatDate, type Locale } from "@/lib/i18n";
import { runAction } from "@/lib/run-action";

export type NoteView = {
  id: string;
  title: string | null;
  body: string;
  item_id: string | null;
  starred: boolean;
  updated_at: string;
  item: { id: string; title: string; module_id: string } | null;
};

function LinkedText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {splitLinks(text).map((part, index) =>
        part.href ? (
          <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

/** Title and text fields that save themselves. Without an id, the first save creates the note. */
function NoteFields({
  noteId,
  linked,
  title,
  body,
  locale,
  onCreated,
  fieldPrefix,
}: {
  noteId: string | null;
  linked: boolean;
  title: string;
  body: string;
  locale: Locale;
  onCreated?: (id: string) => void;
  fieldPrefix: string;
}) {
  const t = dictionaries[locale].notes;
  const titleField = useRef<HTMLInputElement>(null);
  const bodyField = useRef<HTMLTextAreaElement>(null);
  const id = useRef(noteId);
  const { state, schedule, flush } = useAutosave(async () => {
    const result = await runAction(() =>
      saveNote({ id: id.current, title: titleField.current?.value ?? "", body: bodyField.current?.value ?? "" }),
    );
    if (result.ok && "id" in result && result.id && !id.current) {
      id.current = result.id;
      onCreated?.(result.id);
    }
    return result.ok;
  });

  return (
    <div className="space-y-2">
      {!linked && (
        <div className="space-y-1">
          <Label htmlFor={`${fieldPrefix}-title`}>{t.titleLabel}</Label>
          <Input ref={titleField} id={`${fieldPrefix}-title`} defaultValue={title} maxLength={200} onChange={schedule} onBlur={() => void flush()} />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor={`${fieldPrefix}-body`}>{t.bodyLabel}</Label>
        <Textarea
          ref={bodyField}
          id={`${fieldPrefix}-body`}
          defaultValue={body}
          maxLength={10000}
          className="min-h-28"
          onChange={schedule}
          onBlur={() => void flush()}
        />
      </div>
      <AutosaveStatus state={state} locale={locale} />
    </div>
  );
}

/** Writing a new note. It is saved while typing, and "Done" starts a fresh one. */
export function NewNote({ locale }: { locale: Locale }) {
  const t = dictionaries[locale].notes;
  const router = useRouter();
  const [round, setRound] = useState(0);
  const [created, setCreated] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t.new}</h2>
        </CardTitle>
        <CardDescription>{t.newHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <NoteFields
          key={round}
          noteId={null}
          linked={false}
          title=""
          body=""
          locale={locale}
          fieldPrefix={`new-${round}`}
          onCreated={() => {
            setCreated(true);
            router.refresh();
          }}
        />
        {created && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              // Moving focus out of the fields saves anything still waiting before the fields are cleared.
              (document.activeElement as HTMLElement | null)?.blur();
              setCreated(false);
              setRound((value) => value + 1);
              router.refresh();
            }}
          >
            {t.done}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function NoteCard({ note, locale }: { note: NoteView; locale: Locale }) {
  const t = dictionaries[locale].notes;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const linked = note.item_id !== null;
  const heading = note.title || (note.item ? displayTitle(note.item.title) : t.untitled);

  return (
    <Card size="sm" className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
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
          <FavoriteToggle starred={note.starred} label={`${t.favorite}: ${heading}`} onChange={(on) => setNoteStar(note.id, on)} />
        </div>
        <CardTitle className="break-words">{heading}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <div className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            <NoteFields
              noteId={note.id}
              linked={linked}
              title={note.title ?? ""}
              body={note.body}
              locale={locale}
              fieldPrefix={`note-${note.id}`}
            />
          </div>
        ) : (
          note.body && <LinkedText text={note.body} />
        )}
        {linked && !note.item && <p className="text-sm text-muted-foreground">{t.hiddenItem}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {note.item && (
            <Link href={`/modules/${note.item.module_id}#item-${note.item.id}`} className={buttonVariants({ variant: "outline" })}>
              {t.openMaterial}
              <span className="sr-only">: {heading}</span>
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            aria-expanded={editing}
            onClick={() => {
              if (editing) router.refresh();
              setEditing(!editing);
            }}
          >
            {editing ? t.done : t.edit}
            <span className="sr-only">: {heading}</span>
          </Button>
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

export function NoteGrid({ notes, empty, locale }: { notes: NoteView[]; empty: string; locale: Locale }) {
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
  const starred = notes.filter((note) => note.starred);

  return (
    <Tabs defaultValue="all" className="gap-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="all">{fill(t.all, { count: notes.length })}</TabsTrigger>
        <TabsTrigger value="linked">{fill(t.linked, { count: linked.length })}</TabsTrigger>
        <TabsTrigger value="own">{fill(t.own, { count: own.length })}</TabsTrigger>
        <TabsTrigger value="starred">{fill(t.starred, { count: starred.length })}</TabsTrigger>
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
      <TabsContent value="starred">
        <NoteGrid notes={starred} empty={t.emptyStarred} locale={locale} />
      </TabsContent>
    </Tabs>
  );
}

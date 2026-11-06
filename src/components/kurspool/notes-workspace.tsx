"use client";

import { BookOpen, ChevronLeft, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteNote, saveNote, setNoteStar } from "@/app/(dashboard)/actions";
import { AutosaveStatus } from "@/components/kurspool/autosave-status";
import { ConfirmDelete } from "@/components/kurspool/confirm-delete";
import { FavoriteToggle } from "@/components/kurspool/favorite-toggle";
import { Markdown, plainSnippet } from "@/components/kurspool/markdown";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/use-autosave";
import { dictionaries, fill, formatDate, type Locale } from "@/lib/i18n";
import { noteHeading, type NoteView } from "@/lib/notes";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";

type Filter = "all" | "linked" | "own" | "starred";

const FILTERS: Record<Filter, (note: NoteView) => boolean> = {
  all: () => true,
  linked: (note) => note.item_id !== null,
  own: (note) => note.item_id === null,
  starred: (note) => note.starred,
};

/** The open note on the right. Without a note it is a fresh, untitled one that's created on the first save. */
function NoteEditor({
  note,
  locale,
  onSaved,
  onDeleted,
  onBack,
}: {
  note: NoteView | null;
  locale: Locale;
  onSaved: (note: NoteView) => void;
  onDeleted: (id: string) => void;
  onBack: () => void;
}) {
  const t = dictionaries[locale].notes;
  const [id, setId] = useState(note?.id ?? null);
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [starred, setStarred] = useState(note?.starred ?? false);
  // The save runs later, so it reads the newest text from here rather than from the render it was scheduled in.
  const latest = useRef({ id, title, body });
  useEffect(() => {
    latest.current = { id, title, body };
  }, [id, title, body]);
  const linked = Boolean(note?.item_id);
  const heading = noteHeading({ title, item: note?.item ?? null }, t.untitled);

  const { state, schedule, flush } = useAutosave(async () => {
    const current = latest.current;
    const result = await runAction(() => saveNote({ id: current.id, title: current.title, body: current.body }));
    if (!result.ok) return false;
    const newId = "id" in result && result.id ? result.id : current.id;
    if (newId && newId !== current.id) {
      latest.current = { ...latest.current, id: newId };
      setId(newId);
    }
    if (newId) {
      onSaved({
        id: newId,
        title: current.title.trim() || null,
        body: current.body.trim(),
        item_id: note?.item_id ?? null,
        item: note?.item ?? null,
        starred,
        updated_at: new Date().toISOString(),
      });
    }
    return true;
  });

  return (
    <Card className="gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
          <ChevronLeft aria-hidden />
          {t.backToList}
        </Button>
        {linked && (
          <Badge variant="secondary">
            <BookOpen aria-hidden />
            {t.material}
          </Badge>
        )}
        {note?.item && (
          <Link href={`/modules/${note.item.module_id}#item-${note.item.id}`} className={buttonVariants({ variant: "link", size: "sm" })}>
            {t.openMaterial}
          </Link>
        )}
        <div className="ml-auto flex items-center gap-1">
          {id && (
            <FavoriteToggle
              key={id}
              starred={starred}
              label={`${t.favorite}: ${heading}`}
              onChange={async (on) => {
                const result = await setNoteStar(id, on);
                if (result.ok) {
                  setStarred(on);
                  onSaved({ id, title: title.trim() || null, body: body.trim(), item_id: note?.item_id ?? null, item: note?.item ?? null, starred: on, updated_at: new Date().toISOString() });
                }
                return result;
              }}
            />
          )}
          {id && (
            <ConfirmDelete
              label={`${t.delete}: ${heading}`}
              title={t.confirmTitle}
              description={fill(t.confirmBody, { title: heading })}
              locale={locale}
              onConfirm={async () => {
                const result = await deleteNote(id);
                if (result.ok) onDeleted(id);
                return result;
              }}
            />
          )}
        </div>
      </div>

      {linked ? (
        <h2 className="font-heading text-2xl font-bold text-primary">{heading}</h2>
      ) : (
        <Input
          aria-label={t.titleField}
          placeholder={t.untitled}
          value={title}
          maxLength={200}
          onChange={(event) => {
            setTitle(event.target.value);
            schedule();
          }}
          onBlur={() => void flush()}
          className="h-auto border-0 bg-transparent px-0 font-heading text-2xl font-bold text-primary shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
        />
      )}

      <Tabs defaultValue="write" className="gap-3">
        <TabsList>
          <TabsTrigger value="write">{t.write}</TabsTrigger>
          <TabsTrigger value="preview">{t.preview}</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            aria-label={t.bodyLabel}
            value={body}
            maxLength={10000}
            placeholder={t.bodyPlaceholder}
            onChange={(event) => {
              setBody(event.target.value);
              schedule();
            }}
            onBlur={() => void flush()}
            className="min-h-[50vh] font-mono text-sm leading-relaxed"
          />
        </TabsContent>
        <TabsContent value="preview" className="min-h-[50vh] rounded-lg border border-border p-4">
          {body.trim() ? <Markdown text={body} /> : <p className="text-sm text-muted-foreground">{t.emptyPreview}</p>}
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AutosaveStatus state={state} locale={locale} />
        <p className="text-xs text-muted-foreground">{t.markdownHint}</p>
      </div>
    </Card>
  );
}

/** A list of notes on the left and the open note on the right. On a phone, one of the two at a time. */
export function NotesWorkspace({ initialNotes, initialId, locale }: { initialNotes: NoteView[]; initialId: string | null; locale: Locale }) {
  const t = dictionaries[locale].notes;
  const [notes, setNotes] = useState(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes.some((note) => note.id === initialId) ? initialId : null);
  const [editorKey, setEditorKey] = useState(selectedId ?? "new-0");
  const [filter, setFilter] = useState<Filter>("all");
  const [showEditor, setShowEditor] = useState(Boolean(selectedId));
  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const shown = notes.filter(FILTERS[filter]);
  const count = (key: Filter) => notes.filter(FILTERS[key]).length;

  const remember = (id: string | null) => {
    window.history.replaceState(null, "", id ? `/notes?note=${id}` : "/notes");
  };
  const open = (id: string) => {
    setSelectedId(id);
    setEditorKey(id);
    setShowEditor(true);
    remember(id);
  };
  const startNew = () => {
    setSelectedId(null);
    setEditorKey(`new-${Date.now()}`);
    setShowEditor(true);
    remember(null);
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
      <aside aria-label={t.list} className={cn("space-y-3 lg:sticky lg:top-20", showEditor && "hidden lg:block")}>
        <Button type="button" className="w-full" onClick={startNew}>
          <Plus aria-hidden />
          {t.new}
        </Button>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList className="h-auto w-full flex-wrap">
            <TabsTrigger value="all">{fill(t.all, { count: count("all") })}</TabsTrigger>
            <TabsTrigger value="linked">{fill(t.linked, { count: count("linked") })}</TabsTrigger>
            <TabsTrigger value="own">{fill(t.own, { count: count("own") })}</TabsTrigger>
            <TabsTrigger value="starred">{fill(t.starred, { count: count("starred") })}</TabsTrigger>
          </TabsList>
        </Tabs>
        {shown.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            {{ all: t.empty, linked: t.emptyLinked, own: t.emptyOwn, starred: t.emptyStarred }[filter]}
          </p>
        ) : (
          <ul className="space-y-1">
            {shown.map((note) => {
              const active = note.id === selectedId;
              const heading = noteHeading(note, t.untitled);
              return (
                <li key={note.id} className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => open(note.id)}
                    className={cn(
                      "w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                      active && "border-border bg-card shadow-sm",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {note.item_id && <BookOpen aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
                      <span className="truncate font-medium">{heading}</span>
                      {note.starred && <Star aria-hidden className="ml-auto size-3.5 shrink-0 fill-current text-amber-500" />}
                    </span>
                    {note.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{plainSnippet(note.body)}</span>}
                    <span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(locale, note.updated_at, true)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section aria-label={t.editor} className={cn("min-w-0", !showEditor && "hidden lg:block")}>
        <NoteEditor
          key={editorKey}
          note={selected}
          locale={locale}
          onBack={() => setShowEditor(false)}
          onSaved={(saved) => {
            setNotes((current) =>
              current.some((note) => note.id === saved.id) ? current.map((note) => (note.id === saved.id ? saved : note)) : [saved, ...current],
            );
            // A new note keeps its editor; only the selection and the address follow it.
            if (saved.id !== selectedId) {
              setSelectedId(saved.id);
              remember(saved.id);
            }
          }}
          onDeleted={(id) => {
            setNotes((current) => current.filter((note) => note.id !== id));
            startNew();
          }}
        />
      </section>
    </div>
  );
}

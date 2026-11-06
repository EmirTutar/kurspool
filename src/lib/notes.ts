import { displayTitle } from "@/lib/dashboard";

export type NoteView = {
  id: string;
  title: string | null;
  body: string;
  item_id: string | null;
  starred: boolean;
  updated_at: string;
  item: { id: string; title: string; module_id: string } | null;
};

/** A note's own title, else the title of its course item, else the fallback. */
export function noteHeading(note: Pick<NoteView, "title" | "item">, untitled: string): string {
  return note.title || (note.item ? displayTitle(note.item.title) : untitled);
}

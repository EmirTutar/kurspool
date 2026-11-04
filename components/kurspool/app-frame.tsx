import {
  CalendarDays,
  CircleOff,
  Code,
  FileText,
  GraduationCap,
  Layout,
  Link as LinkIcon,
  MessageSquare,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getMembership } from "@/lib/membership";

const ICONS: Record<string, LucideIcon> = {
  classroom: GraduationCap,
  calendar: CalendarDays,
  document: FileText,
  absence: CircleOff,
  chat: MessageSquare,
  video: Video,
  code: Code,
  board: Layout,
};

type LinkRow = { id: string; label: string; url: string; icon: string | null };

function iconFor(link: LinkRow): LucideIcon {
  if (link.icon && ICONS[link.icon]) return ICONS[link.icon];
  return /miro/i.test(link.label) ? Layout : LinkIcon;
}

export async function AppFrame({ children }: { children: ReactNode }) {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { supabase, user, role, batchId } = membership;

  const [batch, quickLinks, userLinks] = await Promise.all([
    supabase.from("batches").select("name").eq("id", batchId).single(),
    supabase.from("quick_links").select("id, label, url, icon").order("position"),
    supabase.from("user_links").select("id, label, url, icon").eq("user_id", user.id).order("position"),
  ]);
  const links = [...((quickLinks.data ?? []) as LinkRow[]), ...((userLinks.data ?? []) as LinkRow[])];

  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="min-w-0">
            <span className="font-heading block text-xl font-bold leading-tight text-primary">Kurspool</span>
            <span className="block truncate text-sm text-muted-foreground">{batch.data?.name}</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Hauptnavigation">
            <Link href="/dashboard" className="underline-offset-4 hover:underline">
              Übersicht
            </Link>
            <Link href="/settings" className="underline-offset-4 hover:underline">
              Meine Links
            </Link>
            {role === "maintainer" && (
              <Link href="/maintainer" className="underline-offset-4 hover:underline">
                Betreuung
              </Link>
            )}
            <form action="/auth/signout" method="post">
              <button type="submit" className="min-h-9 underline-offset-4 hover:underline">
                Abmelden
              </button>
            </form>
          </nav>
        </div>
        {links.length > 0 && (
          <nav aria-label="Kurslinks" className="border-t border-border">
            <ul className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-4 py-3">
              {links.map((link) => {
                const Icon = iconFor(link);
                return (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-md bg-secondary px-3 text-sm font-medium text-primary hover:bg-accent"
                    >
                      <Icon aria-hidden className="size-4" />
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>
      {children}
    </>
  );
}

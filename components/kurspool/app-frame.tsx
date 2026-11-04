import {
  CalendarDays,
  CircleOff,
  Code,
  FileText,
  GraduationCap,
  Layout,
  Link as LinkIcon,
  MessageSquare,
  Search,
  Video,
  type LucideIcon,
} from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { setLocale } from "@/app/(dashboard)/actions";
import { DocumentLanguage, ThemeToggle } from "@/components/kurspool/providers";
import { getDictionary } from "@/lib/i18n-server";
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

const navLink = "inline-block py-1.5 underline-offset-4 hover:underline";

export async function AppFrame({ children }: { children: ReactNode }) {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { supabase, user, role, batchId } = membership;
  const { locale, t } = await getDictionary();

  const [batch, quickLinks, userLinks] = await Promise.all([
    supabase.from("batches").select("name").eq("id", batchId).single(),
    supabase.from("quick_links").select("id, label, url, icon").order("position"),
    supabase.from("user_links").select("id, label, url, icon").eq("user_id", user.id).order("position"),
  ]);
  const links = [...((quickLinks.data ?? []) as LinkRow[]), ...((userLinks.data ?? []) as LinkRow[])];

  return (
    <>
      <DocumentLanguage locale={locale} />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="min-w-0">
            <span className="block font-heading text-xl font-bold leading-tight text-primary">Kurspool</span>
            <span className="block truncate text-sm text-muted-foreground">{batch.data?.name}</span>
          </Link>
          <Form action="/search" role="search" className="order-last flex w-full items-center gap-2 sm:order-none sm:w-64">
            <div className="relative w-full">
              <Search aria-hidden className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                type="search"
                aria-label={t.nav.search}
                placeholder={t.nav.searchPlaceholder}
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm"
              />
            </div>
          </Form>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label={t.nav.main}>
            <Link href="/dashboard" className={navLink}>
              {t.nav.overview}
            </Link>
            <Link href="/settings" className={navLink}>
              {t.nav.settings}
            </Link>
            {role === "maintainer" && (
              <Link href="/maintainer" className={navLink}>
                {t.nav.maintainer}
              </Link>
            )}
            <form action={setLocale}>
              <input type="hidden" name="locale" value={locale === "de" ? "en" : "de"} />
              <button type="submit" lang={locale === "de" ? "en" : "de"} className={navLink}>
                {t.nav.language}
              </button>
            </form>
            <ThemeToggle label={t.nav.theme} />
            <form action="/auth/signout" method="post">
              <button type="submit" className={navLink}>
                {t.nav.signOut}
              </button>
            </form>
          </nav>
        </div>
        {links.length > 0 && (
          <nav aria-label={t.nav.links} className="border-t border-border">
            <ul className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:flex-wrap sm:overflow-visible">
              {links.map((link) => {
                const Icon = iconFor(link);
                return (
                  <li key={link.id} className="shrink-0">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-accent"
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

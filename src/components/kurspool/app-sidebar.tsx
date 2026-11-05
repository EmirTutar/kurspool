"use client";

import {
  CalendarDays,
  CircleOff,
  Code,
  FileText,
  GraduationCap,
  Languages,
  Layout,
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sun,
  UserCog,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { setLocale } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { dictionaries, type Locale } from "@/lib/i18n";

const LINK_ICONS: Record<string, LucideIcon> = {
  classroom: GraduationCap,
  calendar: CalendarDays,
  document: FileText,
  absence: CircleOff,
  chat: MessageSquare,
  video: Video,
  code: Code,
  board: Layout,
};

export type SidebarLink = { id: string; label: string; url: string; icon: string | null };

function iconFor(link: SidebarLink): LucideIcon {
  if (link.icon && LINK_ICONS[link.icon]) return LINK_ICONS[link.icon];
  return /miro/i.test(link.label) ? Layout : LinkIcon;
}

/** The three-line button that opens and closes the sidebar. */
export function SidebarToggle({ label }: { label: string }) {
  const { toggleSidebar, open, openMobile, isMobile } = useSidebar();
  return (
    <Button type="button" variant="ghost" size="icon-lg" aria-label={label} aria-expanded={isMobile ? openMobile : open} onClick={toggleSidebar}>
      <Menu aria-hidden className="size-5" />
    </Button>
  );
}

export function AppSidebar({
  batchName,
  isMaintainer,
  links,
  locale,
}: {
  batchName: string;
  isMaintainer: boolean;
  links: SidebarLink[];
  locale: Locale;
}) {
  const t = dictionaries[locale].nav;
  const pathname = usePathname();
  const { setOpen, setOpenMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const searchRef = useRef<HTMLInputElement>(null);
  const closeOnPhone = () => setOpenMobile(false);

  const pages = [
    { href: "/dashboard", label: t.overview, icon: LayoutDashboard, active: pathname === "/dashboard" || pathname.startsWith("/modules") },
    { href: "/calendar", label: t.calendar, icon: CalendarDays, active: pathname === "/calendar" },
    { href: "/settings", label: t.settings, icon: Settings, active: pathname === "/settings" },
    ...(isMaintainer ? [{ href: "/maintainer", label: t.maintainer, icon: UserCog, active: pathname === "/maintainer" }] : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" onClick={closeOnPhone} />}>
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary font-heading font-bold text-sidebar-primary-foreground">
                K
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-heading font-bold">Kurspool</span>
                <span className="truncate text-xs text-muted-foreground">{batchName}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
            <SidebarMenuButton
              tooltip={t.search}
              onClick={() => {
                setOpen(true);
                window.setTimeout(() => searchRef.current?.focus(), 250);
              }}
            >
              <Search aria-hidden />
              <span>{t.search}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Form action="/search" role="search" onSubmit={closeOnPhone} className="relative group-data-[collapsible=icon]:hidden">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput ref={searchRef} name="q" type="search" aria-label={t.search} placeholder={t.searchPlaceholder} className="pl-8" />
        </Form>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label={t.main}>
              <SidebarMenu>
                {pages.map((page) => (
                  <SidebarMenuItem key={page.href}>
                    <SidebarMenuButton isActive={page.active} tooltip={page.label} render={<Link href={page.href} onClick={closeOnPhone} />}>
                      <page.icon aria-hidden />
                      <span>{page.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>

        {links.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t.links}</SidebarGroupLabel>
            <SidebarGroupContent>
              <nav aria-label={t.links}>
                <SidebarMenu>
                  {links.map((link) => {
                    const Icon = iconFor(link);
                    return (
                      <SidebarMenuItem key={link.id}>
                        <SidebarMenuButton
                          tooltip={link.label}
                          render={<a href={link.url} target="_blank" rel="noopener noreferrer" onClick={closeOnPhone} />}
                        >
                          <Icon aria-hidden />
                          <span>{link.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={setLocale}>
              <input type="hidden" name="locale" value={locale === "de" ? "en" : "de"} />
              <SidebarMenuButton type="submit" tooltip={t.language} lang={locale === "de" ? "en" : "de"}>
                <Languages aria-hidden />
                <span>{t.language}</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t.theme} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun aria-hidden className="hidden dark:block" />
              <Moon aria-hidden className="dark:hidden" />
              <span>{t.theme}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action="/auth/signout" method="post">
              <SidebarMenuButton type="submit" tooltip={t.signOut}>
                <LogOut aria-hidden />
                <span>{t.signOut}</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

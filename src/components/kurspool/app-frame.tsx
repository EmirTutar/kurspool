import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar, SidebarToggle, type SidebarLink } from "@/components/kurspool/app-sidebar";
import { DocumentLanguage } from "@/components/kurspool/providers";
import { SiteFooter } from "@/components/kurspool/site-footer";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";
import { getContactEmailForMember } from "@/lib/site";

export async function AppFrame({ children }: { children: ReactNode }) {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { supabase, user, role, batchId } = membership;
  const { locale, t } = await getDictionary();

  const [batch, quickLinks, userLinks, contactEmail, cookieStore] = await Promise.all([
    supabase.from("batches").select("name").eq("id", batchId).single(),
    supabase.from("quick_links").select("id, label, url, icon").order("position"),
    supabase.from("user_links").select("id, label, url, icon").eq("user_id", user.id).order("position"),
    getContactEmailForMember(),
    cookies(),
  ]);
  const links = [...((quickLinks.data ?? []) as SidebarLink[]), ...((userLinks.data ?? []) as SidebarLink[])];

  return (
    <SidebarProvider defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}>
      <DocumentLanguage locale={locale} />
      <AppSidebar batchName={batch.data?.name ?? ""} isMaintainer={role === "maintainer"} links={links} locale={locale} />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-background px-2">
          <SidebarToggle label={t.nav.toggleMenu} />
          <span className="font-heading font-bold text-primary md:hidden">Kurspool</span>
        </header>
        {children}
        <SiteFooter locale={locale} contactEmail={contactEmail} />
      </div>
    </SidebarProvider>
  );
}

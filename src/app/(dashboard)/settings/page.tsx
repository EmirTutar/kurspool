import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { addUserLink, deleteAccount, deleteUserLink } from "@/app/(dashboard)/actions";
import { ActionForm } from "@/components/kurspool/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Kurspool" };

async function SettingsContent() {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { t } = await getDictionary();
  const { data } = await membership.supabase
    .from("user_links")
    .select("id, label, url")
    .eq("user_id", membership.user.id)
    .order("position");
  const links = (data ?? []) as { id: string; label: string; url: string }[];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary">{t.settings.title}</h1>

      <section aria-labelledby="links-heading" className="space-y-4">
        <div>
          <h2 id="links-heading" className="font-heading text-xl font-bold text-primary">
            {t.settings.linksTitle}
          </h2>
          <p className="mt-1 text-muted-foreground">{t.settings.linksIntro}</p>
        </div>
        <ActionForm action={addUserLink} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="label">{t.settings.name}</Label>
            <Input id="label" name="label" required maxLength={60} defaultValue={links.length === 0 ? t.settings.defaultLinkName : ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="url">{t.settings.address}</Label>
            <Input id="url" name="url" required maxLength={2048} inputMode="url" placeholder="https://miro.com/app/board/…" />
          </div>
          <Button type="submit">{t.settings.addLink}</Button>
        </ActionForm>
        {links.length > 0 ? (
          <ul className="divide-y divide-border">
            {links.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 py-3">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-primary underline underline-offset-4">
                  {link.label}
                </a>
                <ActionForm action={deleteUserLink}>
                  <input type="hidden" name="linkId" value={link.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {t.settings.delete}
                    <span className="sr-only">: {link.label}</span>
                  </Button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t.settings.noLinks}</p>
        )}
      </section>

      <Separator />

      <section aria-labelledby="account-heading" className="space-y-3">
        <h2 id="account-heading" className="font-heading text-xl font-bold text-primary">
          {t.settings.accountTitle}
        </h2>
        <p className="max-w-prose text-muted-foreground">{t.settings.accountIntro}</p>
        <ActionForm action={deleteAccount} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="confirm">{t.settings.confirmLabel}</Label>
            <Input id="confirm" name="confirm" required autoComplete="off" />
          </div>
          <Button type="submit" variant="destructive">
            {t.settings.confirmButton}
          </Button>
        </ActionForm>
      </section>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
      <SettingsContent />
    </Suspense>
  );
}

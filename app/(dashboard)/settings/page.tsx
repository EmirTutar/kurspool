import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { addUserLink, deleteUserLink } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Meine Links · Kurspool" };

async function SettingsContent() {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { data } = await membership.supabase
    .from("user_links")
    .select("id, label, url")
    .eq("user_id", membership.user.id)
    .order("position");
  const links = (data ?? []) as { id: string; label: string; url: string }[];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-primary">Meine Links</h1>
        <p className="mt-1 text-muted-foreground">
          Diese Links erscheinen oben neben den Kurslinks. Nur du siehst sie, zum Beispiel dein eigenes Miro-Board.
        </p>
      </div>

      <form action={addUserLink} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="label">Name</Label>
          <Input id="label" name="label" required maxLength={60} defaultValue={links.length === 0 ? "Mein Miro-Board" : ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="url">Adresse</Label>
          <Input id="url" name="url" required maxLength={2048} inputMode="url" placeholder="https://miro.com/app/board/…" />
        </div>
        <Button type="submit">Link hinzufügen</Button>
      </form>

      {links.length > 0 ? (
        <ul className="divide-y divide-border">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-3 py-3">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 break-words text-primary underline underline-offset-4"
              >
                {link.label}
              </a>
              <form action={deleteUserLink}>
                <input type="hidden" name="linkId" value={link.id} />
                <Button type="submit" variant="outline" size="sm">
                  Löschen<span className="sr-only">: {link.label}</span>
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Du hast noch keine eigenen Links.</p>
      )}
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="p-4 text-muted-foreground">Wird geladen …</p>}>
      <SettingsContent />
    </Suspense>
  );
}

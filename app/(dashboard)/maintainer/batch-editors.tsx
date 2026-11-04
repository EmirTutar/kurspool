import { addAllowedEmail, addQuickLink, deleteQuickLink, removeAllowedEmail } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMembership } from "@/lib/membership";

type Membership = NonNullable<Awaited<ReturnType<typeof getMembership>>>;

export async function BatchEditors({ supabase, batchId, user }: Membership) {
  const [links, emails] = await Promise.all([
    supabase.from("quick_links").select("id, label, url").eq("batch_id", batchId).order("position"),
    supabase.from("batch_allowed_emails").select("email, role").eq("batch_id", batchId).order("email"),
  ]);
  const ownEmail = user.email?.toLowerCase();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Kurslinks</CardTitle>
          <CardDescription>Diese Buttons sehen alle im Batch oben auf jeder Seite.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addQuickLink} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="quick-label">Name</Label>
              <Input id="quick-label" name="label" required maxLength={60} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-url">Adresse</Label>
              <Input id="quick-url" name="url" required maxLength={2048} inputMode="url" />
            </div>
            <Button type="submit">Link hinzufügen</Button>
          </form>
          <ul className="divide-y divide-border text-sm">
            {(links.data ?? []).map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 break-words">{link.label}</span>
                <form action={deleteQuickLink}>
                  <input type="hidden" name="linkId" value={link.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Löschen<span className="sr-only">: {link.label}</span>
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Batch-Liste</CardTitle>
          <CardDescription>Nur diese Google-Konten können sich anmelden. Wer entfernt wird, verliert sofort den Zugang.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addAllowedEmail} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="allowed-email">E-Mail-Adresse</Label>
              <Input id="allowed-email" name="email" type="email" required />
            </div>
            <Button type="submit">Person freischalten</Button>
          </form>
          <ul className="divide-y divide-border text-sm">
            {(emails.data ?? []).map((row) => (
              <li key={row.email} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 break-words">
                  {row.email}
                  {row.role === "maintainer" && <span className="text-muted-foreground"> (Betreuung)</span>}
                </span>
                {row.email !== ownEmail && (
                  <form action={removeAllowedEmail}>
                    <input type="hidden" name="email" value={row.email} />
                    <Button type="submit" variant="outline" size="sm">
                      Entfernen<span className="sr-only">: {row.email}</span>
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

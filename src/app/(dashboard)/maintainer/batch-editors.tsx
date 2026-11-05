import { addAllowedEmail, addCalendar, addQuickLink, deleteQuickLink, removeAllowedEmail, removeCalendar } from "@/app/(dashboard)/actions";
import { ActionForm } from "@/components/kurspool/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fill, formatDate, type Dictionary, type Locale } from "@/lib/i18n";
import { getMembership } from "@/lib/membership";

type Membership = NonNullable<Awaited<ReturnType<typeof getMembership>>>;

export async function CalendarEditor({
  membership,
  locale,
  readOnly,
  t,
}: {
  membership: Membership;
  locale: Locale;
  readOnly: boolean;
  t: Dictionary["calendar"]["manage"];
}) {
  const { data } = await membership.supabase
    .from("calendars")
    .select("id, title, last_synced_at, last_error")
    .eq("batch_id", membership.batchId)
    .order("title");
  const calendars = (data ?? []) as { id: string; title: string; last_synced_at: string | null; last_error: string | null }[];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <ActionForm action={addCalendar} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="calendar-url">{t.address}</Label>
              {/* A password field, so the secret address isn't left readable on screen. */}
              <Input id="calendar-url" name="url" type="password" required maxLength={2048} autoComplete="off" />
            </div>
            <Button type="submit">{t.add}</Button>
          </ActionForm>
        )}
        <ul className="divide-y divide-border text-sm">
          {calendars.map((calendar) => (
            <li key={calendar.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0 space-y-0.5">
                <p className="break-words font-medium">{calendar.title}</p>
                <p className="text-muted-foreground">
                  {calendar.last_synced_at ? fill(t.lastRead, { date: formatDate(locale, calendar.last_synced_at, true) }) : t.neverRead}
                </p>
                {calendar.last_error && (
                  <p className="text-destructive">{t.errors[calendar.last_error as keyof typeof t.errors] ?? calendar.last_error}</p>
                )}
              </div>
              {!readOnly && (
                <ActionForm action={removeCalendar}>
                  <input type="hidden" name="calendarId" value={calendar.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {t.remove}
                    <span className="sr-only">: {calendar.title}</span>
                  </Button>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export async function BatchEditors({ membership, t }: { membership: Membership; t: Dictionary["maintainer"] }) {
  const { supabase, batchId, user } = membership;
  const [links, emails] = await Promise.all([
    supabase.from("quick_links").select("id, label, url").eq("batch_id", batchId).order("position"),
    supabase.from("batch_allowed_emails").select("email, role").eq("batch_id", batchId).order("email"),
  ]);
  const ownEmail = user.email?.toLowerCase();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t.linksTitle}</CardTitle>
          <CardDescription>{t.linksIntro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ActionForm action={addQuickLink} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="quick-label">{t.name}</Label>
              <Input id="quick-label" name="label" required maxLength={60} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-url">{t.address}</Label>
              <Input id="quick-url" name="url" required maxLength={2048} inputMode="url" />
            </div>
            <Button type="submit">{t.addLink}</Button>
          </ActionForm>
          <ul className="divide-y divide-border text-sm">
            {(links.data ?? []).map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 break-words">{link.label}</span>
                <ActionForm action={deleteQuickLink}>
                  <input type="hidden" name="linkId" value={link.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {t.delete}
                    <span className="sr-only">: {link.label}</span>
                  </Button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.listTitle}</CardTitle>
          <CardDescription>{t.listIntro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ActionForm action={addAllowedEmail} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="allowed-email">{t.email}</Label>
              <Input id="allowed-email" name="email" type="email" required />
            </div>
            <Button type="submit">{t.addPerson}</Button>
          </ActionForm>
          <ul className="divide-y divide-border text-sm">
            {(emails.data ?? []).map((row) => (
              <li key={row.email} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 break-words">
                  {row.email}
                  {row.role === "maintainer" && <span className="text-muted-foreground"> {t.maintainerTag}</span>}
                </span>
                {row.email !== ownEmail && (
                  <ActionForm action={removeAllowedEmail}>
                    <input type="hidden" name="email" value={row.email} />
                    <Button type="submit" variant="outline" size="sm">
                      {t.remove}
                      <span className="sr-only">: {row.email}</span>
                    </Button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

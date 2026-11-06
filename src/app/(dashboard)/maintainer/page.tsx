import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MaintainerSkeleton } from "@/components/kurspool/skeletons";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fill, formatDate } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectClassroom, syncNow } from "./actions";
import { BatchEditors, CalendarEditor } from "./batch-editors";
import { SyncButton } from "./sync-button";

export const metadata: Metadata = { title: "Kurspool" };

type Run = {
  id: string;
  status: "running" | "success" | "partial" | "failed";
  started_at: string;
  stats: { modules: number; items: number; hidden: number } | null;
  error: string | null;
};

async function MaintainerContent({ searchParams }: { searchParams: PageProps<"/maintainer">["searchParams"] }) {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  if (membership.role !== "maintainer") redirect("/dashboard");
  const { locale, t: all } = await getDictionary();
  const t = all.maintainer;

  const { message } = await searchParams;
  const notice = typeof message === "string" ? t.message[message as keyof typeof t.message] : undefined;

  // Preview deployments deliberately have no secret key, so everything that needs it stays out of the page.
  const hasSecrets = Boolean(process.env.SUPABASE_SECRET_KEY && process.env.SYNC_TOKEN_KEY);
  const credentials = hasSecrets
    ? (await createAdminClient().from("sync_credentials").select("connected_at").eq("batch_id", membership.batchId).maybeSingle()).data
    : null;

  const { data } = await membership.supabase
    .from("sync_runs")
    .select("id, status, started_at, stats, error")
    .eq("batch_id", membership.batchId)
    .order("started_at", { ascending: false })
    .limit(10);
  const runs = (data ?? []) as Run[];
  const needsReconnect = !credentials || runs[0]?.error === "reconnect_required";

  return (
    <>
      {notice && (
        <Alert role="status">{notice}</Alert>
      )}
      {!hasSecrets && <Alert role="status">{t.previewNotice}</Alert>}
      {hasSecrets && (
        <Card>
          <CardHeader>
            <CardTitle>{t.connectionTitle}</CardTitle>
            <CardDescription>
              {credentials ? fill(t.connectedSince, { date: formatDate(locale, credentials.connected_at, true) }) : t.notConnected}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {credentials && needsReconnect && (
              <Alert variant="destructive">{t.reconnectAlert}</Alert>
            )}
            <div className="flex flex-wrap gap-3">
              {/* A full page load is required: this route redirects to Google. */}
              <a href="/api/classroom/connect" className={buttonVariants({ variant: needsReconnect ? "default" : "outline" })}>
                {credentials ? t.reconnect : t.connect}
              </a>
              {credentials && (
                <form action={syncNow}>
                  <SyncButton label={t.syncNow} pendingLabel={t.syncing} />
                </form>
              )}
            </div>
            {credentials && (
              <Collapsible className="text-sm">
                <CollapsibleTrigger className={buttonVariants({ variant: "outline" })}>{t.disconnect}</CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  <p className="max-w-prose text-muted-foreground">{t.disconnectIntro}</p>
                  <form action={disconnectClassroom}>
                    <Button type="submit" variant="destructive">
                      {t.disconnectConfirm}
                    </Button>
                  </form>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}
      <CalendarEditor membership={membership} locale={locale} readOnly={!hasSecrets} t={all.calendar.manage} />
      <BatchEditors membership={membership} t={t} />
      <Card>
        <CardHeader>
          <CardTitle>{t.historyTitle}</CardTitle>
          <CardDescription>{t.historyIntro}</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.historyEmpty}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {runs.map((run) => (
                <li key={run.id} className="space-y-1 py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{t.runStatus[run.status] ?? run.status}</span>
                    <span className="text-muted-foreground">{formatDate(locale, run.started_at, true)}</span>
                  </div>
                  {run.stats && <p className="text-muted-foreground">{fill(t.runStats, run.stats)}</p>}
                  {run.error && (
                    <p className="break-words text-destructive">{t.runError[run.error as keyof typeof t.runError] ?? run.error}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

async function MaintainerHeading() {
  const { t } = await getDictionary();
  return <h1 className="font-heading text-3xl font-bold text-primary">{t.maintainer.title}</h1>;
}

export default function MaintainerPage({ searchParams }: PageProps<"/maintainer">) {
  return (
    <main className="w-full space-y-4 px-4 md:px-6 xl:px-10 py-10">
      <Suspense fallback={<MaintainerSkeleton />}>
        <MaintainerHeading />
        <MaintainerContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

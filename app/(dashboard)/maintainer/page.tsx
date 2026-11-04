import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fill, formatDate } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectClassroom, syncNow } from "./actions";
import { BatchEditors } from "./batch-editors";
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

  const { data: credentials } = await createAdminClient()
    .from("sync_credentials")
    .select("connected_at")
    .eq("batch_id", membership.batchId)
    .maybeSingle();

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
        <p role="status" className="rounded-md border border-border bg-card p-3 text-sm">
          {notice}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t.connectionTitle}</CardTitle>
          <CardDescription>
            {credentials ? fill(t.connectedSince, { date: formatDate(locale, credentials.connected_at, true) }) : t.notConnected}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {credentials && needsReconnect && (
            <p role="alert" className="text-sm text-destructive">
              {t.reconnectAlert}
            </p>
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
            <details className="text-sm">
              <summary className="cursor-pointer rounded-sm underline underline-offset-4">{t.disconnect}</summary>
              <div className="mt-2 space-y-2">
                <p className="max-w-prose text-muted-foreground">{t.disconnectIntro}</p>
                <form action={disconnectClassroom}>
                  <Button type="submit" variant="destructive" size="sm">
                    {t.disconnectConfirm}
                  </Button>
                </form>
              </div>
            </details>
          )}
        </CardContent>
      </Card>
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
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
      <Suspense fallback={<p className="text-muted-foreground">…</p>}>
        <MaintainerHeading />
        <MaintainerContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

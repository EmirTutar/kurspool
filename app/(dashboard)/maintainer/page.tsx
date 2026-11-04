import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMembership } from "@/lib/membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncNow } from "./actions";
import { BatchEditors } from "./batch-editors";
import { SyncButton } from "./sync-button";

export const metadata: Metadata = { title: "Betreuung · Kurspool" };

const MESSAGES: Record<string, string> = {
  connected: "Classroom ist verbunden.",
  connect_failed: "Die Verbindung mit Classroom ist fehlgeschlagen. Bitte versuche es noch einmal.",
  missing_configuration: "Der Server ist noch nicht vollständig eingerichtet.",
  sync_finished: "Der Import ist abgeschlossen. Das Ergebnis steht unten im Verlauf.",
  sync_running: "Es läuft bereits ein Import.",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Läuft",
  success: "Erfolgreich",
  partial: "Teilweise",
  failed: "Fehlgeschlagen",
};

const ERROR_LABELS: Record<string, string> = {
  reconnect_required: "Classroom muss neu verbunden werden.",
  no_matching_courses: "Keine Kurse für diesen Batch gefunden.",
  missing_configuration: "Der Server ist noch nicht vollständig eingerichtet.",
  missing_classroom_section: "Für diesen Batch ist kein Classroom-Abschnitt eingetragen.",
  token_refresh_failed: "Google war nicht erreichbar. Der nächste Import versucht es erneut.",
};

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

type Run = {
  id: string;
  status: string;
  started_at: string;
  stats: { modules: number; items: number; hidden: number } | null;
  error: string | null;
};

async function MaintainerContent({ searchParams }: { searchParams: PageProps<"/maintainer">["searchParams"] }) {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  if (membership.role !== "maintainer") redirect("/dashboard");

  const { message } = await searchParams;
  const notice = typeof message === "string" ? MESSAGES[message] : undefined;

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
        <p role="status" className="rounded-md border p-3 text-sm">
          {notice}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Classroom-Verbindung</CardTitle>
          <CardDescription>
            {credentials
              ? `Verbunden seit ${dateFormat.format(new Date(credentials.connected_at))}. Der Import läuft einmal täglich automatisch.`
              : "Noch nicht verbunden. Verbinde das Konto, das in allen Modulen eingeschrieben ist."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {credentials && needsReconnect && (
            <p role="alert" className="text-sm text-destructive">
              Google hat den Zugriff beendet. Verbinde Classroom neu, damit der Import weiterläuft. Deine Daten bleiben
              erhalten.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {/* A full page load is required: this route redirects to Google. */}
            <a
              href="/api/classroom/connect"
              className={buttonVariants({ variant: needsReconnect ? "default" : "outline" })}
            >
              {credentials ? "Classroom neu verbinden" : "Classroom verbinden"}
            </a>
            {credentials && (
              <form action={syncNow}>
                <SyncButton />
              </form>
            )}
          </div>
        </CardContent>
      </Card>
      <BatchEditors {...membership} />
      <Card>
        <CardHeader>
          <CardTitle>Importverlauf</CardTitle>
          <CardDescription>Die letzten zehn Läufe.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch kein Import gelaufen.</p>
          ) : (
            <ul className="divide-y text-sm">
              {runs.map((run) => (
                <li key={run.id} className="space-y-1 py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{STATUS_LABELS[run.status] ?? run.status}</span>
                    <span className="text-muted-foreground">{dateFormat.format(new Date(run.started_at))}</span>
                  </div>
                  {run.stats && (
                    <p className="text-muted-foreground">
                      {run.stats.modules} Module, {run.stats.items} Einträge, {run.stats.hidden} ausgeblendet
                    </p>
                  )}
                  {run.error && <p className="break-words text-destructive">{ERROR_LABELS[run.error] ?? run.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function MaintainerPage({ searchParams }: PageProps<"/maintainer">) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4 py-10">
      <h1 className="font-heading text-3xl font-bold text-primary">Betreuung</h1>
      <Suspense fallback={<p className="text-muted-foreground">Wird geladen …</p>}>
        <MaintainerContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

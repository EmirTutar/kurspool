import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { addTask, deleteTask, markAllSeen, toggleTask } from "@/app/(dashboard)/actions";
import { ItemRow } from "@/components/kurspool/item-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadBatchData } from "@/lib/batch-data";
import { moduleProgress } from "@/lib/dashboard";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Übersicht · Kurspool" };

const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
const dateOnly = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });

type Task = { id: string; title: string; done: boolean; due_on: string | null };

async function DashboardContent() {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");

  const { batch, modules, items } = await loadBatchData(membership);
  const { data: taskRows } = await membership.supabase
    .from("personal_tasks")
    .select("id, title, done, due_on")
    .eq("user_id", membership.user.id)
    .order("done")
    .order("created_at", { ascending: false });
  const tasks = (taskRows ?? []) as Task[];

  const titleOf = new Map(modules.map((module) => [module.id, module.title]));
  const fresh = items.filter((item) => item.status === "new");
  const open = items.filter((item) => item.status === "todo");

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="space-y-8">
        <section aria-labelledby="path-heading">
          <h2 id="path-heading" className="font-heading text-lg font-bold text-primary">
            Dein Lernpfad
          </h2>
          <ol className="mt-3">
            {modules.map((module) => {
              const progress = moduleProgress(items.filter((item) => item.module_id === module.id));
              const number = module.position < 9999 ? module.position : "";
              const name = module.title.replace(/^\s*\d+\s*\.\s*/, "");
              return (
                <li key={module.id}>
                  <Link
                    href={`/modules/${module.id}`}
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 rounded-md py-2.5 hover:bg-secondary"
                  >
                    <span className="font-heading text-center text-2xl font-bold leading-tight text-primary">{number}</span>
                    <span className="min-w-0 pr-2">
                      <span className="block text-sm font-medium leading-snug">{name}</span>
                      {progress.total > 0 ? (
                        <>
                          <span
                            role="progressbar"
                            aria-label={`Fortschritt ${name}`}
                            aria-valuenow={progress.percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-secondary"
                          >
                            <span className="block h-full bg-success" style={{ width: `${progress.percent}%` }} />
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {progress.finished} von {progress.total} erledigt
                            {progress.newCount > 0 && `, ${progress.newCount} neu`}
                          </span>
                        </>
                      ) : (
                        <span className="mt-0.5 block text-xs text-muted-foreground">Noch kein Material</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            {batch?.last_synced_at
              ? `Zuletzt aktualisiert: ${dateTime.format(new Date(batch.last_synced_at))}`
              : "Noch nicht aus Classroom importiert."}
          </p>
        </section>

        <section aria-labelledby="tasks-heading">
          <h2 id="tasks-heading" className="font-heading text-lg font-bold text-primary">
            Meine Aufgaben
          </h2>
          <form action={addTask} className="mt-3 flex gap-2">
            <Input name="title" required maxLength={200} placeholder="Neue Aufgabe" aria-label="Neue Aufgabe" />
            <Button type="submit" variant="secondary">
              Hinzufügen
            </Button>
          </form>
          {tasks.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-start gap-2 py-2 text-sm">
                  <form action={toggleTask}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="done" value={String(!task.done)} />
                    <button
                      type="submit"
                      aria-label={task.done ? `${task.title} wieder öffnen` : `${task.title} erledigen`}
                      className={`mt-0.5 size-5 rounded border ${task.done ? "border-success bg-success" : "border-input bg-background"}`}
                    />
                  </form>
                  <span className={`min-w-0 flex-1 break-words ${task.done ? "text-muted-foreground line-through" : ""}`}>
                    {task.title}
                    {task.due_on && (
                      <span className="block text-xs text-muted-foreground">fällig {dateOnly.format(new Date(task.due_on))}</span>
                    )}
                  </span>
                  <form action={deleteTask}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <button type="submit" className="text-xs text-muted-foreground underline underline-offset-2">
                      Löschen<span className="sr-only">: {task.title}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <main className="min-w-0 space-y-10">
        <section aria-labelledby="new-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 id="new-heading" className="font-heading text-3xl font-bold text-primary">
              {fresh.length === 0
                ? "Nichts Neues"
                : fresh.length === 1
                  ? "1 neuer Eintrag"
                  : `${fresh.length} neue Einträge`}
            </h1>
            {fresh.length > 0 && (
              <form action={markAllSeen}>
                <button type="submit" className="min-h-9 text-sm underline underline-offset-4">
                  Alle als gesehen markieren
                </button>
              </form>
            )}
          </div>
          {fresh.length > 0 ? (
            <div className="mt-3">
              {fresh.map((item) => (
                <ItemRow key={item.id} item={item} moduleTitle={titleOf.get(item.module_id)} />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">Neues Material erscheint hier nach dem nächsten täglichen Import.</p>
          )}
        </section>

        <section aria-labelledby="open-heading">
          <h2 id="open-heading" className="font-heading text-xl font-bold text-primary">
            Offen ({open.length})
          </h2>
          {open.length > 0 ? (
            <div className="mt-2">
              {open.map((item) => (
                <ItemRow key={item.id} item={item} moduleTitle={titleOf.get(item.module_id)} />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">Öffne einen neuen Eintrag, dann steht er hier, bis du ihn erledigst.</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-4 text-muted-foreground">Wird geladen …</p>}>
      <DashboardContent />
    </Suspense>
  );
}

import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/kurspool/skeletons";
import { addTask, deleteTask, markAllSeen } from "@/app/(dashboard)/actions";
import { ActionForm } from "@/components/kurspool/action-form";
import { DashboardViews } from "@/components/kurspool/dashboard-views";
import { ItemRow } from "@/components/kurspool/item-row";
import { ModuleCards } from "@/components/kurspool/module-card";
import { TaskCheckbox } from "@/components/kurspool/task-checkbox";
import { UpcomingEvents } from "@/components/kurspool/upcoming-events";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadBatchData } from "@/lib/batch-data";
import { displayTitle, dueItems, groupByModule, groupByTopic, isStale } from "@/lib/dashboard";
import { fill, formatDate } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Kurspool" };

type Task = { id: string; title: string; done: boolean; due_on: string | null };

async function DashboardContent() {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { locale, t } = await getDictionary();

  const { batch, modules, topics, items } = await loadBatchData(membership);
  const { data: taskRows } = await membership.supabase
    .from("personal_tasks")
    .select("id, title, done, due_on")
    .eq("user_id", membership.user.id)
    .order("done")
    .order("created_at", { ascending: false });
  const tasks = (taskRows ?? []) as Task[];

  const initialView = (await cookies()).get("dashboard_view")?.value === "list" ? "list" : "cards";
  const now = new Date();
  const titleOf = new Map(modules.map((module) => [module.id, module.title]));
  const fresh = items.filter((item) => item.status === "new");
  const open = items.filter((item) => item.status === "todo");
  const due = dueItems(items, now);
  const stale = isStale(batch?.last_synced_at ?? null, now);

  return (
      <main className="animate-in fade-in duration-300 motion-reduce:animate-none mx-auto w-full max-w-5xl space-y-10 px-4 py-8">
        <h1 className="sr-only">{t.nav.overview}</h1>
        {stale && batch?.last_synced_at && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertTitle>{t.dashboard.staleTitle}</AlertTitle>
            <AlertDescription>{fill(t.dashboard.staleBody, { date: formatDate(locale, batch.last_synced_at, true) })}</AlertDescription>
          </Alert>
        )}

        <section aria-labelledby="tasks-heading">
          <h2 id="tasks-heading" className="font-heading text-lg font-bold text-primary">
            {t.tasks.title}
          </h2>
          <ActionForm action={addTask} resetOnSuccess className="mt-3 flex gap-2">
            <Input name="title" required maxLength={200} placeholder={t.tasks.new} aria-label={t.tasks.new} />
            <Button type="submit" variant="secondary">
              {t.tasks.add}
            </Button>
          </ActionForm>
          {tasks.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-start gap-2 py-2 text-sm">
                  <TaskCheckbox taskId={task.id} done={task.done} label={fill(t.tasks.complete, { title: task.title })} />
                  <span className={`min-w-0 flex-1 break-words ${task.done ? "text-muted-foreground line-through" : ""}`}>{task.title}</span>
                  <ActionForm action={deleteTask}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <Button type="submit" variant="ghost" size="xs">
                      {t.tasks.delete}
                      <span className="sr-only">: {task.title}</span>
                    </Button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </section>

        <UpcomingEvents membership={membership} locale={locale} now={now} />

        <div>
          <DashboardViews
            initialView={initialView}
            locale={locale}
            cards={
              <ModuleCards
                locale={locale}
                  modules={modules.map((module) => {
                  const moduleItems = items.filter((item) => item.module_id === module.id);
                  return {
                    id: module.id,
                    title: module.title,
                    items: moduleItems,
                    groups: groupByTopic(moduleItems, topics.filter((topic) => topic.module_id === module.id), t.module.moreEntries),
                  };
                })}
              />
            }
            list={
              <div className="space-y-10">
                <section aria-labelledby="new-heading">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 id="new-heading" className="font-heading text-2xl font-bold text-primary">
                      {fresh.length === 0
                        ? t.dashboard.nothingNew
                        : fresh.length === 1
                          ? t.dashboard.oneNew
                          : fill(t.dashboard.manyNew, { count: fresh.length })}
                    </h2>
                    {fresh.length > 0 && (
                      <ActionForm action={markAllSeen}>
                        <Button type="submit" variant="outline" size="lg">
                          {t.dashboard.markAllSeen}
                        </Button>
                      </ActionForm>
                    )}
                  </div>
                  {fresh.length > 0 ? (
                    <div className="mt-3 space-y-6">
                      {groupByModule(fresh, modules).map((group) => (
                        <section key={group.id} aria-label={fill(t.dashboard.groupNew, { module: group.title })}>
                          <h3 className="font-heading text-base font-bold text-primary">{group.title}</h3>
                          <div className="mt-1">
                            {group.items.map((item) => (
                              <ItemRow key={item.id} item={item} locale={locale} />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-muted-foreground">{t.dashboard.newEmpty}</p>
                  )}
                </section>

                <section aria-labelledby="open-heading">
                  <h2 id="open-heading" className="font-heading text-xl font-bold text-primary">
                    {fill(t.dashboard.open, { count: open.length })}
                  </h2>
                  {open.length > 0 ? (
                    <div className="mt-2 space-y-6">
                      {groupByModule(open, modules).map((group) => (
                        <section key={group.id} aria-label={group.title}>
                          <h3 className="font-heading text-base font-bold text-primary">{group.title}</h3>
                          <div className="mt-1">
                            {group.items.map((item) => (
                              <ItemRow key={item.id} item={item} locale={locale} />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-muted-foreground">{t.dashboard.openEmpty}</p>
                  )}
                </section>
              </div>
            }
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {batch?.last_synced_at
              ? fill(t.dashboard.lastSync, { date: formatDate(locale, batch.last_synced_at, true) })
              : t.dashboard.neverSynced}
          </p>
        </div>

        {due.length > 0 && (
          <section aria-labelledby="due-heading">
            <h2 id="due-heading" className="font-heading text-xl font-bold text-primary">
              {t.dashboard.dueTitle}
            </h2>
            <ul className="mt-2 divide-y divide-border">
              {due.map((item) => (
                <li key={item.id} className="py-2.5">
                  <span className="block font-medium">{displayTitle(item.title)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {fill(item.past ? t.dashboard.duePast : t.dashboard.dueSoon, { date: formatDate(locale, item.due_at as string) })}
                    {titleOf.get(item.module_id) && ` (${titleOf.get(item.module_id)})`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

      </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

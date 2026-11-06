import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteIdea } from "@/app/(dashboard)/actions";
import { ConfirmDelete } from "@/components/kurspool/confirm-delete";
import { IdeaForm } from "@/components/kurspool/idea-form";
import { SearchSkeleton } from "@/components/kurspool/skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { splitLinks } from "@/lib/dashboard";
import { fill, formatDate } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";
import { getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Kurspool" };

type Idea = { id: string; body: string; user_id: string; created_at: string };

async function IdeasContent() {
  const membership = await getMembership();
  if (!membership) redirect("/no-access");
  const { locale, t: all } = await getDictionary();
  const t = all.ideas;

  const { data } = await membership.supabase
    .from("ideas")
    .select("id, body, user_id, created_at")
    .eq("batch_id", membership.batchId)
    .order("created_at", { ascending: false });
  const ideas = (data ?? []) as Idea[];
  const canRemoveAny = membership.role === "maintainer";

  return (
    <main className="animate-in fade-in duration-300 motion-reduce:animate-none mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold text-primary">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </div>
      <IdeaForm locale={locale} />

      <section aria-labelledby="ideas-heading" className="space-y-3">
        <h2 id="ideas-heading" className="sr-only">
          {t.title}
        </h2>
        {ideas.length === 0 ? (
          <p className="text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="space-y-3">
            {ideas.map((idea) => {
              const mine = idea.user_id === membership.user.id;
              return (
                <li key={idea.id}>
                  <Card size="sm" className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        {mine && <Badge variant="secondary">{t.mine}</Badge>}
                        <CardDescription>{formatDate(locale, idea.created_at, true)}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {splitLinks(idea.body).map((part, index) =>
                          part.href ? (
                            <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                              {part.text}
                            </a>
                          ) : (
                            <span key={index}>{part.text}</span>
                          ),
                        )}
                      </p>
                      {(mine || canRemoveAny) && (
                        <div className="flex justify-end">
                          <ConfirmDelete
                            label={fill(t.deleteLabel, { date: formatDate(locale, idea.created_at, true) })}
                            title={t.confirmTitle}
                            description={t.confirmBody}
                            locale={locale}
                            onConfirm={deleteIdea.bind(null, idea.id)}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function IdeasPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <IdeasContent />
    </Suspense>
  );
}

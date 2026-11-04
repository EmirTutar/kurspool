import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard · Kurspool" };

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("batch_members")
    .select("role, batches(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) redirect("/no-access");

  const batch = member.batches as unknown as { name: string };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{batch.name}</h1>
          <p className="text-sm text-muted-foreground">Angemeldet als {user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <Button variant="outline" type="submit">
            Abmelden
          </Button>
        </form>
      </div>
      <p>Hier erscheinen bald deine Module, Aufgaben und Links.</p>
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4 py-10">
      <Suspense fallback={<p className="text-muted-foreground">Wird geladen …</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}

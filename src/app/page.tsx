import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-4 py-16">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Kurspool</h1>
        <p className="text-lg text-muted-foreground">
          Dein Kursmaterial auf einen Blick: was neu ist, was noch offen ist und was du schon erledigt hast.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/login" className={buttonVariants()}>
          Anmelden
        </Link>
        <Link href="/privacy" className="text-sm underline underline-offset-4">
          Datenschutz
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Inoffizielles Projekt von Studierenden, nur für freigeschaltete Batches.
      </p>
    </main>
  );
}

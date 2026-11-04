import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Datenschutz · Kurspool" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Datenschutz</h1>
        <p className="text-muted-foreground">
          Kurspool ist ein inoffizielles Projekt von Studierenden und kein Angebot der Digitale Leute School.
        </p>
      </div>
      <section className="space-y-2">
        <h2 className="font-medium">Welche Daten gespeichert werden</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name und E-Mail-Adresse aus deiner Google-Anmeldung</li>
          <li>Dein Fortschritt, deine eigenen Aufgaben und deine eigenen Links</li>
          <li>Kursinhalte: Titel, Beschreibungen und Links aus Google Classroom, keine Dateien und keine Noten</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Wofür und wo</h2>
        <p>
          Die Daten dienen nur dazu, dir die Kursübersicht und deinen Fortschritt anzuzeigen. Sie liegen bei Supabase in
          einer EU-Region, die App läuft bei Vercel. Dein Fortschritt, deine Aufgaben und Links sind nur für dich
          sichtbar.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Google Classroom</h2>
        <p>
          Beim Anmelden liest Kurspool nur Name und E-Mail-Adresse aus deinem Konto, nicht dein Classroom. Kursinhalte
          importiert ein einzelnes Betreuungskonto mit Lesezugriff.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Auskunft und Löschung</h2>
        <p>
          Dein Konto mit Fortschritt, Aufgaben und Links kannst du unter Einstellungen selbst löschen. Für eine Auskunft oder andere Fragen schreibe an{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
      <Link href="/" className="inline-block underline underline-offset-4">
        Zur Startseite
      </Link>
    </main>
  );
}

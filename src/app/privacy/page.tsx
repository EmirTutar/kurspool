import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AppFrame } from "@/components/kurspool/app-frame";
import { LocalizedFooter, SiteFooter } from "@/components/kurspool/site-footer";
import { getMembership } from "@/lib/membership";
import { getContactEmailForMember } from "@/lib/site";

export const metadata: Metadata = { title: "Datenschutz · Kurspool" };

const NO_ADDRESS = "Die Kontaktadresse siehst du, sobald du für einen Batch freigeschaltet und angemeldet bist. Ohne Zugang wende dich an die Person, die dich zu Kurspool eingeladen hat.";

async function ContactDetails() {
  const email = await getContactEmailForMember();
  if (!email) return <>{NO_ADDRESS}</>;
  return (
    <>
      Für eine Auskunft oder andere Fragen schreibe an{" "}
      <a href={`mailto:${email}`} className="underline underline-offset-4">
        {email}
      </a>
      .
    </>
  );
}

/** Members keep the app's menu here, so the page doesn't look as if they were signed out. */
async function PrivacyFrame({ children }: { children: ReactNode }) {
  if (await getMembership()) return <AppFrame>{children}</AppFrame>;
  return (
    <>
      {children}
      <LocalizedFooter />
    </>
  );
}

function PrivacyContent() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Datenschutz</h1>
        <p className="text-muted-foreground">
          Kurspool ist ein inoffizielles Projekt von Kursteilnehmenden und kein Angebot der Digitale Leute School.
        </p>
      </div>
      <section className="space-y-2">
        <h2 className="font-medium">Verantwortlich</h2>
        <p>Emircan Tutar</p>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Welche Daten gespeichert werden</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name und E-Mail-Adresse aus deiner Google-Anmeldung</li>
          <li>Dein Fortschritt, deine eigenen Aufgaben und deine eigenen Links</li>
          <li>Kursinhalte: Titel, Beschreibungen und Links aus Google Classroom, keine Dateien und keine Noten</li>
          <li>Kurstermine: Titel, Zeiten, Orte, Beschreibungen und Meeting-Links aus den Kurskalendern</li>
          <li>Deine Auswahl im Kalender, zum Beispiel deine Kohorte</li>
          <li>Deine Notizen, die nur du siehst</li>
          <li>Ideen, die du teilst: Alle in deinem Batch sehen den Text, aber nicht, von wem er ist</li>
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
        <h2 className="font-medium">Google Kalender</h2>
        <p>
          Kurspool verbindet sich nicht mit deinem Google Kalender und sieht deine privaten Termine nicht. Es liest nur
          die Kurskalender, die in der Betreuung eingetragen sind. Ihre Termine und Meeting-Links sehen alle, die für den
          Batch freigeschaltet sind.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Auskunft und Löschung</h2>
        <p>
          Dein Konto mit Fortschritt, Aufgaben, Links, Notizen und Ideen kannst du unter Einstellungen selbst löschen.{" "}
          <Suspense fallback={NO_ADDRESS}>
            <ContactDetails />
          </Suspense>
        </p>
      </section>
      <Link href="/" className="inline-block underline underline-offset-4">
        Zur Startseite
      </Link>
    </main>
  );
}

export default function PrivacyPage() {
  return (
    <Suspense
      fallback={
        <>
          <PrivacyContent />
          <SiteFooter locale="de" />
        </>
      }
    >
      <PrivacyFrame>
        <PrivacyContent />
      </PrivacyFrame>
    </Suspense>
  );
}

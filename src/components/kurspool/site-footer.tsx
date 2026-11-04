import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { dictionaries, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";
import { CONTACT_EMAIL } from "@/lib/site";

const footerLink = "inline-block py-1 hover:text-foreground hover:underline underline-offset-4";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = dictionaries[locale].footer;
  return (
    <footer className="mt-auto">
      <Separator />
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-4 text-sm text-muted-foreground">
        <p>© 2026 Kurspool. {t.note}</p>
        <nav aria-label={t.label} className="flex flex-wrap gap-x-6">
          <Link href="/privacy" className={footerLink}>
            {t.privacy}
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className={footerLink}>
            {t.contact}
          </a>
        </nav>
      </div>
    </footer>
  );
}

/** Follows the visitor's language, which is read per request. */
export async function LocalizedFooter() {
  const { locale } = await getDictionary();
  return <SiteFooter locale={locale} />;
}

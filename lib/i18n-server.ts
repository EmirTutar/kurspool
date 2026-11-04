import { cookies } from "next/headers";
import { parseLocale } from "@/lib/forms";
import { dictionaries } from "@/lib/i18n";

export async function getDictionary() {
  const store = await cookies();
  const locale = parseLocale(store.get("locale")?.value);
  return { locale, t: dictionaries[locale] };
}

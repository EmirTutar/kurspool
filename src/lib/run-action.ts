import { unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { parseLocale } from "@/lib/forms";
import { dictionaries, type Locale } from "@/lib/i18n";

function localeCookie(cookie: string): string | undefined {
  return cookie.match(/(?:^|;\s*)locale=([^;]*)/)?.[1];
}

/** The language picked in the settings. English when none was picked, for pages that can't rely on the app's default. */
export function chosenLocale(cookie: string): Locale {
  return localeCookie(cookie) === "de" ? "de" : "en";
}

/** A server action rejects when its request fails, for example without a connection. That becomes a normal failed result. */
export async function runAction<T>(call: () => Promise<T>): Promise<T | ActionResult> {
  try {
    return await call();
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    const locale = parseLocale(typeof document === "undefined" ? undefined : localeCookie(document.cookie));
    return { ok: false, message: dictionaries[locale].feedback.saveFailed };
  }
}

"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dictionaries, type Locale } from "@/lib/i18n";
import { chosenLocale } from "@/lib/run-action";

const noChanges = () => () => {};

export function ErrorScreen({ digest }: { digest?: string }) {
  const locale = useSyncExternalStore<Locale>(
    noChanges,
    () => chosenLocale(document.cookie),
    () => "en",
  );
  const t = dictionaries[locale].errorPage;

  return (
    <main lang={locale} className="flex min-h-svh flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>{t.title}</h1>
          </CardTitle>
          <CardDescription>{t.body}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2">
            <Button type="button" className="w-full" onClick={() => window.location.reload()}>
              {t.reload}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              // A full page load on purpose: the app's router may be the part that failed.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              onClick={() => window.location.assign("/dashboard")}
            >
              {t.overview}
            </Button>
          </div>
          {digest && (
            <p className="break-all text-xs text-muted-foreground">
              {t.code}: {digest}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

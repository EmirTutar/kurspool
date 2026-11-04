import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButton } from "./login-button";

export const metadata: Metadata = { title: "Anmelden · Kurspool" };

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, error } = await searchParams;
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Die Anmeldung ist fehlgeschlagen. Bitte versuche es noch einmal.
        </p>
      )}
      <LoginButton next={typeof next === "string" ? next : null} />
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle><h1>Bei Kurspool anmelden</h1></CardTitle>
          <CardDescription>Nutze das Google-Konto, das für deinen Batch freigeschaltet ist.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Suspense fallback={<LoginButton next={null} />}>
            <LoginForm searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/client";

export function LoginButton({ next }: { next: string | null }) {
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");

  async function signIn() {
    setState("loading");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", safeRedirectPath(next));
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error) setState("failed");
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={signIn} disabled={state === "loading"}>
        {state === "loading" ? "Weiterleitung zu Google …" : "Mit Google anmelden"}
      </Button>
      {state === "failed" && (
        <Alert variant="destructive">Die Anmeldung konnte nicht gestartet werden. Bitte versuche es noch einmal.</Alert>
      )}
    </div>
  );
}

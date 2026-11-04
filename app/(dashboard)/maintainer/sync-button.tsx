"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SyncButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Import läuft …" : "Jetzt importieren"}
    </Button>
  );
}

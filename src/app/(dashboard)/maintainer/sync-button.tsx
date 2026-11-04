"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SyncButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

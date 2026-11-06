"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Toggle } from "@/components/ui/toggle";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/run-action";

/** A star that changes at once and turns back if saving fails. */
export function FavoriteToggle({
  starred,
  label,
  onChange,
}: {
  starred: boolean;
  label: string;
  onChange: (on: boolean) => Promise<ActionResult>;
}) {
  const [on, setOn] = useState(starred);
  const [, startTransition] = useTransition();

  return (
    <Toggle
      size="sm"
      aria-label={label}
      title={label}
      pressed={on}
      onPressedChange={(next: boolean) => {
        setOn(next);
        startTransition(async () => {
          const result = await runAction(() => onChange(next));
          if (!result.ok) {
            setOn(!next);
            toast.error(result.message);
          }
        });
      }}
      className="shrink-0 text-muted-foreground aria-pressed:bg-transparent aria-pressed:text-amber-500 data-[state=on]:bg-transparent"
    >
      <Star aria-hidden className={`transition-transform duration-200 motion-reduce:transition-none ${on ? "scale-110 fill-current" : ""}`} />
    </Toggle>
  );
}

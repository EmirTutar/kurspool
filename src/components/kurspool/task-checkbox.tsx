"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { toggleTask } from "@/app/(dashboard)/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { runAction } from "@/lib/run-action";

export function TaskCheckbox({ taskId, done, label }: { taskId: string; done: boolean; label: string }) {
  const [, startTransition] = useTransition();
  const [checked, setChecked] = useOptimistic(done);

  function change(next: boolean) {
    const form = new FormData();
    form.set("taskId", taskId);
    form.set("done", String(next));
    startTransition(async () => {
      setChecked(next);
      const result = await runAction(() => toggleTask(form));
      if (!result.ok) toast.error(result.message);
    });
  }

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={change}
      aria-label={label}
      className="mt-0.5 size-6 rounded-md data-checked:border-success data-checked:bg-success data-checked:text-white dark:data-checked:bg-success [&_svg]:size-4"
    />
  );
}

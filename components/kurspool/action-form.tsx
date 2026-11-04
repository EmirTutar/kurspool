"use client";

import { useRef, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/** Runs a server action and shows its outcome, so no click ever fails silently. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (form: FormData) => Promise<ActionResult | void>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className={className}
      aria-busy={pending}
      action={(form) =>
        startTransition(async () => {
          const result = await action(form);
          if (!result) return;
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          if (result.message) toast.success(result.message);
          if (resetOnSuccess) formRef.current?.reset();
        })
      }
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

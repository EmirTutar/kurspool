import { Suspense, type ReactNode } from "react";
import { AppFrame } from "@/components/kurspool/app-frame";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-4 text-muted-foreground">Wird geladen …</p>}>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  );
}

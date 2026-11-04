import { Suspense, type ReactNode } from "react";
import { AppSkeleton } from "@/components/kurspool/skeletons";
import { AppFrame } from "@/components/kurspool/app-frame";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  );
}

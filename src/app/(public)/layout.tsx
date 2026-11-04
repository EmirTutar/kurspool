import { Suspense, type ReactNode } from "react";
import { LocalizedFooter, SiteFooter } from "@/components/kurspool/site-footer";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={<SiteFooter locale="de" />}>
        <LocalizedFooter />
      </Suspense>
    </>
  );
}

import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Suspense } from "react";
import { Providers } from "@/components/kurspool/providers";
import { LocalizedFooter, SiteFooter } from "@/components/kurspool/site-footer";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const headingFont = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Kurspool",
  description: "Kursmaterial, Aufgaben und Links an einem Ort.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${headingFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <Suspense fallback={<SiteFooter locale="de" />}>
            <LocalizedFooter />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}

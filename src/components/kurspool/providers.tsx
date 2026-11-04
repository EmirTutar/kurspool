"use client";

import { Moon, Sun } from "lucide-react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster richColors position="bottom-center" />
    </ThemeProvider>
  );
}

export function ThemeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label={label}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun aria-hidden className="hidden size-4 dark:block" />
      <Moon aria-hidden className="size-4 dark:hidden" />
    </Button>
  );
}

/** Keeps the page's language attribute correct for screen readers when someone switches language. */
export function DocumentLanguage({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/kurspool/error-screen";
import "./globals.css";

/** Replaces the root layout when that layout itself fails, so it brings its own document. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-svh flex-col">
        <ErrorScreen digest={error.digest} />
      </body>
    </html>
  );
}

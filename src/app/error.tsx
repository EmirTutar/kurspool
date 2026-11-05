"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/kurspool/error-screen";

export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen digest={error.digest} />;
}

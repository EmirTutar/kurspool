import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Kein Zugang · Kurspool" };

export default function NoAccessPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle><h1>Kein Zugang</h1></CardTitle>
          <CardDescription>
            Dieses Google-Konto steht auf keiner Batch-Liste. Bitte die Person, die euren Batch betreut, dich
            freizuschalten, oder{" "}
            <Link href="/login" className="underline underline-offset-4">
              melde dich mit einem anderen Konto an
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

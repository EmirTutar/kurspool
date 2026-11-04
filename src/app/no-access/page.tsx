import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Kein Zugang · Kurspool" };

export default function NoAccessPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle><h1>Kein Zugang</h1></CardTitle>
          <CardDescription>
            Dieses Google-Konto steht auf keiner Batch-Liste. Bitte die Person, die euren Batch betreut, dich
            freizuschalten, oder melde dich mit einem anderen Konto an.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" className="w-full">
              Abmelden und anderes Konto wählen
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

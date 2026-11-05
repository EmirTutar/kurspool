import { NextResponse, type NextRequest } from "next/server";
import { refreshBatchCalendars } from "@/lib/calendar/sync";
import { executeBatchSync } from "@/lib/sync/execute";
import { isAuthorizedCron } from "@/lib/sync/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: connected, error } = await db.from("sync_credentials").select("batch_id");
  if (error) return NextResponse.json({ error: "database_error" }, { status: 500 });

  const results = [];
  for (const { batch_id: batchId } of connected ?? []) {
    const result = await executeBatchSync(db, batchId);
    results.push({ status: result.status, modules: result.modules, items: result.items, hidden: result.hidden });
  }

  // Calendars don't depend on the Classroom connection, so a batch can have either.
  const key = process.env.SYNC_TOKEN_KEY;
  const { data: calendars } = await db.from("calendars").select("batch_id");
  if (key) {
    for (const batchId of new Set((calendars ?? []).map((row) => row.batch_id as string))) {
      await refreshBatchCalendars(db, batchId, { key, force: true }).catch(() => false);
    }
  }
  return NextResponse.json({ results });
}

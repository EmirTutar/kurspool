import { NextResponse, type NextRequest } from "next/server";
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
  return NextResponse.json({ results });
}

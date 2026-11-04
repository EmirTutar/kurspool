import type { SupabaseClient } from "@supabase/supabase-js";
import { createClassroomSource, ReconnectRequiredError, refreshAccessToken } from "@/lib/classroom/client";
import { decryptToken } from "./crypto";
import { runSync, type SyncResult } from "./run";

async function recordFailure(db: SupabaseClient, batchId: string, code: string): Promise<SyncResult> {
  await db.from("sync_runs").insert({
    batch_id: batchId,
    status: "failed",
    finished_at: new Date().toISOString(),
    error: code,
  });
  return { status: "failed", modules: 0, items: 0, hidden: 0, errors: [code] };
}

/** Loads a batch's connection, gets a fresh access token, and imports. Used by cron and "Sync now". */
export async function executeBatchSync(db: SupabaseClient, batchId: string): Promise<SyncResult> {
  const { GOOGLE_SYNC_CLIENT_ID: clientId, GOOGLE_SYNC_CLIENT_SECRET: clientSecret, SYNC_TOKEN_KEY: tokenKey } = process.env;
  if (!clientId || !clientSecret || !tokenKey) return recordFailure(db, batchId, "missing_configuration");

  const { data: batch } = await db.from("batches").select("classroom_section").eq("id", batchId).single();
  if (!batch?.classroom_section) return recordFailure(db, batchId, "missing_classroom_section");

  const { data: credentials } = await db
    .from("sync_credentials")
    .select("encrypted_refresh_token")
    .eq("batch_id", batchId)
    .maybeSingle();
  if (!credentials) return recordFailure(db, batchId, "reconnect_required");

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken: decryptToken(credentials.encrypted_refresh_token, tokenKey),
    });
  } catch (error) {
    return recordFailure(db, batchId, error instanceof ReconnectRequiredError ? "reconnect_required" : "token_refresh_failed");
  }

  return runSync(db, batchId, batch.classroom_section, createClassroomSource(accessToken));
}

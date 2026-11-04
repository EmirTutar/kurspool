"use server";

import { redirect } from "next/navigation";
import { revokeToken } from "@/lib/classroom/client";
import { getMembership } from "@/lib/membership";
import { decryptToken } from "@/lib/sync/crypto";
import { executeBatchSync } from "@/lib/sync/execute";
import { createAdminClient } from "@/lib/supabase/admin";

export async function syncNow() {
  const membership = await getMembership();
  if (membership?.role !== "maintainer") redirect("/dashboard");

  const result = await executeBatchSync(createAdminClient(), membership.batchId);
  redirect(`/maintainer?message=${result.status === "skipped" ? "sync_running" : "sync_finished"}`);
}

/** Ends access at Google, then deletes the stored token. Imported content stays. */
export async function disconnectClassroom() {
  const membership = await getMembership();
  if (membership?.role !== "maintainer") redirect("/dashboard");

  const db = createAdminClient();
  const { data: credentials } = await db
    .from("sync_credentials")
    .select("encrypted_refresh_token")
    .eq("batch_id", membership.batchId)
    .maybeSingle();

  if (credentials && process.env.SYNC_TOKEN_KEY) {
    try {
      await revokeToken(decryptToken(credentials.encrypted_refresh_token, process.env.SYNC_TOKEN_KEY));
    } catch {
      // An unreadable token can't be revoked here. Deleting it below still ends the app's use of it.
    }
  }

  const { error } = await db.from("sync_credentials").delete().eq("batch_id", membership.batchId);
  redirect(`/maintainer?message=${error ? "connect_failed" : "disconnected"}`);
}

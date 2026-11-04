"use server";

import { redirect } from "next/navigation";
import { getMembership } from "@/lib/membership";
import { executeBatchSync } from "@/lib/sync/execute";
import { createAdminClient } from "@/lib/supabase/admin";

export async function syncNow() {
  const membership = await getMembership();
  if (membership?.role !== "maintainer") redirect("/dashboard");

  const result = await executeBatchSync(createAdminClient(), membership.batchId);
  redirect(`/maintainer?message=${result.status === "skipped" ? "sync_running" : "sync_finished"}`);
}

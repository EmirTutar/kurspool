import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Bypasses access rules. Use only in server code, after checking who is asking. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

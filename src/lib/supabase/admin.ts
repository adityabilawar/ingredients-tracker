import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireEnv } from "@/lib/env";

/** Service role client — server-only. Used for storage uploads when falling back to DALL-E. */
export function createAdminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

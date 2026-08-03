import { createBrowserClient } from "@supabase/ssr";

// Auth only. Never used to read/write application data directly -- that
// always goes through newgl-api. See AI_INTEGRATION_PLAN.md Part 3.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

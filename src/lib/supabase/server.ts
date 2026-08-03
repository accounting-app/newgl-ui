import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side (middleware, Server Components, Route Handlers) Supabase
// client, cookie-backed. Auth only, same as the browser client -- see
// AI_INTEGRATION_PLAN.md Part 3.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component -- middleware refreshes the
            // session instead, so this is safe to ignore (standard
            // @supabase/ssr pattern).
          }
        }
      }
    }
  );
}

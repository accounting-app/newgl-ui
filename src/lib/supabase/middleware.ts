import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Signup required from day one (AI_INTEGRATION_PLAN.md, Decisions table) --
// there is no anonymous/demo mode. Everything not listed here requires a
// session. "/dev" is the design-system reference (/dev/ui-kit) -- no user
// data, no auth needed, and it 404s outside development regardless (see
// src/app/dev/ui-kit/page.tsx).
const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/dev"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        }
      }
    }
  );

  // Do not add logic between createServerClient and getUser() -- this call
  // is what actually refreshes the session cookie (standard @supabase/ssr
  // requirement, easy to silently break by reordering).
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

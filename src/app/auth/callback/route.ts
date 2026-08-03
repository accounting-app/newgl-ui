import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's redirect target after email confirmation / magic link. Plain
// Route Handler, not inside (auth) or (app) -- it does nothing but exchange
// the code and redirect, no UI of its own.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}

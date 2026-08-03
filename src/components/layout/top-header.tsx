"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/client";

// Every page under (app) is authenticated now (Frontend Phase F1) -- this
// used to show a hardcoded placeholder name with no way to sign out, a
// leftover from before real auth existed. Shows the actual signed-in user
// and is the only sign-out entry point in the app.
export function TopHeader() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full navigation (not just router.replace) so every client-side cache
    // -- TenantProvider's tenant, react state, etc. -- gets torn down along
    // with the session; middleware.ts then bounces straight back to /login
    // if anything under (app) is hit again.
    window.location.href = "/login";
  }

  const avatarLetter = (userEmail ?? "U").trim().charAt(0).toUpperCase();

  return (
    <header className="flex h-[57px] items-center justify-end gap-3 rounded-t-[var(--radius-x-large)] bg-[var(--color-container-background-primary)] px-5">
      <ThemeToggle />
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--color-text-global)]">{userEmail ?? "\u00A0"}</span>
        <div
          aria-label={userEmail ? `${userEmail} avatar` : "User avatar"}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-avatar-background)] text-xs font-semibold text-white"
        >
          {avatarLetter}
        </div>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-icon-primary)] disabled:opacity-50"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}

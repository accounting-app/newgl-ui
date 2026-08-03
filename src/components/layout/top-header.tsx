"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/client";

// Every page under (app) is authenticated now (Frontend Phase F1) -- this
// used to show a hardcoded placeholder name with no way to sign out, a
// leftover from before real auth existed. Shows the actual signed-in email
// and opens a dropdown with sign-out on click -- the only sign-out entry
// point in the app.
export function TopHeader() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

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
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-[var(--color-action-passive-subtle-hover)]"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <div
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-avatar-background)] text-xs font-semibold text-white"
          >
            {avatarLetter}
          </div>
          <span className="text-sm font-medium text-[var(--color-text-global)]">{userEmail ?? "\u00A0"}</span>
        </button>

        {isMenuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-2 w-48 overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              disabled={isSigningOut}
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-global)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

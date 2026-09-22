"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { InputField } from "@/components/ui/input-field";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/client";

// useSearchParams() (for the post-login `next` redirect) opts this page out
// of static rendering unless it's wrapped in Suspense -- without this,
// `next build` fails outright rather than just warning.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

// A Google (or any OAuth provider) failure that happens before Supabase can
// validate/trust our own redirectTo -- e.g. an expired or reused OAuth
// state -- never reaches our /auth/callback route at all. Supabase instead
// redirects straight to the project's bare site_url with ?error=... on it,
// which middleware.ts then bounces to /login (preserving that query string
// as-is). Without this, that error was silently dropped: the visitor just
// saw a blank login page with no explanation of what went wrong.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  bad_oauth_state:
    "Your Google sign-in session expired before it finished. Please try again -- it only takes a few seconds once you pick an account.",
  access_denied: "Google sign-in was cancelled."
};

function oauthErrorMessage(errorCode: string | null, description: string | null): string | null {
  if (!errorCode) return null;
  return (
    OAUTH_ERROR_MESSAGES[errorCode] ??
    (description ? description.replace(/\+/g, " ") : "Something went wrong signing in with Google. Please try again.")
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  useEffect(() => {
    const message = oauthErrorMessage(searchParams.get("error_code"), searchParams.get("error_description"));
    if (!message) return;
    setError(message);
    // Strip the error params from the URL so refreshing (or just looking at
    // the address bar) doesn't keep re-showing a stale failure.
    const next = searchParams.get("next");
    router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogleSignIn() {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      const supabase = createClient();
      const next = safeRedirectPath(searchParams.get("next"));
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        }
      });
      // A successful call navigates the whole page away to Google -- this
      // only returns for an error (e.g. the provider isn't configured yet).
      if (oauthError) {
        setError(oauthError.message);
        setIsGoogleSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setIsGoogleSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const next = safeRedirectPath(searchParams.get("next"));
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const disabled = isSubmitting || isGoogleSubmitting;

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-global)]">Welcome back</h1>
      <p className="mb-6 text-sm text-[var(--color-text-primary)]">Sign in to your books.</p>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="mb-5 w-full"
        iconLeft={GoogleIcon}
        onClick={handleGoogleSignIn}
        disabled={disabled}
      >
        {isGoogleSubmitting ? "Redirecting…" : "Sign in with Google"}
      </Button>

      <div className="mb-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-divider-tertiary)]" />
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-disabled)]">or</span>
        <span className="h-px flex-1 bg-[var(--color-divider-tertiary)]" />
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <InputField
          label="Email"
          type="email"
          size="lg"
          autoComplete="email"
          required
          disabled={disabled}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <InputField
          label="Password"
          type="password"
          size="lg"
          autoComplete="current-password"
          required
          disabled={disabled}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error ? <p className="text-sm text-[var(--color-negative)]">{error}</p> : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={disabled}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </>
  );
}

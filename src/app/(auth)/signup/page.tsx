"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { InputField } from "@/components/ui/input-field";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleGoogleSignUp() {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        // Without this Supabase falls back to the project's Site URL, so the
        // confirmation link lands on /login?code=... and the code is never
        // exchanged for a session. It must also be in the project's
        // Redirect URLs allow-list.
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // With email confirmations disabled (local dev), signUp returns an
      // active session immediately -- go straight in. With confirmations
      // enabled (production), there's no session yet until the user clicks
      // the emailed link, which lands on /auth/callback.
      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setCheckEmail(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (checkEmail) {
    return (
      <>
        <h1 className="mb-1 text-xl font-semibold text-[var(--color-text-global)]">Check your email</h1>
        <p className="text-sm text-[var(--color-text-primary)]">
          We sent a confirmation link to <strong>{email}</strong>. Click it to finish creating your account.
        </p>
      </>
    );
  }

  const disabled = isSubmitting || isGoogleSubmitting;

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-global)]">Create your account</h1>
      <p className="mb-6 text-sm text-[var(--color-text-primary)]">
        Start with New GL&apos;s free plan — no credit card required.
      </p>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="mb-5 w-full"
        iconLeft={GoogleIcon}
        onClick={handleGoogleSignUp}
        disabled={disabled}
      >
        {isGoogleSubmitting ? "Redirecting…" : "Sign up with Google"}
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
          autoComplete="new-password"
          required
          minLength={6}
          disabled={disabled}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error ? <p className="text-sm text-[var(--color-negative)]">{error}</p> : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={disabled}>
          {isSubmitting ? "Creating account…" : "Sign up"}
        </Button>
      </form>
    </>
  );
}

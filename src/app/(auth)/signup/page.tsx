"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
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
    setIsSubmitting(false);
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

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold text-[var(--color-text-global)]">Create your account</h1>
      <p className="mb-6 text-sm text-[var(--color-text-primary)]">
        Start with New GL&apos;s free plan — no credit card required.
      </p>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--color-text-primary)]">Email</span>
          <InputField
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--color-text-primary)]">Password</span>
          <InputField
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Sign up"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-primary)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--color-link-action)] hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

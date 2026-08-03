"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    const next = searchParams.get("next") || "/";
    router.replace(next);
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold text-[var(--color-text-global)]">Sign in</h1>
      <p className="mb-6 text-sm text-[var(--color-text-primary)]">Welcome back to New GL.</p>

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
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-primary)]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[var(--color-link-action)] hover:underline">
          Sign up
        </Link>
      </p>
    </>
  );
}

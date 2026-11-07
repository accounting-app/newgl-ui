import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy"
};

const LAST_UPDATED = "November 7, 2026";
const CONTACT_EMAIL = "privacy@thenewgl.com";

// Public page (listed in PUBLIC_PATHS in src/lib/supabase/middleware.ts) --
// lives outside both the (app) and (auth) route groups so it renders with
// neither the AppShell nor the login/signup two-panel layout. Keep the
// third-party list below in sync with what the product actually sends out
// (see the "What we send to Anthropic" card in settings/ai).
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-container-background-primary)] px-6 py-12">
      <article className="mx-auto max-w-2xl text-[var(--color-text-primary)]">
        <Link href="/" className="inline-block">
          <Image
            className="hidden dark:block"
            style={{ height: "auto", width: "auto" }}
            src="/logo-simple-white.png"
            alt="New GL"
            width={120}
            height={39}
          />
          <Image
            className="block dark:hidden"
            style={{ height: "auto", width: "auto" }}
            src="/logo-simple-green.png"
            alt="New GL"
            width={120}
            height={39}
          />
        </Link>

        <h1 className="mt-10 text-3xl font-semibold text-[var(--color-text-global)]">Privacy Policy</h1>
        <p className="mt-2 text-sm">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6">
          New GL (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs the accounting workspace at thenewgl.com. Your books are your
          business. This page explains what we collect, why we collect it, and what control you have over it.
        </p>

        <Section title="What we collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Account information:</strong> your email address and name, plus your Google profile basics if
              you sign in with Google.
            </li>
            <li>
              <strong>Company and ledger data:</strong> the companies you create, your ledger files, the transactions
              you enter or import, attachments, bank rules, and settings.
            </li>
            <li>
              <strong>AI key:</strong> if you add your own Anthropic API key, we store it so we can make requests on
              your behalf. We only ever show it back to you masked.
            </li>
            <li>
              <strong>Technical data:</strong> the cookies that keep you signed in, plus standard server logs (IP
              address, browser, timestamps) that we use for security and debugging.
            </li>
          </ul>
        </Section>

        <Section title="How we use it">
          <p>
            We use your data only to run New GL: signing you in, storing and showing your books, generating reports,
            and powering the features you turn on. We do not sell your data, we do not use it for advertising, and we
            do not use your ledger data to train AI models.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>We share data only with the service providers we need to run the product:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Supabase</strong> hosts our database and handles authentication.
            </li>
            <li>
              <strong>Google</strong> handles sign-in, if you choose &ldquo;Continue with Google&rdquo;.
            </li>
            <li>
              <strong>Anthropic</strong> powers AI suggestions. When those run, we send only the fields the
              suggestion needs (for example, payee, memo, amount, and date for categorization). We never send account
              balances or your full ledger. You can turn AI off entirely under Settings &rarr; AI, and then nothing is
              sent.
            </li>
          </ul>
          <p className="mt-3">We may also disclose information if the law requires us to.</p>
        </Section>

        <Section title="Your data, your control">
          <p>
            Your ledger is a plain-text Beancount file. You can download it any time from Settings &rarr; Ledger and
            use it outside New GL. To correct your information or delete your account and everything in it, email us
            at the address below.
          </p>
        </Section>

        <Section title="Security and retention">
          <p>
            Data is encrypted in transit, and each company&apos;s data is kept separate from every other company&apos;s.
            We keep your data for as long as your account is open. Once you delete your account, we delete your data,
            except where the law requires us to keep it longer.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If we change this policy, we&apos;ll update the date at the top of this page. For significant changes,
            we&apos;ll also notify you by email or in the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about privacy? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--color-link-action)] hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-global)]">{title}</h2>
      {children}
    </section>
  );
}

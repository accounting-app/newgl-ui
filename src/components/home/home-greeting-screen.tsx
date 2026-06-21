import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function HomeGreetingScreen() {
  return (
    <main className="h-full bg-[var(--color-container-background-accent)] px-6 py-8 md:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-8">
          <div className="mb-6 flex flex-col gap-4">
            <Image style={{height: 'auto', width: 'auto'}} src="/logo-big.png" alt="Simple" width={180} height={180} priority />
            <h2 className="text-4xl font-semibold text-[var(--color-text-global)]">
              Hello, John. Welcome to Simple.
            </h2>
          </div>
          <p className="mx-auto max-w-2xl text-lg text-[var(--color-text-primary)]">
          This is your home screen. From here, you can quickly navigate to the register and start working on your transactions.
          </p>
        </section>

        <section>
          <article className="h-full w-full rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-6">
            <div className="mb-3 inline-flex rounded-lg bg-[var(--color-highlight-badge-background)] p-2 text-[var(--color-highlight-badge-text)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-[var(--color-text-global)]">Start your workflow</h2>
            <p className="mb-4 text-[var(--color-text-primary)]">
              First recommended task: register a transaction to start building your accounting history.
            </p>
            <div className="mb-5 rounded-lg bg-[var(--color-container-background-accent)] p-4 text-sm text-[var(--color-text-primary)]">
              <p>- Select transaction type</p>
              <p>- Complete amount and associated account</p>
              <p>- Save and validate the balance</p>
            </div>
            <Link href="/register" className="inline-flex items-center gap-1 text-[var(--color-link-action)] hover:underline">
              Go to Register <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </section>
      </div>
    </main>
  );
}

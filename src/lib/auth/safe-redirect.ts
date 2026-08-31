/**
 * Validates a `?next=` redirect target used after a privileged action
 * (sign-in, or Supabase's email-confirmation/magic-link code exchange).
 *
 * Only a same-origin, single-leading-slash relative path is allowed --
 * anything else (a full URL, a protocol-relative `//host` URL, or a
 * backslash-prefixed path some browsers normalize to `//host`) falls back
 * to `/`. Without this, an attacker-crafted link like
 * `/login?next=https://evil.example` (or `//evil.example`) could redirect
 * a user who just authenticated straight to an external site -- a classic
 * open-redirect, made worse here because the redirect happens right after
 * a real login/auth-code exchange, not an anonymous page view.
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next) return "/";
  // Exactly one leading slash, never two ("//host" is protocol-relative)
  // and never a backslash (some browsers treat "\" like "/" in a URL,
  // making "/\host" behave like "//host").
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

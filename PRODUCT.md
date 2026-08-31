# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small business owners doing their own bookkeeping -- one owner/operator per
company, managing their own bank register, reconciliation, and reports
without an external bookkeeper in the loop. The `CompanyPicker` supports
switching between multiple companies from one account, but the primary user
is the owner of those books, not a third-party accountant.

## Product Purpose

A general ledger accounting workspace: bank register with reconciliation,
double-entry journal entries, CSV bank-transaction import with rule-based
categorization, chart of accounts, and financial reports (P&L, P&L Detail,
Balance Sheet, Trial Balance, Aging, By Payee). Every company's real ledger
data is a Beancount (`.bean`) file, managed per company under Settings ->
Ledger (create, upload, edit with live syntax linting, version history,
bulk paste import, download/export).

## Positioning

The ledger is a real, plain-text Beancount file you fully own -- downloadable,
diffable, versionable, and usable outside this app -- not a black-box
database locked inside a SaaS vendor. This is the same underlying engine as
the open-source, self-hostable sibling project (PlainGL); quickslike is the
hosted, multi-tenant version of that same plain-text-ledger idea. A
competitor like QuickBooks or Xero could not truthfully make the same
data-ownership claim.

## Operating Context

- Multi-tenant: one account can hold multiple companies (`CompanyPicker` in
  the header), each with a fully separate ledger, files, and settings --
  switching companies must never leak data across them.
- Bank register is the day-to-day workspace: transactions, splits, transfers,
  reconciliation status, bank rules for auto-categorizing imported rows.
- CSV import: bulk bank-transaction import with a mapping step and review
  table before posting.
- Reports read from the same ledger data live -- no separate reporting
  database to keep in sync.
- An AI settings area (`/settings/ai`) exists for AI-assisted workflows, but
  is not (per this session) the product's core differentiator.

## Capabilities and Constraints

- Backed by Bun + Hono (`newgl-api`) and Supabase (Postgres + Auth) for
  multi-tenancy, RLS, and everything that isn't the ledger file itself.
- The Beancount file is validated (`parseBeancount` +
  `isPlausibleBeancountDocument`) and normalized on every write; stored
  content is never guaranteed byte-identical to what a user pasted or
  uploaded.
- Company-scoped data isolation is a hard constraint, not a preference --
  confirmed by explicit product correction earlier in this project's history
  (a ledger-files feature was rebuilt specifically because it leaked a
  cross-company file list).

## Product Principles

- Data ownership over lock-in: the user's ledger is always a real file they
  can take with them.
- One company's data must never be visible while a different company is
  active -- switching companies is a hard boundary, not a filter.
- Prefer the plain-text ledger as source of truth; the UI is a workspace over
  it, not a replacement for it.
- Small-business-owner-first: workflows should not assume bookkeeping
  expertise the primary user doesn't have.

import type { Account } from "@/modules/accounting/domain/models";

/**
 * Next code in the shared incrementing sequence every seeded account
 * already uses (1000, 1010, 1020, ...). Shared by every "create an
 * account" entry point (Chart of Accounts' own form, the Register's inline
 * "+ Add new" account picker, ...) so they never hand out colliding codes.
 */
export function nextAccountCode(accounts: Account[]): string {
  const highest = accounts.reduce((max, account) => {
    const numeric = Number(account.code);
    return Number.isFinite(numeric) && numeric > max ? numeric : max;
  }, 990);
  return String(highest + 10);
}

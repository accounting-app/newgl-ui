/**
 * Accounting integrity verification against the audit plan.
 *
 * Run with: bun run scripts/verify-accounting.ts
 *
 * Checks (plan §1, §2, §4, §6):
 *  - Trial balance nets to zero (debits = credits)
 *  - Accounting equation holds (Assets = Liabilities + Equity)
 *  - Every posted transaction is balanced (double-entry)
 *  - Cleared/reconciled rows cannot be edited or deleted (immutability)
 *  - Editing/deleting a pending row keeps the books balanced
 *  - Period validation is in effect
 */
import { createMockAccountingServices } from "@/modules/accounting/mocks/mock-services";
import {
  calculateTrialBalance,
  generateBalanceSheet,
  getBankReconciliationSummary,
  validateDoubleEntry
} from "@/modules/accounting/domain/accounting-reports";
import { validateTransactionPeriod } from "@/modules/accounting/domain/periods";

let failures = 0;

function check(label: string, passed: boolean, detail = ""): void {
  const status = passed ? "PASS" : "FAIL";
  if (!passed) failures += 1;
  console.log(`[${status}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function expectThrows(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(label, false, "expected an error but none was thrown");
  } catch (error) {
    check(label, true, (error as Error).message);
  }
}

async function main(): Promise<void> {
  const services = createMockAccountingServices();

  const accounts = await services.accountService.listAccounts();
  const transactions = await services.transactionService.listTransactions();
  const postings = await services.ledgerService.listPostings();

  // §1 trial balance
  const trial = calculateTrialBalance(postings);
  check("Trial balance nets to zero", trial.balanced, `debits=${trial.totalDebits}, credits=${trial.totalCredits}`);

  // §6 balance sheet
  const sheet = generateBalanceSheet(accounts);
  check(
    "Accounting equation Assets = Liabilities + Equity",
    sheet.balanced,
    `assets=${sheet.assets}, liab+equity=${sheet.liabilitiesAndEquity}`
  );

  // §1 every posted transaction balanced
  const unbalanced = transactions
    .filter((transaction) => transaction.status !== "DELETED")
    .filter((transaction) => {
      try {
        validateDoubleEntry(transaction.postings);
        return false;
      } catch {
        return true;
      }
    });
  check("Every transaction is balanced", unbalanced.length === 0, `${unbalanced.length} unbalanced`);

  const cash = accounts.find((account) => account.name === "Cash on hand");
  if (!cash) {
    check("Cash on hand account exists", false);
    finish();
    return;
  }

  const entries = await services.registerService.listRegisterEntries(cash.id);

  // §6 reconciliation summary
  const summary = getBankReconciliationSummary(entries);
  check(
    "Reconciliation summary totals to register balance",
    Math.abs(summary.totalBalance - (entries[0]?.runningBalance ?? 0)) < 0.01,
    `cleared=${summary.clearedBalance}, uncleared=${summary.unclearedBalance}, total=${summary.totalBalance}`
  );

  // §2 immutability: reconciled row (TX-1004) cannot be edited or deleted
  const reconciled = entries.find((entry) => entry.refNumber === "TX-1004");
  if (reconciled) {
    await expectThrows("Editing a reconciled row is blocked", () =>
      services.registerService.updateRegisterEntry(reconciled.id, {
        date: reconciled.date,
        refNumber: reconciled.refNumber,
        payee: reconciled.payee,
        memo: reconciled.memo,
        deposit: 999
      })
    );
    await expectThrows("Deleting a reconciled row is blocked", () =>
      services.registerService.deleteRegisterEntry(reconciled.id)
    );
  } else {
    check("Reconciled seed row (TX-1004) present", false);
  }

  // §2/§6 editing a pending row keeps the books balanced
  const pendingToEdit = entries.find((entry) => entry.refNumber === "TX-1003");
  if (pendingToEdit) {
    await services.registerService.updateRegisterEntry(pendingToEdit.id, {
      date: pendingToEdit.date,
      refNumber: pendingToEdit.refNumber,
      payee: pendingToEdit.payee,
      memo: pendingToEdit.memo,
      payment: 500
    });
    const sheetAfterEdit = generateBalanceSheet(await services.accountService.listAccounts());
    check("Balance sheet stays balanced after editing a pending row", sheetAfterEdit.balanced);
    const trialAfterEdit = calculateTrialBalance(await services.ledgerService.listPostings());
    check("Trial balance stays balanced after editing a pending row", trialAfterEdit.balanced);
  } else {
    check("Pending seed row (TX-1003) present", false);
  }

  // §2/§6 deleting a pending row keeps the books balanced
  const pendingToDelete = entries.find((entry) => entry.refNumber === "TX-1002");
  if (pendingToDelete) {
    await services.registerService.deleteRegisterEntry(pendingToDelete.id);
    const sheetAfterDelete = generateBalanceSheet(await services.accountService.listAccounts());
    check("Balance sheet stays balanced after deleting a pending row", sheetAfterDelete.balanced);
    const trialAfterDelete = calculateTrialBalance(await services.ledgerService.listPostings());
    check("Trial balance stays balanced after deleting a pending row", trialAfterDelete.balanced);
  } else {
    check("Pending seed row (TX-1002) present", false);
  }

  // §4 period validation
  try {
    validateTransactionPeriod("2026-05-15");
    check("Open period accepts a transaction date", true);
  } catch (error) {
    check("Open period accepts a transaction date", false, (error as Error).message);
  }

  finish();
}

function finish(): void {
  console.log("");
  if (failures === 0) {
    console.log("All accounting checks passed.");
  } else {
    console.log(`${failures} accounting check(s) failed.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

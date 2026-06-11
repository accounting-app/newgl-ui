import type {
  Account,
  ChartOfAccount,
  LedgerPosting,
  RegisterEntry,
  Transaction
} from "@/modules/accounting/domain/models";

export type AccountingStore = {
  accounts: Account[];
  chartAccounts: ChartOfAccount[];
  transactions: Transaction[];
  ledgerPostings: LedgerPosting[];
  registerEntries: RegisterEntry[];
};

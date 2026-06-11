"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { ledgerEventBus } from "@/shared/event-bus";
import type {
  Account,
  LedgerPosting,
  ReconcileStatus,
  RegisterEntry,
  Transaction
} from "@/modules/accounting/domain/models";
import {
  isAccountFieldDisabledForTransactionType,
  getSupportedTransactionTypesForAccount,
  isInflowTransactionType,
  isOutflowTransactionType,
  isRegisterAccountCategory,
  toDomainTransactionType
} from "@/modules/accounting/presentation/transaction-type-policy";
import { generateNextRefNumber } from "@/modules/accounting/domain/accounting-reports";
import type {
  BankRegisterTransactionTypeId,
  BankRegisterTransactionTypeOption
} from "@/modules/accounting/presentation/transaction-type-policy";

export type DraftTransactionForm = {
  transactionTypeId: BankRegisterTransactionTypeId;
  transactionTypeLabel: string;
  date: string;
  refNo: string;
  payee: string;
  accountTypeId: string;
  memo: string;
  payment: string;
  deposit: string;
  reconcileStatus: ReconcileStatus;
};

export type DraftTransactionErrors = Partial<
  Record<"date" | "payee" | "accountTypeId" | "payment" | "deposit" | "amount" | "form", string>
>;

export type InlineEntryEditorInput = {
  date: string;
  refNo: string;
  payee: string;
  accountTypeId: string;
  memo: string;
  payment: string;
  deposit: string;
  reconcileStatus: ReconcileStatus;
};

export function nextReconcileStatus(current: ReconcileStatus): ReconcileStatus {
  if (current === "") return "C";
  if (current === "C") return "R";
  return "";
}

function findCounterpartyAccount(
  accounts: Account[],
  selectedAccountId: string,
  preferredNames: string[]
): Account | undefined {
  return (
    preferredNames
      .map((name) => accounts.find((account) => account.name === name))
      .find((account): account is Account => Boolean(account && account.id !== selectedAccountId)) ??
    accounts.find((account) => account.id !== selectedAccountId)
  );
}

export function useBankRegister() {
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedTransactionType, setSelectedTransactionType] =
    useState<BankRegisterTransactionTypeId>("CHECK");
  const [draftTransaction, setDraftTransaction] = useState<DraftTransactionForm | null>(null);
  const [draftErrors, setDraftErrors] = useState<DraftTransactionErrors>({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [existingRefNumbers, setExistingRefNumbers] = useState<string[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedPostings, setSelectedPostings] = useState<LedgerPosting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId]
  );
  const availableTransactionTypes = useMemo<BankRegisterTransactionTypeOption[]>(
    () => getSupportedTransactionTypesForAccount(selectedAccount),
    [selectedAccount]
  );
  const generalBalance = useMemo(() => {
    if (entries.length > 0) {
      return entries[0].runningBalance;
    }
    if (selectedAccount) {
      return selectedAccount.currentBalance;
    }
    return 0;
  }, [entries, selectedAccount]);

  const refreshAccounts = useCallback(async () => {
    const accountList = await services.accountService.listAccounts();
    setAccounts(accountList);
    if (!selectedAccountId && accountList.length > 0) {
      const firstRegisterAccount =
        accountList.find((account) => isRegisterAccountCategory(account.category)) ?? accountList[0];
      setSelectedAccountId(firstRegisterAccount.id);
    }
  }, [selectedAccountId, services.accountService]);

  const refreshEntries = useCallback(async () => {
    if (!selectedAccountId) {
      setEntries([]);
      return;
    }
    const registerEntries = await services.registerService.listRegisterEntries(selectedAccountId);
    setEntries(registerEntries);
  }, [selectedAccountId, services.registerService]);

  const refreshRefNumbers = useCallback(async () => {
    const transactions = await services.transactionService.listTransactions();
    setExistingRefNumbers(
      transactions
        .map((transaction) => transaction.referenceNumber)
        .filter((reference): reference is string => Boolean(reference))
    );
  }, [services.transactionService]);

  useEffect(() => {
    refreshAccounts().catch((value: unknown) => {
      setError(value instanceof Error ? value.message : "Failed to load accounts.");
    });
  }, [refreshAccounts]);

  useEffect(() => {
    refreshEntries().catch((value: unknown) => {
      setError(value instanceof Error ? value.message : "Failed to load register entries.");
    });
  }, [refreshEntries]);

  useEffect(() => {
    refreshRefNumbers().catch(() => undefined);
  }, [refreshRefNumbers]);

  useEffect(() => {
    const unsubscribe = ledgerEventBus.subscribe("*", () => {
      refreshAccounts().catch(() => undefined);
      refreshEntries().catch(() => undefined);
      refreshRefNumbers().catch(() => undefined);
    });
    return unsubscribe;
  }, [refreshAccounts, refreshEntries, refreshRefNumbers]);

  useEffect(() => {
    const selectedSupported = availableTransactionTypes.some(
      (transactionType) => transactionType.id === selectedTransactionType
    );
    if (!selectedSupported && availableTransactionTypes.length > 0) {
      setSelectedTransactionType(availableTransactionTypes[0].id);
    }
  }, [availableTransactionTypes, selectedTransactionType]);

  useEffect(() => {
    setDraftTransaction(null);
    setDraftErrors({});
  }, [selectedAccountId]);

  const startDraftTransaction = useCallback(
    (transactionTypeId: BankRegisterTransactionTypeId) => {
      if (!selectedAccountId) {
        setError("Select an account first.");
        return;
      }
      const selectedTypeLabel =
        availableTransactionTypes.find((option) => option.id === transactionTypeId)?.label ??
        transactionTypeId.replaceAll("_", " ");
      setSelectedTransactionType(transactionTypeId);
      void refreshRefNumbers();
      setDraftTransaction({
        transactionTypeId,
        transactionTypeLabel: selectedTypeLabel,
        date: new Date().toISOString().slice(0, 10),
        refNo: generateNextRefNumber(existingRefNumbers),
        payee: "",
        accountTypeId: "",
        memo: "",
        payment: "",
        deposit: "",
        reconcileStatus: ""
      });
      setDraftErrors({});
      setError(null);
    },
    [availableTransactionTypes, existingRefNumbers, refreshRefNumbers, selectedAccountId]
  );

  const updateDraftField = useCallback(
    (field: keyof Omit<DraftTransactionForm, "transactionTypeId" | "transactionTypeLabel">, value: string) => {
      setDraftTransaction((current) => (current ? { ...current, [field]: value } : current));
      setDraftErrors((current) => ({ ...current, [field]: undefined, amount: undefined, form: undefined }));
    },
    []
  );

  const cancelDraftTransaction = useCallback(() => {
    setDraftTransaction(null);
    setDraftErrors({});
  }, []);

  const selectTransaction = useCallback(
    async (transactionId: string) => {
      try {
        const detail = await services.registerService.getTransactionDetail(transactionId);
        setSelectedTransaction(detail.transaction);
        setSelectedPostings(detail.postings);
        setError(null);
      } catch (value: unknown) {
        setError(value instanceof Error ? value.message : "Unable to load transaction detail.");
      }
    },
    [services.registerService]
  );

  const saveDraftTransaction = useCallback(async () => {
    if (!draftTransaction || !selectedAccountId || isSavingDraft) {
      return;
    }

    const payment = Number(draftTransaction.payment || 0);
    const deposit = Number(draftTransaction.deposit || 0);
    const amount = deposit > 0 ? deposit : payment;
    const isAccountFieldDisabled = isAccountFieldDisabledForTransactionType(
      draftTransaction.transactionTypeId
    );
    const errors: DraftTransactionErrors = {};

    if (!draftTransaction.date) {
      errors.date = "Date is required.";
    }
    if (!isAccountFieldDisabled && !draftTransaction.accountTypeId) {
      errors.accountTypeId = "Select an account.";
    }
    if (!isAccountFieldDisabled && draftTransaction.accountTypeId === selectedAccountId) {
      errors.accountTypeId = "An account can't be its own offset account.";
    }
    if (payment > 0 && deposit > 0) {
      errors.amount = "Use payment or deposit, not both.";
    }
    if (payment <= 0 && deposit <= 0) {
      errors.amount = "Enter payment or deposit.";
    }
    if (payment < 0 || deposit < 0) {
      errors.amount = "Amounts must be positive.";
    }
    if (isInflowTransactionType(draftTransaction.transactionTypeId) && payment > 0) {
      errors.payment = "This transaction type expects a deposit.";
    }
    if (isOutflowTransactionType(draftTransaction.transactionTypeId) && deposit > 0) {
      errors.deposit = "This transaction type expects a payment.";
    }

    if (Object.keys(errors).length > 0) {
      setDraftErrors(errors);
      return;
    }

    const referenceNumber =
      draftTransaction.refNo.trim() || generateNextRefNumber(existingRefNumbers);
    const domainTransactionType = toDomainTransactionType(draftTransaction.transactionTypeId);

    const selectedCounterparty = accounts.find(
      (account) => account.id !== selectedAccountId && account.id === draftTransaction.accountTypeId
    );

    try {
      setIsSavingDraft(true);
      if (draftTransaction.transactionTypeId === "TRANSFER") {
        const destination =
          selectedCounterparty ?? accounts.find((account) => account.id !== selectedAccountId);
        if (!destination) {
          setDraftErrors({ form: "Need at least two accounts for transfers." });
          return;
        }

        const selectedIsDestination = deposit > 0;
        await services.transactionService.createTransfer({
          transactionDate: draftTransaction.date,
          referenceNumber,
          memo: draftTransaction.memo.trim() || undefined,
          payee: draftTransaction.payee.trim() || undefined,
          accountLabel: destination.name,
          sourceAccountId: selectedAccountId,
          reconcileStatus: draftTransaction.reconcileStatus || undefined,
          postings: selectedIsDestination
            ? [
                { accountId: selectedAccountId, type: "DEBIT", amount },
                { accountId: destination.id, type: "CREDIT", amount }
              ]
            : [
                { accountId: destination.id, type: "DEBIT", amount },
                { accountId: selectedAccountId, type: "CREDIT", amount }
              ]
        });
      } else if (isInflowTransactionType(draftTransaction.transactionTypeId)) {
        const incomeAccount =
          selectedCounterparty ??
          findCounterpartyAccount(accounts, selectedAccountId, [
            "Personal income",
            "Owners investment",
            "Retained Earnings"
          ]);
        if (!incomeAccount) {
          setDraftErrors({ form: "Select an account for this transaction." });
          return;
        }

        if (domainTransactionType === "DEPOSIT") {
          await services.transactionService.createDeposit({
            transactionDate: draftTransaction.date,
            referenceNumber,
            memo: draftTransaction.memo.trim() || undefined,
            payee: draftTransaction.payee.trim() || undefined,
            accountLabel: incomeAccount.name,
            sourceAccountId: selectedAccountId,
            reconcileStatus: draftTransaction.reconcileStatus || undefined,
            postings: [
              { accountId: selectedAccountId, type: "DEBIT", amount },
              { accountId: incomeAccount.id, type: "CREDIT", amount }
            ]
          });
        } else {
          const transaction = await services.transactionService.createTransaction({
            type: domainTransactionType,
            transactionDate: draftTransaction.date,
            referenceNumber,
            memo: draftTransaction.memo.trim() || undefined,
            payee: draftTransaction.payee.trim() || undefined,
            accountLabel: incomeAccount.name,
            sourceAccountId: selectedAccountId,
            reconcileStatus: draftTransaction.reconcileStatus || undefined,
            postings: [
              { accountId: selectedAccountId, type: "DEBIT", amount },
              { accountId: incomeAccount.id, type: "CREDIT", amount }
            ]
          });
          await services.transactionService.postTransaction(transaction.id);
        }
      } else {
        const expenseOrOffset =
          selectedCounterparty ??
          findCounterpartyAccount(accounts, selectedAccountId, [
            "Personal expense",
            "Charitable donations",
            "Retained Earnings"
          ]);
        if (!expenseOrOffset) {
          setDraftErrors({ form: "Select an account for this transaction." });
          return;
        }
        const selectedPostingType = payment > 0 ? "CREDIT" : "DEBIT";
        const offsetPostingType = selectedPostingType === "CREDIT" ? "DEBIT" : "CREDIT";
        const transaction = await services.transactionService.createTransaction({
          type: domainTransactionType,
          transactionDate: draftTransaction.date,
          referenceNumber,
          memo: draftTransaction.memo.trim() || undefined,
          payee: draftTransaction.payee.trim() || undefined,
          accountLabel: expenseOrOffset.name,
          sourceAccountId: selectedAccountId,
          reconcileStatus: draftTransaction.reconcileStatus || undefined,
          postings: [
            { accountId: expenseOrOffset.id, type: offsetPostingType, amount },
            { accountId: selectedAccountId, type: selectedPostingType, amount }
          ]
        });
        await services.transactionService.postTransaction(transaction.id);
      }

      setDraftTransaction(null);
      setDraftErrors({});
      setError(null);
    } catch (value: unknown) {
      setDraftErrors({
        form: value instanceof Error ? value.message : "Failed to create transaction."
      });
    } finally {
      setIsSavingDraft(false);
    }
  }, [
    accounts,
    draftTransaction,
    existingRefNumbers,
    isSavingDraft,
    selectedAccountId,
    services.transactionService
  ]);

  const addSelectedTransaction = useCallback(() => {
    startDraftTransaction(selectedTransactionType);
  }, [selectedTransactionType, startDraftTransaction]);

  const selectTransactionType = useCallback(
    (transactionTypeId: BankRegisterTransactionTypeId) => {
      setSelectedTransactionType(transactionTypeId);
      startDraftTransaction(transactionTypeId);
    },
    [startDraftTransaction]
  );

  const voidTransaction = useCallback(
    async (transactionId: string) => {
      try {
        await services.transactionService.voidTransaction(transactionId);
        setSelectedTransaction(null);
        setSelectedPostings([]);
        setError(null);
      } catch (value: unknown) {
        setError(value instanceof Error ? value.message : "Void failed.");
      }
    },
    [services.transactionService]
  );

  const reverseTransaction = useCallback(
    async (transactionId: string) => {
      try {
        await services.transactionService.reverseTransaction(transactionId);
        setSelectedTransaction(null);
        setSelectedPostings([]);
        setError(null);
      } catch (value: unknown) {
        setError(value instanceof Error ? value.message : "Reversal failed.");
      }
    },
    [services.transactionService]
  );

  const updateRegisterEntryInline = useCallback(
    async (entryId: string, input: InlineEntryEditorInput) => {
      const payment = Number(input.payment || 0);
      const deposit = Number(input.deposit || 0);
      await services.registerService.updateRegisterEntry(entryId, {
        date: input.date,
        refNumber: input.refNo || undefined,
        payee: input.payee || undefined,
        memo: input.memo || undefined,
        payment: payment > 0 ? payment : undefined,
        deposit: deposit > 0 ? deposit : undefined,
        reconcileStatus: input.reconcileStatus,
        counterpartyAccountId: input.accountTypeId || undefined
      });
      await refreshEntries();
      await refreshAccounts();
    },
    [refreshAccounts, refreshEntries, services.registerService]
  );

  const cycleDraftReconcileStatus = useCallback(() => {
    setDraftTransaction((current) =>
      current ? { ...current, reconcileStatus: nextReconcileStatus(current.reconcileStatus) } : current
    );
  }, []);

  const cycleReconcileStatus = useCallback(
    async (entryId: string) => {
      const entry = entries.find((item) => item.id === entryId);
      const next = nextReconcileStatus(entry?.reconcileStatus ?? "");
      setEntries((previous) =>
        previous.map((item) => (item.id === entryId ? { ...item, reconcileStatus: next } : item))
      );
      try {
        await services.registerService.setReconcileStatus(entryId, next);
      } catch (value: unknown) {
        await refreshEntries();
        setError(value instanceof Error ? value.message : "Failed to update reconcile status.");
      }
    },
    [entries, refreshEntries, services.registerService]
  );

  const deleteRegisterEntryInline = useCallback(
    async (entryId: string) => {
      await services.registerService.deleteRegisterEntry(entryId);
      await refreshEntries();
      await refreshAccounts();
    },
    [refreshAccounts, refreshEntries, services.registerService]
  );

  return {
    accounts,
    entries,
    availableTransactionTypes,
    generalBalance,
    selectedAccountId,
    selectedAccount,
    selectedTransaction,
    selectedTransactionType,
    selectedPostings,
    draftErrors,
    draftTransaction,
    error,
    isSavingDraft,
    setSelectedAccountId,
    addSelectedTransaction,
    cancelDraftTransaction,
    cycleDraftReconcileStatus,
    cycleReconcileStatus,
    deleteRegisterEntryInline,
    updateRegisterEntryInline,
    selectTransactionType,
    saveDraftTransaction,
    selectTransaction,
    updateDraftField,
    voidTransaction,
    reverseTransaction
  };
}

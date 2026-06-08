# Accounting Audit Plan — Accounting Project (Frontend / Mock Data)

> **Current context:** The project is a React/JS frontend with no backend. All data is mock (hardcoded or in JSON/JS files). This plan defines which accounting principles must be respected **now, at the data and frontend logic layer**, so that when a real backend is connected, the foundation is solid and correct.

---

## Table of Contents

1. [Double-Entry Bookkeeping](#1-double-entry-bookkeeping)
2. [Record Immutability and Integrity](#2-record-immutability-and-integrity)
3. [Accrual vs Cash Basis](#3-accrual-vs-cash-basis)
4. [Accounting Periods and Period Close](#4-accounting-periods-and-period-close)
5. [Consistency and Chart of Accounts](#5-consistency-and-chart-of-accounts)
6. [Disclosure and Financial Reporting](#6-disclosure-and-financial-reporting)
7. [Recommended Mock Data Structure](#7-recommended-mock-data-structure)
8. [Master Prompt for Cursor](#8-master-prompt-for-cursor)

---

## 1. Double-Entry Bookkeeping

**Principle:** Every transaction affects at least two accounts. The sum of debits must always equal the sum of credits.

### Current state (frontend with mock data)

The Bank Register displays transactions with `PAYMENT` and `DEPOSIT` columns, but the mock data likely has no separate `journal_entries` table recording both sides of each entry.

### Checks to implement

- [ ] **Mock data structure with journal entries**
  Mock data must include not just the transaction, but the accounting entries that compose it.

  ```js
  // ❌ Wrong — only records the bank movement
  const transactions = [
    {
      id: 'TX-1012',
      date: '2026-05-24',
      payee: 'IRS',
      memo: 'Tax prepayment',
      payment: 210.00,
      balance: 1795.10,
    }
  ]

  // ✅ Correct — includes both entries (double-entry)
  const transactions = [
    {
      id: 'TX-1012',
      date: '2026-05-24',
      payee: 'IRS',
      memo: 'Tax prepayment',
      type: 'check',
      payment: 210.00,
      balance: 1795.10,
      account: 'ACC-5010',
      journalEntries: [
        { accountId: 'ACC-5010', accountName: 'Federal estimated tax', type: 'debit',  amount: 210.00 },
        { accountId: 'ACC-1010', accountName: 'Cash on hand',          type: 'credit', amount: 210.00 },
      ]
    }
  ]
  ```

- [ ] **Balance validator function**
  Create a utility function that verifies the journal entries of each transaction are balanced.

  ```js
  // src/utils/accounting.js
  export function validateDoubleEntry(journalEntries) {
    const totalDebits  = journalEntries
      .filter(e => e.type === 'debit')
      .reduce((sum, e) => sum + e.amount, 0)

    const totalCredits = journalEntries
      .filter(e => e.type === 'credit')
      .reduce((sum, e) => sum + e.amount, 0)

    const diff = Math.abs(totalDebits - totalCredits)
    if (diff > 0.001) {
      throw new Error(`Unbalanced transaction: debits ${totalDebits} ≠ credits ${totalCredits}`)
    }
    return true
  }
  ```

- [ ] **Validate all mock data on app load (development only)**

  ```js
  // src/data/index.js
  if (import.meta.env.DEV) {
    mockTransactions.forEach(tx => {
      try {
        validateDoubleEntry(tx.journalEntries)
      } catch (e) {
        console.error(`[Accounting] ${tx.id}: ${e.message}`)
      }
    })
  }
  ```

- [ ] **Trial Balance calculable from mock data**
  A function must exist that sums all debits and credits in the system and confirms the result is zero.

  ```js
  export function calculateTrialBalance(transactions) {
    let totalDebits = 0
    let totalCredits = 0
    transactions.forEach(tx => {
      tx.journalEntries.forEach(entry => {
        if (entry.type === 'debit')  totalDebits  += entry.amount
        if (entry.type === 'credit') totalCredits += entry.amount
      })
    })
    return { totalDebits, totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.001 }
  }
  ```

- [ ] **Account type sign logic (DEAD rule)**

  | Account type   | Debit       | Credit      |
  |---------------|-------------|-------------|
  | Assets        | ↑ Increases | ↓ Decreases |
  | Expenses      | ↑ Increases | ↓ Decreases |
  | Liabilities   | ↓ Decreases | ↑ Increases |
  | Income        | ↓ Decreases | ↑ Increases |
  | Capital/Equity| ↓ Decreases | ↑ Increases |

  Verify that the `journalEntries` in the mock data respect this logic for each transaction type.

---

## 2. Record Immutability and Integrity

**Principle:** Accounting records are never deleted or edited. Errors are corrected with reversal entries.

### Checks to implement

- [ ] **Status field on every transaction**

  ```js
  // Possible statuses
  const TX_STATUS = {
    PENDING:    'pending',    // Entered, not yet reviewed
    CLEARED:    'cleared',    // C — confirmed by the bank
    RECONCILED: 'reconciled', // R — included in a closed reconciliation
    VOIDED:     'voided',     // Cancelled with a counter-entry
  }
  ```

  The current mock data shows "C" and "R" in the check (✓) column. These must be mapped to this enum.

- [ ] **Guard functions for edit/delete operations**

  ```js
  export function canEditTransaction(tx) {
    if (tx.status === TX_STATUS.CLEARED || tx.status === TX_STATUS.RECONCILED) {
      throw new Error(`Transaction ${tx.id} is ${tx.status} and cannot be edited. Create a reversal entry instead.`)
    }
    return true
  }

  export function canDeleteTransaction(tx) {
    if (tx.status !== TX_STATUS.PENDING) {
      throw new Error(`Only pending transactions can be deleted.`)
    }
    return true
  }
  ```

- [ ] **Reversal function instead of DELETE**

  ```js
  export function createReversalEntry(originalTx) {
    return {
      id: generateNextRefNumber(),
      date: new Date().toISOString().split('T')[0],
      payee: originalTx.payee,
      memo: `Reversal of ${originalTx.id}: ${originalTx.memo}`,
      type: 'reversal',
      status: TX_STATUS.PENDING,
      reversalOf: originalTx.id,
      journalEntries: originalTx.journalEntries.map(entry => ({
        ...entry,
        type: entry.type === 'debit' ? 'credit' : 'debit', // Flip debit/credit
      }))
    }
  }
  ```

- [ ] **Unique and sequential reference numbers**

  ```js
  // TX-1012, TX-1011... must be generated sequentially
  // and must not be reused even if the transaction is voided
  export function generateNextRefNumber(transactions) {
    const maxNum = transactions.reduce((max, tx) => {
      const num = parseInt(tx.id.replace('TX-', ''))
      return num > max ? num : max
    }, 1000)
    return `TX-${maxNum + 1}`
  }
  ```

- [ ] **Dates: transaction_date vs created_at**

  ```js
  // Every transaction must have two separate date fields
  {
    id: 'TX-1012',
    transactionDate: '2026-05-24',       // Date of the accounting event (editable before period close)
    createdAt: '2026-05-24T14:32:00Z',   // When it was entered into the system (never editable)
    updatedAt: '2026-05-24T14:32:00Z',
  }
  ```

- [ ] **Audit log in mock data**
  Even in a frontend-only project, the mock should include a change log array to prepare the structure.

  ```js
  {
    id: 'TX-1012',
    // ...
    auditLog: [
      { action: 'created', userId: 'user-1', timestamp: '2026-05-24T14:32:00Z', changes: null },
    ]
  }
  ```

---

## 3. Accrual vs Cash Basis

**Principle:** The system must clearly declare which accounting basis it uses.

### Observation from current mock data

The register shows `Cash on hand` as the selected account, which suggests **cash basis**. However, transactions like "Client payment invoice #44" imply a prior invoice (accrual basis).

### Checks to implement

- [ ] **Declare the accounting basis in system config**

  ```js
  // src/config/accounting.js
  export const ACCOUNTING_CONFIG = {
    basis: 'cash', // 'cash' | 'accrual'
    fiscalYearStart: '01-01', // MM-DD
    currency: 'USD',
    currencySymbol: '$',
  }
  ```

- [ ] **If basis is "cash": verify no AR/AP accounts are active**
  In cash basis, Accounts Receivable and Accounts Payable must not be used as income/expense accounts.

- [ ] **If basis is "accrual": each payment must link to an invoice**

  ```js
  // Accrual basis: the payment references an invoice
  {
    id: 'TX-1004',
    payee: 'Client A',
    memo: 'Client payment invoice #44',
    type: 'receive_payment',
    invoiceId: 'INV-0044', // Required reference in accrual basis
    journalEntries: [
      { accountId: 'ACC-1010', accountName: 'Cash on hand',        type: 'debit',  amount: 680.00 },
      { accountId: 'ACC-1200', accountName: 'Accounts Receivable', type: 'credit', amount: 680.00 },
    ]
  }
  ```

- [ ] **Consistency between tax prepayment and accounting basis**
  `TX-1012` (Tax prepayment to IRS) must be classified correctly: in cash basis it is an expense when paid; in accrual basis it may be a prepaid asset.

---

## 4. Accounting Periods and Period Close

**Principle:** Records are organized by periods. Closed periods are immutable.

### Checks to implement

- [ ] **Period structure in mock data**

  ```js
  // src/data/periods.js
  export const mockPeriods = [
    {
      id: 'period-2026-05',
      name: 'May 2026',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      status: 'open', // 'open' | 'closed' | 'locked'
      openingBalance: 1115.10, // Balance at the start of the period
      closingBalance: 1795.10, // Calculated when the period is closed
    }
  ]
  ```

- [ ] **Validate the period when creating a transaction**

  ```js
  export function validateTransactionPeriod(transactionDate, periods) {
    const period = periods.find(p =>
      transactionDate >= p.startDate && transactionDate <= p.endDate
    )
    if (!period) throw new Error('No accounting period found for this date.')
    if (period.status === 'closed') throw new Error(`Period ${period.name} is closed. Cannot add transactions.`)
    if (period.status === 'locked') throw new Error(`Period ${period.name} is locked by an administrator.`)
    return period
  }
  ```

- [ ] **Running balance must be recalculable**
  The balance shown on each Bank Register row must be recalculable at any time from the period's opening balance.

  ```js
  export function recalculateRunningBalances(transactions, openingBalance) {
    // Sort by date, then by id to break ties
    const sorted = [...transactions].sort((a, b) =>
      a.transactionDate.localeCompare(b.transactionDate) || a.id.localeCompare(b.id)
    )

    let balance = openingBalance
    return sorted.map(tx => {
      balance += (tx.deposit || 0) - (tx.payment || 0)
      return { ...tx, calculatedBalance: parseFloat(balance.toFixed(2)) }
    })
  }
  ```

- [ ] **Verify mock data balance consistency**

  ```js
  // Run in development to detect errors in mock data
  if (import.meta.env.DEV) {
    const recalculated = recalculateRunningBalances(mockTransactions, openingBalance)
    recalculated.forEach(tx => {
      if (Math.abs(tx.calculatedBalance - tx.balance) > 0.01) {
        console.error(`[Balance mismatch] ${tx.id}: stored=${tx.balance}, calculated=${tx.calculatedBalance}`)
      }
    })
  }
  ```

---

## 5. Consistency and Chart of Accounts

**Principle:** All transactions must be classified using a structured chart of accounts, not free-form strings.

### Issue detected in current mock data

Accounts appear as free strings: `"Personal income"`, `"Federal estimated tax"`, `"Mortgage"`, `"Personal expense"`. This prevents generating correct financial reports.

### Checks to implement

- [ ] **Create a structured chart of accounts**

  ```js
  // src/data/chartOfAccounts.js
  export const chartOfAccounts = [
    // ASSETS (1000-1999)
    { id: 'ACC-1010', code: '1010', name: 'Cash on hand',          type: 'asset',     subtype: 'bank' },
    { id: 'ACC-1020', code: '1020', name: 'Checking account',      type: 'asset',     subtype: 'bank' },
    { id: 'ACC-1200', code: '1200', name: 'Accounts Receivable',   type: 'asset',     subtype: 'receivable' },
    // LIABILITIES (2000-2999)
    { id: 'ACC-2010', code: '2010', name: 'Credit Card Payable',   type: 'liability', subtype: 'credit_card' },
    { id: 'ACC-2200', code: '2200', name: 'Accounts Payable',      type: 'liability', subtype: 'payable' },
    // EQUITY (3000-3999)
    { id: 'ACC-3010', code: '3010', name: "Owner's Investment",    type: 'equity',    subtype: 'owners_equity' },
    { id: 'ACC-3900', code: '3900', name: 'Retained Earnings',     type: 'equity',    subtype: 'retained_earnings' },
    // INCOME (4000-4999)
    { id: 'ACC-4010', code: '4010', name: 'Service Revenue',       type: 'income',    subtype: 'revenue' },
    { id: 'ACC-4020', code: '4020', name: 'Sales Revenue',         type: 'income',    subtype: 'revenue' },
    // EXPENSES (5000-5999)
    { id: 'ACC-5010', code: '5010', name: 'Federal Estimated Tax', type: 'expense',   subtype: 'tax' },
    { id: 'ACC-5020', code: '5020', name: 'Rent Expense',          type: 'expense',   subtype: 'rent' },
    { id: 'ACC-5030', code: '5030', name: 'Phone Expense',         type: 'expense',   subtype: 'utilities' },
    { id: 'ACC-5040', code: '5040', name: 'Utilities Expense',     type: 'expense',   subtype: 'utilities' },
  ]
  ```

- [ ] **Map current mock data strings to the chart of accounts**

  | Current mock (string)      | Correct Account ID                   | Type    |
  |---------------------------|--------------------------------------|---------|
  | `"Personal income"`       | `ACC-4010` Service Revenue           | income  |
  | `"Federal estimated tax"` | `ACC-5010` Federal Estimated Tax     | expense |
  | `"Mortgage"`              | `ACC-5020` Rent Expense              | expense |
  | `"Phone (> $200)"`        | `ACC-5030` Phone Expense             | expense |
  | `"Personal expense"`      | ⚠️ See note below                   | —       |
  | `"Credit Card Payable"`   | `ACC-2010` Credit Card Payable       | liability |
  | `"Owners investment"`     | `ACC-3010` Owner's Investment        | equity  |

  > ⚠️ **"Personal expense"** and **"Personal income"** suggest a mix of personal and business finances. The system should flag this with a warning (entity principle violation).

- [ ] **Validate that transfers do not affect P&L**
  `TX-1010` and `TX-1005` are transfers to `Credit Card Payable`. They must only affect asset/liability accounts, never income or expense accounts.

  ```js
  export function validateTransferAccounts(journalEntries, chartOfAccounts) {
    const affectedTypes = journalEntries.map(entry => {
      const account = chartOfAccounts.find(a => a.id === entry.accountId)
      return account?.type
    })
    const affectsIncomeOrExpense = affectedTypes.some(t => t === 'income' || t === 'expense')
    if (affectsIncomeOrExpense) {
      console.warn('[Accounting] Transfer transaction is affecting income/expense accounts. This may be incorrect.')
    }
  }
  ```

- [ ] **Transaction types with defined accounting behavior**

  ```js
  // src/config/transactionTypes.js
  export const TRANSACTION_TYPES = {
    check: {
      label: 'Check',
      defaultDebitAccount: null,        // Defined by user (expense account)
      defaultCreditAccount: 'ACC-1010', // Cash on hand
      affectsPL: true,
    },
    deposit: {
      label: 'Deposit',
      defaultDebitAccount: 'ACC-1010',  // Cash on hand
      defaultCreditAccount: null,        // Defined by user (income account)
      affectsPL: true,
    },
    transfer: {
      label: 'Transfer',
      affectsPL: false, // Transfers NEVER affect P&L
    },
    receive_payment: {
      label: 'Receive Payment',
      defaultDebitAccount: 'ACC-1010',
      defaultCreditAccount: 'ACC-1200', // Accounts Receivable (accrual) or income (cash)
      affectsPL: true,
    },
    bill_payment: {
      label: 'Bill Payment',
      defaultDebitAccount: 'ACC-2200',  // Accounts Payable
      defaultCreditAccount: 'ACC-1010', // Cash on hand
      affectsPL: false, // Expense was already recorded when it was incurred
    },
  }
  ```

---

## 6. Disclosure and Financial Reporting

**Principle:** Reports must reconcile with each other and accurately reflect financial reality.

### Checks to implement

- [ ] **Function to generate a Balance Sheet from mock data**

  ```js
  export function generateBalanceSheet(transactions, chartOfAccounts) {
    const balances = {}
    chartOfAccounts.forEach(acc => { balances[acc.id] = 0 })

    transactions.forEach(tx => {
      tx.journalEntries.forEach(entry => {
        const account = chartOfAccounts.find(a => a.id === entry.accountId)
        if (!account) return
        // Debits increase assets/expenses; credits increase liabilities/income/equity
        const isDebitNormal = ['asset', 'expense'].includes(account.type)
        const sign = (entry.type === 'debit') === isDebitNormal ? 1 : -1
        balances[account.id] += entry.amount * sign
      })
    })

    const assets      = chartOfAccounts.filter(a => a.type === 'asset')    .reduce((s, a) => s + balances[a.id], 0)
    const liabilities = chartOfAccounts.filter(a => a.type === 'liability').reduce((s, a) => s + balances[a.id], 0)
    const equity      = chartOfAccounts.filter(a => a.type === 'equity')   .reduce((s, a) => s + balances[a.id], 0)

    const balanced = Math.abs(assets - (liabilities + equity)) < 0.01

    if (!balanced) {
      console.error(`[Balance Sheet] DOES NOT BALANCE: Assets=${assets}, Liabilities+Equity=${liabilities + equity}`)
    }

    return { assets, liabilities, equity, balanced, balances }
  }
  ```

- [ ] **The accounting equation must always hold**
  ```
  Assets = Liabilities + Equity
  ```
  If this equation does not hold with the mock data, there is an error in the journal entries.

- [ ] **Bank reconciliation**
  The "C" (cleared) and "R" (reconciled) statuses in the Bank Register must feed a reconciliation module:

  ```js
  export function getBankReconciliationSummary(transactions) {
    const cleared   = transactions.filter(t => t.status === 'cleared' || t.status === 'reconciled')
    const uncleared = transactions.filter(t => t.status === 'pending')

    const clearedBalance   = cleared.reduce((s, t) => s + (t.deposit || 0) - (t.payment || 0), 0)
    const unclearedBalance = uncleared.reduce((s, t) => s + (t.deposit || 0) - (t.payment || 0), 0)

    return { clearedBalance, unclearedBalance, totalBalance: clearedBalance + unclearedBalance }
  }
  ```

- [ ] **Amounts always positive; sign is determined by the column**
  In the Bank Register, `payment` and `deposit` must always be `>= 0`. Never use negative amounts in these fields.

  ```js
  export function validateTransactionAmounts(tx) {
    if (tx.payment !== undefined && tx.payment < 0) {
      throw new Error(`${tx.id}: payment amount must be positive (got ${tx.payment})`)
    }
    if (tx.deposit !== undefined && tx.deposit < 0) {
      throw new Error(`${tx.id}: deposit amount must be positive (got ${tx.deposit})`)
    }
  }
  ```

- [ ] **Warning for mixing personal and business finances**
  Automatically detect accounts labeled as "personal" and warn the user.

  ```js
  const PERSONAL_ACCOUNT_KEYWORDS = ['personal', 'personal income', 'personal expense']

  export function detectPersonalMixing(transaction) {
    const accountName = transaction.account?.toLowerCase() || ''
    if (PERSONAL_ACCOUNT_KEYWORDS.some(k => accountName.includes(k))) {
      return {
        warning: true,
        message: `⚠️ "${transaction.account}" appears to be a personal account. Consider separating business and personal finances to maintain accurate accounting records.`
      }
    }
    return { warning: false }
  }
  ```

---

## 7. Recommended Mock Data Structure

Complete recommended structure for mock data files, ready to connect to a backend:

```js
// src/data/mockTransactions.js

export const mockTransactions = [
  {
    // Identification
    id:        'TX-1012',
    refNumber: 'TX-1012',

    // Dates
    transactionDate: '2026-05-24',
    createdAt:       '2026-05-24T14:30:00Z',
    updatedAt:       '2026-05-24T14:30:00Z',

    // Classification
    type:   'check',     // check | deposit | transfer | expense | bill_payment | receive_payment
    status: 'pending',   // pending | cleared | reconciled | voided

    // Parties involved
    payee:    'IRS',
    account:  'ACC-5010',        // FK to chart of accounts (not a free string)
    periodId: 'period-2026-05',

    // Amounts (always positive)
    payment: 210.00,
    deposit: null,
    balance: 1795.10,            // Running balance (redundant — always recalculate)

    // Description
    memo: 'Tax prepayment',

    // Double-entry — REQUIRED
    journalEntries: [
      {
        id:          'JE-2024-001',
        accountId:   'ACC-5010',
        accountName: 'Federal Estimated Tax',
        accountType: 'expense',
        type:        'debit',
        amount:      210.00,
      },
      {
        id:          'JE-2024-002',
        accountId:   'ACC-1010',
        accountName: 'Cash on hand',
        accountType: 'asset',
        type:        'credit',
        amount:      210.00,
      }
    ],

    // Traceability
    reversalOf: null,  // ID of the original TX if this is a reversal
    auditLog: [
      {
        action:    'created',
        userId:    'user-001',
        timestamp: '2026-05-24T14:30:00Z',
        changes:   null,
      }
    ]
  }
]
```

---

## 8. Master Prompt for Cursor

Use this prompt at the beginning of each audit session in Cursor:

```
Act as a senior accounting auditor reviewing an accounting software project.

The project is currently frontend-only with mock data (no backend). I need you to:

1. Review all mock data files (JSON/JS) and verify that:
   - Every transaction has journalEntries with debits and credits that balance
   - Payment and deposit amounts are always positive
   - Dates have separate transactionDate and createdAt fields
   - The account field references an ID from the chart of accounts, not a free string

2. Review the business logic functions and verify that:
   - Guards exist to prevent editing or deleting cleared or reconciled transactions
   - Reversals create counter-entries instead of deleting records
   - Transfers between accounts do not affect income or expense accounts
   - A function exists to validate that debits === credits on every transaction

3. Verify running balance consistency:
   - The balance on each row must be recalculable from the opening balance
   - The period ending balance must match the sum of all movements

4. For each issue found: show the file, the exact line, explain which accounting
   principle is violated, and propose the corrected code.

Start by listing all data files and components related to the accounting module.
```

---

## Priority Checklist

| Priority | Area | Task |
|---|---|---|
| 🔴 Critical | Double-entry | Add `journalEntries` to all mock data |
| 🔴 Critical | Double-entry | Create `validateDoubleEntry()` and run it in DEV |
| 🔴 Critical | Immutability | Add `status` field to all mock transactions |
| 🔴 Critical | Immutability | Create guard to block editing cleared/reconciled transactions |
| 🟠 Important | Chart of accounts | Replace free-string account names with chart of accounts IDs |
| 🟠 Important | Running balance | Implement `recalculateRunningBalances()` and verify mock |
| 🟠 Important | Periods | Create `mockPeriods` with opening/closing balance |
| 🟠 Important | Transfers | Verify TX-1010 and TX-1005 do not affect P&L |
| 🟡 Standard | Reports | Implement `generateBalanceSheet()` and verify the equation |
| 🟡 Standard | Reconciliation | Connect C/R statuses to the reconciliation module |
| 🟡 Standard | Entity principle | Detect and warn about mixed personal accounts |
| 🟡 Standard | Dates | Add separate `transactionDate` and `createdAt` to mock |

---

*This document should be kept up to date as the project progresses. When a backend is connected, all frontend validations must be replicated on the server side as well.*

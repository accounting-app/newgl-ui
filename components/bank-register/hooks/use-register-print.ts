import { useCallback } from "react";
import type { RegisterEntry } from "@/modules/accounting/domain/models";

type UseRegisterPrintParams = {
  entries: RegisterEntry[];
  userName: string;
  selectedAccountName: string;
  endingBalance: number;
  formatTransactionTypeLabel: (transactionType: RegisterEntry["transactionType"]) => string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function useRegisterPrint({
  entries,
  userName,
  selectedAccountName,
  endingBalance,
  formatTransactionTypeLabel
}: UseRegisterPrintParams) {
  return useCallback(() => {
    if (typeof window === "undefined") return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rows = entries
      .map((entry) => {
        const date = escapeHtml(entry.date);
        const refNumber = escapeHtml(entry.refNumber ?? "");
        const payee = escapeHtml(entry.payee ?? "");
        const memo = escapeHtml(entry.memo ?? "");
        const payment = entry.payment ? entry.payment.toFixed(2) : "";
        const deposit = entry.deposit ? entry.deposit.toFixed(2) : "";
        const reconcileStatus = escapeHtml(entry.reconcileStatus);
        const balance = entry.runningBalance.toFixed(2);
        const transactionType = escapeHtml(formatTransactionTypeLabel(entry.transactionType));
        const account = escapeHtml(entry.accountLabel ?? "");

        return `
          <tr class="top-row">
            <td>${date}</td>
            <td>${refNumber}</td>
            <td>${payee}</td>
            <td>${memo}</td>
            <td class="number">${payment}</td>
            <td class="number">${deposit}</td>
            <td class="center">${reconcileStatus}</td>
            <td class="number balance">${balance}</td>
          </tr>
          <tr class="bottom-row">
            <td></td>
            <td>${transactionType}</td>
            <td>${account}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `;
      })
      .join("");

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(userName)}</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        margin: 24px;
        color: #21262a;
      }
      .header {
        margin-bottom: 14px;
      }
      .title {
        font-size: 20px;
        font-weight: 700;
        margin: 0;
      }
      .meta {
        margin-top: 4px;
        font-size: 12px;
        color: #6b7280;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 13px;
      }
      th, td {
        border: 1px solid #d4d7dc;
        padding: 6px 8px;
        vertical-align: top;
      }
      th {
        background: #f4f5f8;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.04em;
        text-align: left;
      }
      .number {
        text-align: right;
      }
      .center {
        text-align: center;
      }
      .balance {
        font-weight: 700;
      }
      .bottom-row td {
        color: #6b7280;
        background: #fafafa;
      }
      @media print {
        body {
          margin: 12px;
        }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1 class="title">${escapeHtml(userName)}</h1>
      <div class="meta">${escapeHtml(selectedAccountName)} Ending Balance: ${escapeHtml(toCurrency(endingBalance))}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Ref No.</th>
          <th>Payee</th>
          <th>Memo</th>
          <th class="number">Payment</th>
          <th class="number">Deposit</th>
          <th class="center">✓</th>
          <th class="number">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    const triggerPrint = () => {
      try {
        printWindow.print();
      } catch {
        // no-op
      }
    };

    printWindow.onload = triggerPrint;
    window.setTimeout(triggerPrint, 350);
  }, [endingBalance, entries, formatTransactionTypeLabel, selectedAccountName, userName]);
}

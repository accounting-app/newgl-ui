import { useCallback } from "react";
import type { RegisterEntry } from "@/modules/accounting/domain/models";

type UseRegisterExportParams = {
  entries: RegisterEntry[];
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

function toFileSafeDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function useRegisterExport({
  entries,
  selectedAccountName,
  endingBalance,
  formatTransactionTypeLabel
}: UseRegisterExportParams) {
  return useCallback(() => {
    if (typeof window === "undefined") return;

    const rows = entries
      .map((entry) => {
        const date = escapeHtml(entry.date);
        const refNumber = escapeHtml(entry.refNumber ?? "");
        const type = escapeHtml(formatTransactionTypeLabel(entry.transactionType));
        const payee = escapeHtml(entry.payee ?? "");
        const account = escapeHtml(entry.accountLabel ?? "");
        const memo = escapeHtml(entry.memo ?? "");
        const payment = entry.payment ? entry.payment.toFixed(2) : "";
        const deposit = entry.deposit ? entry.deposit.toFixed(2) : "";
        const reconcile = escapeHtml(entry.reconcileStatus ?? "");
        const balance = entry.runningBalance.toFixed(2);

        return `
          <tr>
            <td>${date}</td>
            <td>${refNumber}</td>
            <td>${type}</td>
            <td>${payee}</td>
            <td>${account}</td>
            <td>${memo}</td>
            <td style="mso-number-format:'0.00'; text-align:right;">${payment}</td>
            <td style="mso-number-format:'0.00'; text-align:right;">${deposit}</td>
            <td style="text-align:center;">${reconcile}</td>
            <td style="mso-number-format:'0.00'; text-align:right;">${balance}</td>
          </tr>
        `;
      })
      .join("");

    const worksheet = `
      <table border="1">
        <tr>
          <td colspan="6"><b>${escapeHtml(selectedAccountName)}</b></td>
          <td colspan="4" style="text-align:right;"><b>Ending Balance: ${escapeHtml(toCurrency(endingBalance))}</b></td>
        </tr>
        <tr>
          <td>Date</td>
          <td>Ref No.</td>
          <td>Type</td>
          <td>Payee</td>
          <td>Account</td>
          <td>Memo</td>
          <td>Payment</td>
          <td>Deposit</td>
          <td>✓</td>
          <td>Balance</td>
        </tr>
        ${rows}
      </table>
    `;

    const workbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          ${worksheet}
        </body>
      </html>
    `;

    const blob = new Blob([workbook], {
      type: "application/vnd.ms-excel;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `register-${toFileSafeDate(new Date())}.xls`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [endingBalance, entries, formatTransactionTypeLabel, selectedAccountName]);
}

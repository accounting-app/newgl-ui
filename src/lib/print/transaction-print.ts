import { amountInWords } from "@/lib/print/amount-in-words";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

// The printable page for a saved transaction: a plain document, or a check.

const TITLES: Partial<Record<Transaction["type"], string>> = {
  CHECK: "Check",
  DEPOSIT: "Deposit",
  SALES_RECEIPT: "Sales Receipt",
  RECEIVE_PAYMENT: "Payment Receipt",
  BILL_PAYMENT: "Bill Payment",
  EXPENSE: "Expense",
  JOURNAL_ENTRY: "Journal Entry",
  REFUND: "Refund",
  TRANSFER: "Transfer"
};

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const usDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const escape = (value: string) => value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const multiline = (value: string) => escape(value).replace(/\n/g, "<br>");

function table(heads: string[], rows: string[][], numeric: number[]): string {
  const cell = (tag: "th" | "td", value: string, index: number) => `<${tag}${numeric.includes(index) ? ' class="n"' : ""}>${escape(value)}</${tag}>`;
  return `<table><thead><tr>${heads.map((h, i) => cell("th", h, i)).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v, i) => cell("td", v, i)).join("")}</tr>`).join("")}</tbody></table>`;
}

export function transactionPrintHtml(txn: Transaction, accounts: Account[], companyName: string, layout: "document" | "check" = "document"): string {
  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? "";
  const source = txn.type === "JOURNAL_ENTRY" ? undefined : txn.postings.find((p) => p.accountId === txn.sourceAccountId);
  const total = source ? source.amount : txn.postings.filter((p) => p.type === "DEBIT").reduce((sum, p) => sum + p.amount, 0);
  // With a paying or deposit account, list the other lines (a line on its own side, like cash back, is negative).
  const lines = source
    ? table(
        ["Account", "Description", "Amount"],
        txn.postings.filter((p) => p !== source).map((p) => [accountName(p.accountId), p.description ?? "", money(p.type === source.type ? -p.amount : p.amount)]),
        [2]
      )
    : table(
        ["Account", "Debits", "Credits", "Description", "Name"],
        txn.postings.map((p) => [accountName(p.accountId), p.type === "DEBIT" ? money(p.amount) : "", p.type === "CREDIT" ? money(p.amount) : "", p.description ?? "", p.details?.name ?? ""]),
        [1, 2]
      );
  const address = txn.details?.mailing ?? txn.details?.billing ?? "";
  const number = txn.details?.number ?? txn.referenceNumber ?? "";
  const field = (label: string, value: string | undefined) => (value ? `<p><b>${label}:</b> ${multiline(value)}</p>` : "");

  const check =
    layout === "check"
      ? `<section class="check">
<p class="right">${usDate(txn.transactionDate)}</p>
<p class="line"><span>Pay to the order of&nbsp; <b>${escape(txn.payee ?? "")}</b></span><b>**${escape(money(total).slice(1))}</b></p>
<p class="line"><span>${escape(amountInWords(total))}</span><span>Dollars</span></p>
<p>${multiline(address)}</p>
<p>${txn.memo ? `Memo: ${escape(txn.memo)}` : ""}</p>
</section>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(TITLES[txn.type] ?? "Transaction")}${number ? ` ${escape(number)}` : ""}</title>
<style>
body{font:13px/1.5 Arial,Helvetica,sans-serif;color:#111;margin:32px}
h1{font-size:22px;margin:0}header{display:flex;justify-content:space-between;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ccc;padding:6px 8px;text-align:left}
.n,.right{text-align:right}.total{text-align:right;font-size:15px;margin-top:12px}
.check{height:3in;border-bottom:1px dashed #999;margin-bottom:24px}.line{display:flex;justify-content:space-between;border-bottom:1px solid #999;padding-bottom:2px}
</style></head><body>
${check}
<header><div><h1>${escape(TITLES[txn.type] ?? "Transaction")}</h1>${escape(companyName)}</div>
<div class="right">${number ? `No. ${escape(number)}<br>` : ""}Date ${usDate(txn.transactionDate)}</div></header>
${field(source?.type === "DEBIT" ? "Received from" : "Payee", txn.payee)}
${layout === "check" ? "" : field("Address", address)}
${field(source ? "Account" : "", source ? accountName(source.accountId) : undefined)}
${field("Payment method", txn.paymentMethod)}
${lines}
<p class="total"><b>Total ${escape(money(total))}</b></p>
${field("Memo", txn.memo)}
</body></html>`;
}

/** Prints through a hidden frame, so no pop-up window is needed. */
export function printHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.onload = () => {
    const view = frame.contentWindow;
    if (!view) return;
    view.onafterprint = () => frame.remove();
    view.focus();
    view.print();
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}

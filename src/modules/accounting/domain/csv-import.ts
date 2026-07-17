export type ParsedCsvRow = {
  clientRowId: string;
  rawDate: string;
  rawPayee: string;
  rawDescription: string;
  rawAmount: string;
  transactionDate: string | null;
  payee: string;
  memo: string;
  amount: number | null;
  categoryAccountId: string | null;
  parseErrors: string[];
};

export type ReviewRow = ParsedCsvRow;

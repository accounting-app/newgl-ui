type AmountLine = { debit: string; credit: string };

const cents = (value: string) => Math.round((Number(value) || 0) * 100);

/**
 * RightTool's "Multiply by %": every debit and credit becomes that percentage of
 * itself. Rounding can leave a balanced entry a few cents apart; that difference
 * goes on the largest line of the short side so it stays balanced.
 */
export function multiplyLines<T extends AmountLine>(lines: T[], percent: number): T[] {
  const sides = ["debit", "credit"] as const;
  const total = (list: T[], side: "debit" | "credit") => list.reduce((sum, line) => sum + cents(line[side]), 0);
  const wasBalanced = total(lines, "debit") === total(lines, "credit");
  const scaled = lines.map((line) => {
    const next = { ...line };
    for (const side of sides) if (cents(line[side]) > 0) next[side] = (Math.round((cents(line[side]) * percent) / 100) / 100).toFixed(2);
    return next;
  });
  const difference = total(scaled, "debit") - total(scaled, "credit");
  if (!wasBalanced || difference === 0) return scaled;
  const short = difference > 0 ? "credit" : "debit";
  const largest = scaled.reduce((best, line, index) => (cents(line[short]) > cents(scaled[best][short]) ? index : best), 0);
  scaled[largest] = { ...scaled[largest], [short]: ((cents(scaled[largest][short]) + Math.abs(difference)) / 100).toFixed(2) };
  return scaled;
}

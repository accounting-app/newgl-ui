/**
 * The arithmetic behind Receive Payment and Bill Payment: how much of the money
 * and of earlier credits goes to each invoice or bill. All amounts are cents.
 */

export type Owed = { id: string; open: number };
export type Source = { id: string; available: number };
export type Application = { documentId: string; sourceId: string; cents: number };

/** Spreads money over what is owed, oldest first; the last one may be part-paid. */
export function distribute(total: number, owed: Owed[]): Record<string, number> {
  const result: Record<string, number> = {};
  let left = total;
  for (const item of owed) {
    const paying = Math.min(left, item.open);
    if (paying <= 0) break;
    result[item.id] = paying;
    left -= paying;
  }
  return result;
}

/** Matches each document's payment to its sources, using them in the order given. */
export function planApplications(payments: { id: string; cents: number }[], sources: Source[]): Application[] {
  const left = sources.map((source) => ({ ...source }));
  const plan: Application[] = [];
  for (const payment of payments) {
    let owing = payment.cents;
    for (const source of left) {
      const taken = Math.min(owing, source.available);
      if (taken <= 0) continue;
      plan.push({ documentId: payment.id, sourceId: source.id, cents: taken });
      source.available -= taken;
      owing -= taken;
    }
  }
  return plan;
}

/** Why these figures can't be saved, or null when they can. */
export function allocationProblem(input: {
  money: number;
  payments: { cents: number; open: number }[];
  credits: { cents: number; available: number }[];
  noun: "invoice" | "bill";
}): string | null {
  const applied = input.payments.reduce((sum, p) => sum + p.cents, 0);
  const credit = input.credits.reduce((sum, c) => sum + c.cents, 0);
  if (input.payments.some((p) => p.cents > p.open)) return `A payment is more than its ${input.noun}'s open balance.`;
  if (input.credits.some((c) => c.cents > c.available)) return "A credit is more than what it has left.";
  if (credit > applied) return `Credits can only be used on the ${input.noun}s you're paying.`;
  if (applied > input.money + credit) return `The ${input.noun} payments are more than the amount plus the credits used.`;
  return null;
}

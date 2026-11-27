const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion"];

function belowThousand(value: number): string {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const words = hundreds ? [ONES[hundreds], "Hundred"] : [];
  if (rest >= 20) words.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : ""));
  else if (rest) words.push(ONES[rest]);
  return words.join(" ");
}

/** The written amount on a check, e.g. "One Hundred Five and 07/100". */
export function amountInWords(amount: number): string {
  const totalCents = Math.round(Math.abs(amount) * 100);
  let dollars = Math.floor(totalCents / 100);
  const parts: string[] = [];
  for (let scale = 0; dollars > 0; scale += 1, dollars = Math.floor(dollars / 1000)) {
    const group = dollars % 1000;
    if (group) parts.unshift([belowThousand(group), SCALES[scale]].filter(Boolean).join(" "));
  }
  return `${parts.join(" ") || "Zero"} and ${String(totalCents % 100).padStart(2, "0")}/100`;
}

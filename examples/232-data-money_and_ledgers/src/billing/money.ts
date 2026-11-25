// Display helpers. Amounts are always integer cents; formatting is the only place decimals appear.
export function formatCents(cents: number, currency = "USD"): string {
    if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(cents);
    const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fraction = String(abs % 100).padStart(2, "0");
    const symbol = currency === "USD" ? "$" : `${currency} `;
    return `${sign}${symbol}${whole}.${fraction}`;
}

// Parses user input like "1,234.5" or "12" into cents. Rejects more than two decimals.
export function parseDollars(input: string): number {
    const cleaned = input.trim().replace(/^\$/, "").replaceAll(",", "");
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
    if (!match) throw new Error(`Not an amount: ${input}`);
    return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

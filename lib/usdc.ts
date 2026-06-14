export const CENTS_PER_USD = 100;
export const MICRO_USDC_PER_CENT = 10000n; // 1 cent = 10,000 micro-USDC (6 decimals)
export const MAX_WITHDRAW_CENTS = 50000; // $500.00

export function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function displayToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToMicroUSDC(cents: number): bigint {
  return BigInt(cents) * MICRO_USDC_PER_CENT;
}

export function validateWithdrawCents(cents: unknown): string | null {
  if (!Number.isInteger(cents) || (cents as number) <= 0) {
    return "cents must be a positive integer";
  }
  if ((cents as number) > MAX_WITHDRAW_CENTS) {
    return `maximum withdrawal is ${centsToDisplay(MAX_WITHDRAW_CENTS)}`;
  }
  return null;
}

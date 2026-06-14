import { describe, it, expect } from "vitest";
import {
  centsToDisplay,
  displayToCents,
  centsToMicroUSDC,
  validateWithdrawCents,
  MICRO_USDC_PER_CENT,
  MAX_WITHDRAW_CENTS,
} from "../lib/usdc";

describe("centsToDisplay", () => {
  it("formats whole dollar amounts", () => {
    expect(centsToDisplay(100)).toBe("$1.00");
    expect(centsToDisplay(500)).toBe("$5.00");
    expect(centsToDisplay(10000)).toBe("$100.00");
  });

  it("formats fractional dollar amounts", () => {
    expect(centsToDisplay(50)).toBe("$0.50");
    expect(centsToDisplay(1)).toBe("$0.01");
    expect(centsToDisplay(999)).toBe("$9.99");
  });

  it("formats zero", () => {
    expect(centsToDisplay(0)).toBe("$0.00");
  });
});

describe("displayToCents", () => {
  it("converts whole dollars to cents", () => {
    expect(displayToCents(1)).toBe(100);
    expect(displayToCents(10)).toBe(1000);
    expect(displayToCents(500)).toBe(50000);
  });

  it("rounds fractional cents correctly", () => {
    expect(displayToCents(9.99)).toBe(999);
    expect(displayToCents(0.505)).toBe(51); // rounds up when exactly half-cent
    expect(displayToCents(1.234)).toBe(123);
  });

  it("round-trips with centsToDisplay", () => {
    const amounts = [1, 5, 10, 25, 100];
    for (const usd of amounts) {
      expect(displayToCents(usd) / 100).toBe(usd);
    }
  });
});

describe("centsToMicroUSDC", () => {
  it("converts 1 cent to 10,000 micro-USDC", () => {
    expect(centsToMicroUSDC(1)).toBe(MICRO_USDC_PER_CENT);
    expect(centsToMicroUSDC(1)).toBe(10000n);
  });

  it("converts $1.00 (100 cents) to 1,000,000 micro-USDC", () => {
    expect(centsToMicroUSDC(100)).toBe(1_000_000n);
  });

  it("converts $10.00 (1000 cents) to 10,000,000 micro-USDC", () => {
    expect(centsToMicroUSDC(1000)).toBe(10_000_000n);
  });

  it("returns a bigint", () => {
    expect(typeof centsToMicroUSDC(50)).toBe("bigint");
  });
});

describe("validateWithdrawCents", () => {
  it("accepts a valid positive integer", () => {
    expect(validateWithdrawCents(100)).toBeNull();
    expect(validateWithdrawCents(1)).toBeNull();
    expect(validateWithdrawCents(MAX_WITHDRAW_CENTS)).toBeNull();
  });

  it("rejects zero", () => {
    expect(validateWithdrawCents(0)).toMatch(/positive/);
  });

  it("rejects negative values", () => {
    expect(validateWithdrawCents(-1)).toMatch(/positive/);
  });

  it("rejects non-integers", () => {
    expect(validateWithdrawCents(1.5)).toMatch(/positive/);
    expect(validateWithdrawCents(NaN)).toMatch(/positive/);
    expect(validateWithdrawCents(Infinity)).toMatch(/positive/);
  });

  it("rejects non-numeric types", () => {
    expect(validateWithdrawCents("100")).toMatch(/positive/);
    expect(validateWithdrawCents(null)).toMatch(/positive/);
    expect(validateWithdrawCents(undefined)).toMatch(/positive/);
  });

  it(`rejects amounts above $${MAX_WITHDRAW_CENTS / 100}`, () => {
    expect(validateWithdrawCents(MAX_WITHDRAW_CENTS + 1)).toMatch(/maximum/);
  });

  it("accepts exactly the maximum", () => {
    expect(validateWithdrawCents(MAX_WITHDRAW_CENTS)).toBeNull();
  });
});

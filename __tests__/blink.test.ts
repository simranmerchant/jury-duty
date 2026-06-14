import { describe, it, expect } from "vitest";
import {
  validateBlinkRequest,
  buildBlinkPayload,
  BLINK_CHAIN_ID,
  BLINK_USDC_BASE,
  MIN_DEPOSIT_USD,
  MAX_DEPOSIT_USD,
} from "../lib/blink";

const ADDR = "0xDeAdBeEf000000000000000000000000DeAdBeEf";

describe("validateBlinkRequest", () => {
  const valid = {
    amount: 10,
    chainId: BLINK_CHAIN_ID,
    address: ADDR,
    token: BLINK_USDC_BASE,
  };

  it("accepts a valid request", () => {
    expect(validateBlinkRequest(valid)).toBeNull();
  });

  it("rejects non-finite amount", () => {
    expect(validateBlinkRequest({ ...valid, amount: NaN })).toMatch(/amount/);
    expect(validateBlinkRequest({ ...valid, amount: Infinity })).toMatch(/amount/);
    expect(validateBlinkRequest({ ...valid, amount: "10" })).toMatch(/amount/);
  });

  it("rejects amount <= 0", () => {
    expect(validateBlinkRequest({ ...valid, amount: 0 })).toMatch(/amount/);
    expect(validateBlinkRequest({ ...valid, amount: -5 })).toMatch(/amount/);
  });

  it(`rejects amount below $${MIN_DEPOSIT_USD}`, () => {
    expect(validateBlinkRequest({ ...valid, amount: MIN_DEPOSIT_USD - 0.01 })).toMatch(/minimum/);
  });

  it(`rejects amount above $${MAX_DEPOSIT_USD}`, () => {
    expect(validateBlinkRequest({ ...valid, amount: MAX_DEPOSIT_USD + 1 })).toMatch(/maximum/);
  });

  it("rejects unsupported chainId", () => {
    expect(validateBlinkRequest({ ...valid, chainId: 1 })).toMatch(/chain/);
  });

  it("rejects malformed address", () => {
    expect(validateBlinkRequest({ ...valid, address: "notanaddress" })).toMatch(/address/);
    expect(validateBlinkRequest({ ...valid, address: "0x123" })).toMatch(/address/);
  });

  it("rejects wrong token", () => {
    expect(validateBlinkRequest({ ...valid, token: "0xOther" })).toMatch(/token/);
  });

  it("accepts case-insensitive token", () => {
    expect(validateBlinkRequest({ ...valid, token: BLINK_USDC_BASE.toLowerCase() })).toBeNull();
  });
});

describe("buildBlinkPayload", () => {
  it("sets all required fields", () => {
    const p = buildBlinkPayload(10, ADDR, BLINK_CHAIN_ID, BLINK_USDC_BASE, null, "v1");
    expect(p.amount).toBe(10);
    expect(p.chainId).toBe(BLINK_CHAIN_ID);
    expect(p.address).toBe(ADDR);
    expect(p.token).toBe(BLINK_USDC_BASE);
    expect(p.callbackScheme).toBeNull();
    expect(p.version).toBe("v1");
    expect(typeof p.idempotencyKey).toBe("string");
    expect(typeof p.signatureTimestamp).toBe("string");
  });

  it("echoes callbackScheme from SignerRequest", () => {
    const p = buildBlinkPayload(10, ADDR, BLINK_CHAIN_ID, BLINK_USDC_BASE, "myapp", "v1");
    expect(p.callbackScheme).toBe("myapp");
  });

  it("generates a unique idempotencyKey each call", () => {
    const a = buildBlinkPayload(10, ADDR, BLINK_CHAIN_ID, BLINK_USDC_BASE, null, "v1");
    const b = buildBlinkPayload(10, ADDR, BLINK_CHAIN_ID, BLINK_USDC_BASE, null, "v1");
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
  });

  it("signatureTimestamp is a valid ISO 8601 date", () => {
    const p = buildBlinkPayload(5, ADDR, BLINK_CHAIN_ID, BLINK_USDC_BASE, null, "v1");
    expect(() => new Date(p.signatureTimestamp).toISOString()).not.toThrow();
  });
});

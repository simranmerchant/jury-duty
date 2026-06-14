// crypto.randomUUID() is available globally in Node 18+ and all modern browsers
export const BLINK_CHAIN_ID = 8453; // Base
export const BLINK_USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const POINTS_PER_USD = 100; // cents per USD (1 point = $0.01)
export const MIN_DEPOSIT_USD = 1;
export const MAX_DEPOSIT_USD = 500;

export type BlinkSignerPayload = {
  amount: number;
  chainId: number;
  address: string;
  token: string;
  idempotencyKey: string;
  callbackScheme: string | null;
  signatureTimestamp: string;
  version: string;
};

export type BlinkSignerResponse = {
  merchantId: string;
  payload: string;
  signature: string;
  preview: {
    amount: number;
    chainId: number;
    address: string;
    token: string;
    idempotencyKey: string;
  };
};

export function validateBlinkRequest(params: {
  amount: unknown;
  chainId: unknown;
  address: unknown;
  token: unknown;
}): string | null {
  const { amount, chainId, address, token } = params;
  if (!Number.isFinite(amount) || (amount as number) <= 0) return "invalid amount";
  if ((amount as number) < MIN_DEPOSIT_USD) return `minimum deposit is $${MIN_DEPOSIT_USD}`;
  if ((amount as number) > MAX_DEPOSIT_USD) return `maximum deposit is $${MAX_DEPOSIT_USD}`;
  if (chainId !== BLINK_CHAIN_ID) return `unsupported chain ${chainId}`;
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return "invalid address";
  }
  if (typeof token !== "string" || token.toLowerCase() !== BLINK_USDC_BASE.toLowerCase()) {
    return "unsupported token";
  }
  return null;
}

export function buildBlinkPayload(
  amount: number,
  address: string,
  chainId: number,
  token: string,
  callbackScheme: string | null,
  version: string
): BlinkSignerPayload {
  return {
    amount,
    chainId,
    address,
    token,
    idempotencyKey: crypto.randomUUID(),
    callbackScheme,
    signatureTimestamp: new Date().toISOString(),
    version,
  };
}

export function encodeAndSign(
  payload: BlinkSignerPayload,
  privateKeyPem: string
): { encodedPayload: string; signature: string } {
  // Dynamic import so this module can be imported in test environments without crypto
  const { createSign } = require("node:crypto");
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signer = createSign("SHA256");
  signer.update(encoded);
  signer.end();
  const signature = signer.sign(privateKeyPem).toString("base64url");
  return { encodedPayload: encoded, signature };
}

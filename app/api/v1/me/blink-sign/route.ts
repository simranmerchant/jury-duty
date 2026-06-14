import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import {
  validateBlinkRequest,
  buildBlinkPayload,
  encodeAndSign,
  BLINK_CHAIN_ID,
  BLINK_USDC_BASE,
} from "@/lib/blink";

const MERCHANT_ID = process.env.BLINK_MERCHANT_ID!;
const PRIVATE_KEY_PEM = process.env.BLINK_PRIVATE_KEY_PEM!;
const DESTINATION = process.env.BLINK_DESTINATION_ADDRESS!;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!MERCHANT_ID || !PRIVATE_KEY_PEM || !DESTINATION) {
    return NextResponse.json({ error: "Blink not configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  // callbackScheme and version are echoed from the SignerRequest per the Blink spec.
  const { amount, callbackScheme = null, version = "v1" } = body;

  // Always sign for the treasury address — users deposit into the shared treasury
  const validationError = validateBlinkRequest({
    amount,
    chainId: BLINK_CHAIN_ID,
    address: DESTINATION,
    token: BLINK_USDC_BASE,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const payload = buildBlinkPayload(amount, DESTINATION, BLINK_CHAIN_ID, BLINK_USDC_BASE, callbackScheme, version);
  const { encodedPayload, signature } = encodeAndSign(payload, PRIVATE_KEY_PEM);

  return NextResponse.json(
    {
      merchantId: MERCHANT_ID,
      payload: encodedPayload,
      signature,
      preview: {
        amount: payload.amount,
        chainId: payload.chainId,
        address: payload.address,
        token: payload.token,
        idempotencyKey: payload.idempotencyKey,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

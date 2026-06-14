import { createWalletClient, http, erc20Abi } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { centsToMicroUSDC } from "./usdc";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

function getWalletClient() {
  const pk = process.env.TREASURY_PRIVATE_KEY;
  if (!pk) throw new Error("TREASURY_PRIVATE_KEY not configured");
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL ?? "https://mainnet.base.org"),
  });
}

export async function sendUSDC(
  to: `0x${string}`,
  centsUSD: number
): Promise<`0x${string}`> {
  const microUSDC = centsToMicroUSDC(centsUSD);
  const client = getWalletClient();
  return client.writeContract({
    address: USDC_BASE,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, microUSDC],
  });
}

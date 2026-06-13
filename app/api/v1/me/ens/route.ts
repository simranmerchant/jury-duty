import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/privy";
import { supabase } from "@/lib/supabase";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({ chain: mainnet, transport: http("https://cloudflare-eth.com") });

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await requireUser(token).catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ens_name } = await req.json();

  if (!ens_name) {
    // Clear ENS
    await supabase.from("balances").update({ ens_name: null }).eq("user_id", user.userId);
    return NextResponse.json({ ok: true, ens_name: null });
  }

  const name = ens_name.trim().toLowerCase();
  if (!name.endsWith(".eth")) return NextResponse.json({ error: "must end with .eth" }, { status: 400 });

  // Verify the name resolves to something
  const address = await client.getEnsAddress({ name }).catch(() => null);
  if (!address) return NextResponse.json({ error: "ENS name not found or not resolved" }, { status: 400 });

  // Fetch avatar from ENS metadata service
  const metaRes = await fetch(`https://metadata.ens.domains/mainnet/avatar/${name}`).catch(() => null);
  const avatarUrl = metaRes?.ok ? `https://metadata.ens.domains/mainnet/avatar/${name}` : null;

  const { error } = await supabase
    .from("balances")
    .update({
      ens_name: name,
      display_name: ens_name.trim(),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("user_id", user.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ens_name: name, address, avatar_url: avatarUrl });
}

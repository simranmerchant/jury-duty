import { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import BetJoinClient from "./BetJoinClient";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { token } = await searchParams;

  const { data: bet } = await supabase
    .from("bets")
    .select("question, bet_options(label), balances!bets_creator_id_fkey(display_name)")
    .is("event_id", null)
    .eq("id", id)
    .single();

  if (!bet) {
    return { title: "jury duty — bet not found" };
  }

  const creator = (bet.balances as any)?.display_name ?? "someone";
  const options = (bet.bet_options as { label: string }[]).map((o) => o.label).join(" vs ");
  const title = `${creator} wants your take`;
  const description = `"${bet.question}" — ${options}`;

  return {
    title: `jury duty — ${title}`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "jury duty",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function BetPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;

  const { data: bet } = await supabase
    .from("bets")
    .select(`
      id, question, deadline, status, invite_token,
      bet_options(id, label),
      bet_entries(user_id),
      balances!bets_creator_id_fkey(display_name)
    `)
    .is("event_id", null)
    .eq("id", id)
    .single();

  const inviteToken = token ?? bet?.invite_token ?? null;

  const normalizedBet = bet ? {
    ...bet,
    balances: Array.isArray(bet.balances) ? (bet.balances[0] ?? null) : bet.balances,
  } : null;

  return <BetJoinClient bet={normalizedBet} betId={id} inviteToken={inviteToken} />;
}

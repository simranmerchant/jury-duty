"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

const APP_STORE_ID = "6770705837";
const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

type BetOption = { id: string; label: string };
type BetData = {
  id: string;
  question: string;
  deadline: string;
  status: string;
  invite_token: string | null;
  bet_options: BetOption[];
  bet_entries: { user_id: string }[];
  balances: { display_name: string | null } | null;
} | null;

function BetJoinInner({ bet, betId, inviteToken }: { bet: BetData; betId: string; inviteToken: string | null }) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!ready || !authenticated || !bet || !inviteToken || joining || joined) return;
    joinBet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, bet]);

  async function joinBet() {
    if (!inviteToken) return;
    setJoining(true);
    setError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bet_invite_token: inviteToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "something went wrong");
      setJoining(false);
      return;
    }
    setJoined(true);
    setJoining(false);
    // Redirect to events (the bet will appear in the bets tab)
    router.replace("/events");
  }

  function handleGetStarted() {
    const redirect = `/bet/${betId}${inviteToken ? `?token=${inviteToken}` : ""}`;
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  }

  if (!bet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
        <p className="text-[17px] font-bold" style={{ color: "var(--muted)" }}>
          bet not found
        </p>
        <button onClick={() => router.push("/events")} className="text-sm" style={{ color: "var(--accent)" }}>
          go home
        </button>
      </div>
    );
  }

  const creator = (bet.balances as any)?.display_name ?? "someone";
  const entrantCount = bet.bet_entries?.length ?? 0;
  const isClosed = bet.status === "resolved" || new Date(bet.deadline) < new Date();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        {/* Wordmark */}
        <p className="text-[15px] font-black" style={{ fontFamily: "var(--font-nunito)", color: "var(--dimmer)" }}>
          jury<span style={{ color: "var(--accent)" }}>duty</span>
        </p>

        {/* Bet card */}
        <div
          className="w-full rounded-3xl p-6 flex flex-col gap-4"
          style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
              {creator}'s bet
            </p>
            <p className="text-[20px] font-black leading-tight text-left" style={{ fontFamily: "var(--font-nunito)" }}>
              {bet.question}
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2">
            {(bet.bet_options ?? []).map((opt) => (
              <div
                key={opt.id}
                className="w-full px-4 py-3 rounded-2xl text-left text-[14px] font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--text)" }}
              >
                {opt.label}
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--muted)" }}>
            <span>
              {entrantCount} {entrantCount === 1 ? "player" : "players"}
            </span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span style={{ color: isClosed ? "var(--muted)" : "var(--accent)" }}>
              {isClosed
                ? bet.status === "resolved" ? "resolved" : "closed"
                : `closes ${new Date(bet.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </span>
          </div>
        </div>

        {/* CTA */}
        {error && (
          <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>
            {error}
          </p>
        )}

        {!ready ? (
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
        ) : !authenticated ? (
          <>
            <button
              onClick={handleGetStarted}
              className="w-full py-4 rounded-2xl font-black text-[16px] text-white"
              style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              place your bet
            </button>
            <p className="text-[12px]" style={{ color: "var(--dimmer)" }}>
              we'll text you a one-time code — no password needed
            </p>
          </>
        ) : joining ? (
          <div className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
            <span className="text-[14px]">joining...</span>
          </div>
        ) : joined ? (
          <p className="text-[14px] font-semibold" style={{ color: "var(--accent)" }}>
            you're in — opening app...
          </p>
        ) : (
          <button
            onClick={joinBet}
            className="w-full py-4 rounded-2xl font-black text-[16px] text-white"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
          >
            place your bet
          </button>
        )}

        {isIOS && !authenticated && (
          <a
            href={APP_STORE_URL}
            className="w-full py-4 rounded-2xl font-black text-[16px] text-center block"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)", color: "var(--text)", fontFamily: "var(--font-nunito)" }}
          >
            get the app
          </a>
        )}
      </div>
    </div>
  );
}

export default function BetJoinClient(props: { bet: BetData; betId: string; inviteToken: string | null }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} /></div>}>
      <BetJoinInner {...props} />
    </Suspense>
  );
}

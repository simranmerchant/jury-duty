"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";

const APP_STORE_ID = "6770705837";
const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
const POINT_OPTIONS = [25, 50, 100, 250, 500];

type BetOption = { id: string; label: string };
type BetEntry = { id: string; user_id: string; option_id: string; points_staked: number; is_anonymous: boolean; balances?: { display_name: string | null } | null };
type FullBet = {
  id: string;
  question: string;
  deadline: string;
  status: "open" | "resolved";
  winning_option_id: string | null;
  creator_id: string;
  invite_token: string | null;
  bet_options: BetOption[];
  bet_entries: BetEntry[];
  balances: { display_name: string | null } | null;
};

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

function BetJoinInner({ bet: initialBet, betId, inviteToken }: { bet: BetData; betId: string; inviteToken: string | null }) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const router = useRouter();

  // Join flow state
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  // Detail view state (authenticated members)
  const [fullBet, setFullBet] = useState<FullBet | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [points, setPoints] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);

  const fetchDetail = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    setLoadingDetail(true);
    const res = await fetch(`/api/v1/bets/${betId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setFullBet(data.bet);
      setUserId(data.userId);
    }
    setLoadingDetail(false);
  }, [betId, getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    fetchDetail();
  }, [ready, authenticated, fetchDetail]);

  // Auto-join if authenticated and we have an invite token but no access yet
  useEffect(() => {
    if (!ready || !authenticated || !inviteToken || joining || joined || fullBet || loadingDetail) return;
    // Only auto-join once we know detail fetch failed (loadingDetail is done and fullBet is null)
    if (!loadingDetail && !fullBet) {
      joinBet();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, loadingDetail, fullBet]);

  async function joinBet() {
    if (!inviteToken) return;
    setJoining(true);
    setJoinError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bet_invite_token: inviteToken }),
    });
    const data = await res.json();
    if (!res.ok) { setJoinError(data.error ?? "something went wrong"); setJoining(false); return; }
    setJoined(true);
    setJoining(false);
    fetchDetail();
  }

  async function placeBet() {
    if (!selectedOption || placing) return;
    setPlacing(true);
    setPlaceError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/bets/place", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bet_id: betId, option_id: selectedOption, points }),
    });
    const data = await res.json();
    setPlacing(false);
    if (!res.ok) { setPlaceError(data.error ?? "something went wrong"); return; }
    setSelectedOption(null);
    fetchDetail();
  }

  async function resolveBet(winningOptionId: string | null) {
    const key = winningOptionId ?? "void";
    setResolving(key);
    const token = await getAccessToken();
    await fetch(`/api/v1/bets/${betId}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ winning_option_id: winningOptionId }),
    });
    setResolving(null);
    fetchDetail();
  }

  function handleGetStarted() {
    const redirect = `/bet/${betId}${inviteToken ? `?token=${inviteToken}` : ""}`;
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  }

  // Full detail view for authenticated members
  if (authenticated && fullBet) {
    const isCreator = userId === fullBet.creator_id;
    const myEntry = fullBet.bet_entries.find((e) => e.user_id === userId);
    const isOpen = fullBet.status === "open" && new Date(fullBet.deadline) > new Date();
    const isClosed = fullBet.status === "open" && new Date(fullBet.deadline) <= new Date();
    const isResolved = fullBet.status === "resolved";
    const totalPot = fullBet.bet_entries.reduce((s, e) => s + e.points_staked, 0);
    const creatorName = (fullBet.balances as any)?.display_name ?? "someone";

    function optionTotal(optId: string) {
      return fullBet!.bet_entries.filter((e) => e.option_id === optId).reduce((s, e) => s + e.points_staked, 0);
    }

    return (
      <div className="min-h-screen pb-20" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-14 pb-4">
          <button
            onClick={() => router.push("/events?tab=bets")}
            className="flex-shrink-0 flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, background: "rgba(255,255,255,0.06)" }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.5} strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h1 className="flex-1 font-black text-[16px] truncate" style={{ fontFamily: "var(--font-nunito)" }}>{fullBet.question}</h1>
          {fullBet.invite_token && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/bet/${betId}?token=${fullBet.invite_token}`;
                if (navigator.share) navigator.share({ title: fullBet.question, url }).catch(() => {});
                else navigator.clipboard.writeText(url).catch(() => {});
              }}
              className="flex-shrink-0 flex items-center justify-center rounded-full"
              style={{ width: 36, height: 36, background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <path d="M16 6l-4-4-4 4"/>
                <path d="M12 2v13"/>
              </svg>
            </button>
          )}
        </div>

        <div className="px-4 flex flex-col gap-4">
          {/* Meta */}
          <div className="flex items-center gap-1.5 flex-wrap text-[12px]" style={{ color: "var(--muted)" }}>
            <span>by {creatorName}</span>
            <span style={{ color: "var(--dimmer)" }}>·</span>
            <span style={{ color: isResolved ? "#34c759" : "var(--muted)" }}>
              {isResolved ? "resolved" : isClosed ? "closed" : `closes ${new Date(fullBet.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </span>
            <span style={{ color: "var(--dimmer)" }}>·</span>
            <span>{totalPot} pts in pot</span>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2">
            {fullBet.bet_options.map((opt) => {
              const optPts = optionTotal(opt.id);
              const pct = totalPot > 0 ? optPts / totalPot : 0;
              const isWinner = isResolved && fullBet.winning_option_id === opt.id;
              const myPick = myEntry?.option_id === opt.id;
              const isSelectable = isOpen && !myEntry;

              return (
                <button
                  key={opt.id}
                  onClick={() => isSelectable && setSelectedOption(opt.id === selectedOption ? null : opt.id)}
                  className="relative overflow-hidden rounded-2xl text-left"
                  style={{
                    padding: "12px 14px",
                    border: `1px solid ${isWinner ? "rgba(52,199,89,0.4)" : selectedOption === opt.id ? "var(--accent)" : myPick ? "var(--accent-border)" : "var(--border-soft)"}`,
                    background: selectedOption === opt.id ? "var(--accent-dim)" : "var(--card)",
                    cursor: isSelectable ? "pointer" : "default",
                    opacity: !isSelectable && isOpen ? 0.85 : 1,
                  }}
                >
                  {/* Progress fill */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-2xl"
                    style={{ width: `${Math.round(pct * 100)}%`, background: isWinner ? "rgba(52,199,89,0.1)" : "rgba(255,143,163,0.08)", transition: "width 0.3s" }}
                  />
                  <div className="relative flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-[15px]" style={{ color: isWinner ? "#34c759" : "var(--text)" }}>{opt.label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{optPts} pts · {Math.round(pct * 100)}%</p>
                    </div>
                    {isWinner && (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                    )}
                    {myPick && !isWinner && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>you</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Place bet */}
          {isOpen && !myEntry && selectedOption && (
            <div className="flex flex-col gap-3">
              <p className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>stake</p>
              <div className="flex gap-2">
                {POINT_OPTIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPoints(p)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-[13px]"
                    style={{
                      background: points === p ? "var(--accent-dim)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${points === p ? "var(--accent-border)" : "var(--border-soft)"}`,
                      color: points === p ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {placeError && <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{placeError}</p>}
              <button
                onClick={placeBet}
                disabled={placing}
                className="w-full py-3.5 rounded-2xl font-black text-[15px] text-white disabled:opacity-60"
                style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
              >
                {placing ? "committing..." : `commit ${points} pts`}
              </button>
            </div>
          )}

          {/* Creator resolve */}
          {isCreator && !isResolved && (isClosed || isOpen) && (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>{isClosed ? "time to resolve" : "resolve early"}</p>
              {fullBet.bet_options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => resolveBet(opt.id)}
                  disabled={resolving !== null}
                  className="w-full py-3 rounded-xl font-bold text-[14px] disabled:opacity-50"
                  style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}
                >
                  {resolving === opt.id ? "resolving..." : `${opt.label} wins`}
                </button>
              ))}
              <button
                onClick={() => resolveBet(null)}
                disabled={resolving !== null}
                className="w-full py-3 rounded-xl font-bold text-[14px] disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--muted)" }}
              >
                {resolving === "void" ? "voiding..." : "call it off (refund all)"}
              </button>
            </div>
          )}

          {/* Players */}
          {fullBet.bet_entries.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>players</p>
              {fullBet.bet_entries.map((entry) => {
                const optLabel = fullBet.bet_options.find((o) => o.id === entry.option_id)?.label ?? "?";
                const name = entry.is_anonymous ? "anonymous" : (entry.balances?.display_name ?? "?");
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                    style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
                  >
                    <span className="flex-1 font-semibold text-[14px]">{name}</span>
                    <span className="text-[13px]" style={{ color: "var(--muted)" }}>{optLabel}</span>
                    <span className="font-bold text-[13px]">{entry.points_staked} pts</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state for authenticated users
  if (authenticated && loadingDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
      </div>
    );
  }

  // Join flow (unauthenticated or not yet a member)
  if (!initialBet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
        <p className="text-[17px] font-bold" style={{ color: "var(--muted)" }}>bet not found</p>
        <button onClick={() => router.push("/events")} className="text-sm" style={{ color: "var(--accent)" }}>go home</button>
      </div>
    );
  }

  const creator = initialBet.balances?.display_name ?? "someone";
  const entrantCount = initialBet.bet_entries?.length ?? 0;
  const isClosed = initialBet.status === "resolved" || new Date(initialBet.deadline) < new Date();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <p className="text-[15px] font-black" style={{ fontFamily: "var(--font-nunito)", color: "var(--dimmer)" }}>
          jury<span style={{ color: "var(--accent)" }}>duty</span>
        </p>

        <div className="w-full rounded-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
          <div className="flex flex-col gap-1">
            <p className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>{creator}'s bet</p>
            <p className="text-[20px] font-black leading-tight text-left" style={{ fontFamily: "var(--font-nunito)" }}>{initialBet.question}</p>
          </div>
          <div className="flex flex-col gap-2">
            {initialBet.bet_options.map((opt) => (
              <div key={opt.id} className="w-full px-4 py-3 rounded-2xl text-left text-[14px] font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--text)" }}>
                {opt.label}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--muted)" }}>
            <span>{entrantCount} {entrantCount === 1 ? "player" : "players"}</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span style={{ color: isClosed ? "var(--muted)" : "var(--accent)" }}>
              {isClosed ? (initialBet.status === "resolved" ? "resolved" : "closed") : `closes ${new Date(initialBet.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </span>
          </div>
        </div>

        {joinError && <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{joinError}</p>}

        {!ready ? (
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
        ) : !authenticated ? (
          <>
            <button onClick={handleGetStarted} className="w-full py-4 rounded-2xl font-black text-[16px] text-white" style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
              call it
            </button>
            <p className="text-[12px]" style={{ color: "var(--dimmer)" }}>we'll text a one-time code — no password needed</p>
          </>
        ) : joining ? (
          <div className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
            <span className="text-[14px]">joining...</span>
          </div>
        ) : (
          <button onClick={joinBet} className="w-full py-4 rounded-2xl font-black text-[16px] text-white" style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
            call it
          </button>
        )}

        {isIOS && !authenticated && (
          <a href={APP_STORE_URL} className="w-full py-4 rounded-2xl font-black text-[16px] text-center block"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)", color: "var(--text)", fontFamily: "var(--font-nunito)" }}>
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

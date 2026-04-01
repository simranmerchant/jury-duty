"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

type BetOption = { id: string; label: string };
type BetEntry = { id: string; user_id: string; option_id: string; points_staked: number };
type Bet = {
  id: string;
  question: string;
  deadline: string;
  visibility: "public" | "private";
  status: "open" | "resolved";
  winning_option_id: string | null;
  creator_id: string;
  created_at: string;
  bet_options: BetOption[];
  bet_entries: BetEntry[];
};
type Event = {
  id: string;
  name: string;
  ends_at: string;
  host_id: string;
  invite_token: string;
  event_guests: { user_id: string }[];
  bets: Bet[];
};

export default function EventPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/v1/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) { router.replace("/events"); return; }
      const data = await res.json();
      if (!res.ok) { setFetchError(data.error ?? `error ${res.status}`); setLoading(false); return; }
      setEvent(data.event);
      setUserId(data.userId);
      setLoading(false);
    } catch (e) {
      setFetchError(String(e));
      setLoading(false);
    }
  }, [eventId, getAccessToken, router]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    fetchEvent();
  }, [ready, authenticated, router, fetchEvent]);

  function copyInvite() {
    navigator.clipboard.writeText(`${window.location.origin}/join/${event!.invite_token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!ready || loading) return null;
  if (fetchError) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>something went wrong</p>
      <p className="text-[12px] text-center" style={{ color: "var(--muted)" }}>{fetchError}</p>
      <button onClick={() => router.push("/events")} className="text-[13px] font-bold mt-2" style={{ color: "var(--accent)" }}>← back to events</button>
    </div>
  );
  if (!event) return null;

  const isHost = userId === event.host_id;
  const isClosed = new Date(event.ends_at) < new Date();
  const guestCount = event.event_guests?.length ?? 0;
  const openBets = event.bets?.filter((b) => b.status === "open") ?? [];
  const resolvedBets = event.bets?.filter((b) => b.status === "resolved") ?? [];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <button
          onClick={() => router.push("/events")}
          className="text-sm mb-4 flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          ← events
        </button>
        <h1
          className="text-[28px] font-black tracking-tight leading-tight"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          {event.name}
        </h1>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>
            {guestCount} {guestCount === 1 ? "guest" : "guests"}
          </span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span
            className="text-[13px]"
            style={{ color: isClosed ? "var(--muted)" : "var(--accent)" }}
          >
            {isClosed
              ? "closed"
              : `closes ${new Date(event.ends_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
          </span>
          {isHost && (
            <>
              <span style={{ color: "var(--border)" }}>·</span>
              <span className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>host</span>
            </>
          )}
        </div>

        <button
          onClick={copyInvite}
          className="mt-3 text-[12px] font-bold px-3 py-1.5 rounded-full"
          style={{
            background: "var(--accent-dim)",
            color: copied ? "var(--win)" : "var(--accent)",
            border: `1px solid ${copied ? "rgba(48,209,88,0.3)" : "var(--accent-border)"}`,
            transition: "color 0.2s, border-color 0.2s",
          }}
        >
          {copied ? "copied!" : "copy invite link"}
        </button>
      </div>

      {/* Bets list */}
      <div className="px-3 pb-32 flex flex-col gap-3">
        {openBets.length === 0 && resolvedBets.length === 0 && (
          <div className="text-center py-16 text-[15px]" style={{ color: "var(--dimmer)" }}>
            no bets yet — be first
          </div>
        )}

        {openBets.length > 0 && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider px-2 pt-2" style={{ color: "var(--dimmer)" }}>
              open
            </p>
            {openBets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                userId={userId!}
                isHost={isHost}
                onUpdate={fetchEvent}
              />
            ))}
          </>
        )}

        {resolvedBets.length > 0 && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider px-2 pt-4" style={{ color: "var(--dimmer)" }}>
              resolved
            </p>
            {resolvedBets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                userId={userId!}
                isHost={isHost}
                onUpdate={fetchEvent}
              />
            ))}
          </>
        )}
      </div>

      {!isClosed && (
        <button
          onClick={() => router.push(`/e/${eventId}/new-bet`)}
          className="fixed bottom-8 right-5 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg"
          style={{ background: "var(--accent)" }}
        >
          +
        </button>
      )}
    </div>
  );
}

function BetCard({
  bet,
  userId,
  isHost,
  onUpdate,
}: {
  bet: Bet;
  userId: string;
  isHost: boolean;
  onUpdate: () => void;
}) {
  const { getAccessToken } = usePrivy();

  // Bet placement state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [stakeInput, setStakeInput] = useState("100");
  const [placing, setPlacing] = useState(false);

  // Resolve state
  const [resolving, setResolving] = useState(false);
  const [resolveOption, setResolveOption] = useState<string | null | "refund">(null);
  const [submittingResolve, setSubmittingResolve] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const myEntry = bet.bet_entries.find((e) => e.user_id === userId);
  const totalPot = bet.bet_entries.reduce((s, e) => s + e.points_staked, 0);
  const isOpen = bet.status === "open";
  const isPast = new Date(bet.deadline) < new Date();
  const canBet = isOpen && !isPast && !myEntry && !resolving;
  const canResolve = isOpen && (isHost || bet.creator_id === userId);

  async function placeBet() {
    if (!selectedOption || placing) return;
    const stake = parseInt(stakeInput, 10);
    if (!stake || stake <= 0) return;
    setPlacing(true);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/bets/place", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bet_id: bet.id, option_id: selectedOption, points: stake }),
    });
    setPlacing(false);
    setSelectedOption(null);
    if (res.ok) onUpdate();
  }

  async function submitResolve() {
    if (resolveOption === null || submittingResolve) return;
    setSubmittingResolve(true);
    setResolveError(null);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/bets/${bet.id}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        winning_option_id: resolveOption === "refund" ? null : resolveOption,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResolveError(data.error ?? "something went wrong");
      setSubmittingResolve(false);
      return;
    }
    setResolving(false);
    onUpdate();
  }

  // Payout preview for resolve mode
  const winnerCount = resolveOption && resolveOption !== "refund"
    ? bet.bet_entries.filter((e) => e.option_id === resolveOption).length
    : 0;
  const payoutEach = winnerCount > 0 ? Math.floor(totalPot / winnerCount) : 0;

  return (
    <div
      className="rounded-3xl p-5"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border-soft)",
        opacity: bet.status === "resolved" ? 0.75 : 1,
      }}
    >
      {/* Question + private badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="font-extrabold text-[16px] leading-snug flex-1" style={{ fontFamily: "var(--font-nunito)" }}>
          {bet.question}
        </p>
        {bet.visibility === "private" && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
            style={{ background: "var(--purple-dim)", color: "var(--purple)", border: "1px solid var(--purple-border)" }}
          >
            private
          </span>
        )}
      </div>

      {/* Pot summary */}
      {totalPot > 0 && (
        <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
          {totalPot.toLocaleString()} pts in the pot · {bet.bet_entries.length}{" "}
          {bet.bet_entries.length === 1 ? "entry" : "entries"}
        </p>
      )}

      {/* Options */}
      <div className="flex flex-col gap-2">
        {bet.bet_options.map((opt) => {
          const optTotal = bet.bet_entries
            .filter((e) => e.option_id === opt.id)
            .reduce((s, e) => s + e.points_staked, 0);
          const isWinner = bet.winning_option_id === opt.id;
          const myPick = myEntry?.option_id === opt.id;
          const pct = totalPot > 0 ? Math.round((optTotal / totalPot) * 100) : 0;
          const isSelectedForResolve = resolveOption === opt.id;

          return (
            <button
              key={opt.id}
              disabled={!canBet && !resolving}
              onClick={() => {
                if (resolving) {
                  setResolveOption(isSelectedForResolve ? null : opt.id);
                } else if (canBet) {
                  setSelectedOption(selectedOption === opt.id ? null : opt.id);
                }
              }}
              className="w-full text-left rounded-2xl px-4 py-3 relative overflow-hidden"
              style={{
                background: isWinner
                  ? "rgba(48,209,88,0.12)"
                  : isSelectedForResolve
                  ? "rgba(48,209,88,0.1)"
                  : selectedOption === opt.id
                  ? "var(--accent-dim)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  isWinner
                    ? "rgba(48,209,88,0.3)"
                    : isSelectedForResolve
                    ? "rgba(48,209,88,0.4)"
                    : selectedOption === opt.id
                    ? "var(--accent-border)"
                    : myPick
                    ? "var(--accent-border)"
                    : "transparent"
                }`,
              }}
            >
              {totalPot > 0 && (
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    width: `${pct}%`,
                    background: isWinner ? "rgba(48,209,88,0.08)" : "rgba(255,255,255,0.03)",
                  }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span className="text-[14px] font-bold">
                  {opt.label}
                  {myPick && !resolving && (
                    <span className="ml-2 text-[11px] font-bold" style={{ color: "var(--accent)" }}>you</span>
                  )}
                  {isWinner && (
                    <span className="ml-2 text-[11px] font-bold" style={{ color: "var(--win)" }}>won</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {resolving && isSelectedForResolve && (
                    <span className="text-[11px] font-bold" style={{ color: "var(--win)" }}>
                      {winnerCount > 0 ? `${payoutEach.toLocaleString()} ea` : "pick"}
                    </span>
                  )}
                  {totalPot > 0 && !resolving && (
                    <span className="text-[12px]" style={{ color: "var(--muted)" }}>{pct}%</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Stake input */}
      {canBet && selectedOption && (
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            min="1"
            value={stakeInput}
            onChange={(e) => setStakeInput(e.target.value)}
            className="flex-1 rounded-2xl px-4 py-2.5 text-[15px] outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--accent-border)",
              color: "var(--text)",
            }}
            placeholder="points"
          />
          <button
            onClick={placeBet}
            disabled={placing}
            className="px-5 py-2.5 rounded-2xl font-bold text-[14px] text-white disabled:opacity-40"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
          >
            {placing ? "..." : "bet"}
          </button>
        </div>
      )}

      {/* Already bet */}
      {myEntry && isOpen && !resolving && (
        <p className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>
          you staked {myEntry.points_staked.toLocaleString()} pts
        </p>
      )}

      {/* Resolve mode footer */}
      {resolving && (
        <div className="mt-4 flex flex-col gap-2">
          {/* No winner / refund option */}
          <button
            onClick={() => setResolveOption(resolveOption === "refund" ? null : "refund")}
            className="w-full py-2.5 rounded-2xl text-[13px] font-bold"
            style={{
              background: resolveOption === "refund" ? "rgba(255,255,255,0.08)" : "transparent",
              border: `1px solid ${resolveOption === "refund" ? "var(--border)" : "var(--border-soft)"}`,
              color: "var(--muted)",
            }}
          >
            {resolveOption === "refund" ? "✓ refund everyone" : "no winner — refund everyone"}
          </button>

          {resolveError && (
            <p className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>{resolveError}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setResolving(false); setResolveOption(null); setResolveError(null); }}
              className="flex-1 py-2.5 rounded-2xl font-bold text-[14px]"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}
            >
              cancel
            </button>
            <button
              onClick={submitResolve}
              disabled={resolveOption === null || submittingResolve}
              className="flex-1 py-2.5 rounded-2xl font-bold text-[14px] text-white disabled:opacity-35"
              style={{ background: "var(--win)", fontFamily: "var(--font-nunito)" }}
            >
              {submittingResolve ? "resolving..." : "confirm"}
            </button>
          </div>
        </div>
      )}

      {/* Resolve trigger */}
      {canResolve && !resolving && (
        <button
          onClick={() => setResolving(true)}
          className="mt-4 text-[12px] font-bold"
          style={{ color: "var(--dimmer)" }}
        >
          resolve bet →
        </button>
      )}
    </div>
  );
}

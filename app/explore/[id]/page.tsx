"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import BottomNav from "@/components/BottomNav";

type PublicPost = {
  id: string;
  caption: string | null;
  created_at: string;
  user: { user_id: string; display_name: string; username: string; avatar_url: string | null } | null;
  side: "a" | "b" | null;
};

type ExploreBet = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  status: "open" | "resolved";
  winning_side: "a" | "b" | null;
  closes_at: string | null;
  created_at: string;
  is_mine: boolean;
  total_pts_a: number;
  total_pts_b: number;
  total_entries: number;
  my_entry: { side: "a" | "b"; points_wagered: number } | null;
  my_post: { id: string; caption: string | null } | null;
  public_posts: PublicPost[];
};

function Avatar({ url, name, size = 30 }: { url?: string | null; name?: string; size?: number }) {
  if (url) {
    return <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: "var(--accent)",
    }}>
      {(name ?? "?")[0].toUpperCase()}
    </div>
  );
}

const QUICK_STAKES = [50, 100, 200];

export default function ExploreBetDetail() {
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [bet, setBet] = useState<ExploreBet | null>(null);
  const [loading, setLoading] = useState(true);

  // Betting
  const [selectedSide, setSelectedSide] = useState<"a" | "b" | null>(null);
  const [stake, setStake] = useState("100");
  const [placing, setPlacing] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);

  // Share sheet
  const [showShare, setShowShare] = useState(false);
  const [shareCaption, setShareCaption] = useState("");
  const [sharing, setSharing] = useState(false);

  // Resolve sheet
  const [showResolve, setShowResolve] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Delete sheet
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/v1/explore-bets/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setBet(data.bet);
    }
    setLoading(false);
  }, [id, getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    load();
  }, [ready, authenticated, router, load]);

  async function placeBet() {
    if (!selectedSide) return;
    const pts = parseInt(stake, 10);
    if (!pts || pts < 10) { setBetError("minimum 10 points"); return; }
    setPlacing(true);
    setBetError(null);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${id}/bet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ side: selectedSide, points: pts }),
    });
    const data = await res.json();
    setPlacing(false);
    if (!res.ok) { setBetError(data.error ?? "something went wrong"); return; }
    setSelectedSide(null);
    await load();
  }

  async function submitPost() {
    setSharing(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${id}/post`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ caption: shareCaption.trim() || null }),
    });
    setSharing(false);
    if (res.ok || res.status === 409) {
      setShowShare(false);
      setShareCaption("");
      await load();
    }
  }

  async function deletePost() {
    const token = await getAccessToken();
    await fetch(`/api/v1/explore-bets/${id}/post`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  async function deleteBet() {
    setDeleting(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setDeleting(false);
    if (res.ok) router.back();
  }

  async function resolve(winning_side: "a" | "b" | null) {
    setResolving(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${id}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ winning_side }),
    });
    setResolving(false);
    if (res.ok) {
      setShowResolve(false);
      await load();
    }
  }

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!bet) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)" }}>bet not found</p>
      </div>
    );
  }

  const total = bet.total_pts_a + bet.total_pts_b;
  const pctA = total > 0 ? Math.round((bet.total_pts_a / total) * 100) : null;
  const pctB = pctA !== null ? 100 - pctA : null;
  const hasBet = !!bet.my_entry;
  const isOpen = bet.status === "open";
  const isResolved = bet.status === "resolved";

  function barColor(side: "a" | "b") {
    if (isResolved) return bet!.winning_side === side ? "var(--win)" : "var(--loss)";
    return bet!.my_entry?.side === side ? "var(--accent)" : "var(--dimmer)";
  }

  function labelColor(side: "a" | "b") {
    if (isResolved) return bet!.winning_side === side ? "var(--win)" : "var(--muted)";
    return bet!.my_entry?.side === side || selectedSide === side ? "var(--accent)" : "var(--text)";
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg)" }}>
      {/* Nav */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[14px]" style={{ color: "var(--muted)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          back
        </button>
        <div className="flex items-center gap-2">
          {isOpen && bet.is_mine && (
            <button
              onClick={() => setShowResolve(true)}
              className="text-[13px] px-3 py-1 rounded-full"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              resolve
            </button>
          )}
          {bet.is_mine && (
            <button
              onClick={() => setShowDelete(true)}
              className="text-[13px] px-3 py-1 rounded-full"
              style={{ border: "1px solid var(--loss-border)", color: "var(--loss)" }}
            >
              delete
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-5">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              background: isOpen ? "var(--accent-dim)" : "rgba(255,255,255,0.05)",
              color: isOpen ? "var(--accent)" : "var(--muted)",
            }}
          >
            {bet.status}
          </span>
          {isResolved && bet.winning_side && (
            <span className="text-[13px] font-semibold" style={{ color: "var(--win)" }}>
              {bet.winning_side === "a" ? bet.option_a : bet.option_b} won
            </span>
          )}
        </div>

        {/* Question */}
        <h1 className="font-bold text-[21px] leading-snug" style={{ color: "var(--text)" }}>{bet.question}</h1>

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {(["a", "b"] as const).map((side) => {
            const label = side === "a" ? bet.option_a : bet.option_b;
            const pct = side === "a" ? pctA : pctB;
            const pts = side === "a" ? bet.total_pts_a : bet.total_pts_b;
            const myPick = bet.my_entry?.side === side;
            const isSelected = selectedSide === side;
            const canSelect = isOpen && !hasBet;

            return (
              <button
                key={side}
                onClick={() => canSelect && setSelectedSide(isSelected ? null : side)}
                disabled={!canSelect}
                className="relative flex items-center rounded-[12px] overflow-hidden w-full text-left"
                style={{
                  height: 46,
                  border: `1px solid ${isSelected || myPick ? (isResolved ? (bet.winning_side === side ? "var(--win-border)" : "var(--loss-border)") : "var(--accent-border)") : "var(--border)"}`,
                  cursor: canSelect ? "pointer" : "default",
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0,
                  width: `${pct ?? 50}%`,
                  background: barColor(side) + "28",
                  transition: "width 0.4s ease",
                }} />
                <span className="relative pl-3 flex-1 text-[14px] font-medium truncate" style={{ color: labelColor(side) }}>
                  {myPick && <span style={{ color: "var(--accent)" }}>✓ </span>}
                  {label}
                </span>
                <div className="relative pr-3 flex items-center gap-2">
                  <span className="text-[14px] font-semibold" style={{ color: labelColor(side) }}>{pct !== null ? `${pct}%` : "—"}</span>
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}>{pts} pts</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stake picker */}
        {isOpen && !hasBet && selectedSide && (
          <div className="rounded-[14px] p-4 flex flex-col gap-3"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>stake</p>
            <div className="flex items-center gap-2 flex-wrap">
              {QUICK_STAKES.map((q) => (
                <button
                  key={q}
                  onClick={() => setStake(String(q))}
                  className="px-4 py-1.5 rounded-full text-[14px] font-semibold transition-colors"
                  style={{
                    border: `1px solid ${stake === String(q) ? "var(--accent-border)" : "var(--border)"}`,
                    background: stake === String(q) ? "var(--accent-dim)" : "transparent",
                    color: stake === String(q) ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {q}
                </button>
              ))}
              <input
                className="flex-1 min-w-[80px] rounded-[10px] px-3 py-1.5 text-[14px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                value={stake}
                onChange={(e) => setStake(e.target.value.replace(/\D/, "").slice(0, 6))}
                placeholder="custom"
                type="text"
                inputMode="numeric"
              />
            </div>
            {betError && <p className="text-[13px]" style={{ color: "var(--loss)" }}>{betError}</p>}
            <button
              onClick={placeBet}
              disabled={placing}
              className="w-full py-3 rounded-[12px] font-bold text-[15px] text-white transition-opacity"
              style={{ background: "var(--accent)", opacity: placing ? 0.5 : 1 }}
            >
              {placing ? "placing…" : `bet ${stake || "0"} pts on ${selectedSide === "a" ? bet.option_a : bet.option_b}`}
            </button>
          </div>
        )}

        {/* My entry */}
        {hasBet && (
          <div className="rounded-[12px] p-3 flex items-center justify-between gap-3"
            style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
            <p className="text-[14px]" style={{ color: "var(--text)" }}>
              you bet <span className="font-semibold">{bet.my_entry!.points_wagered} pts</span> on{" "}
              <span style={{ color: "var(--accent)" }} className="font-semibold">
                {bet.my_entry!.side === "a" ? bet.option_a : bet.option_b}
              </span>
            </p>
            {bet.my_post ? (
              <button
                onClick={deletePost}
                className="text-[13px] px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
              >
                remove post
              </button>
            ) : (
              <button
                onClick={() => setShowShare(true)}
                className="text-[13px] font-semibold px-3 py-1.5 rounded-full flex-shrink-0 text-white"
                style={{ background: "var(--accent)" }}
              >
                share to explore
              </button>
            )}
          </div>
        )}

        {/* Stats */}
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {bet.total_entries} bet{bet.total_entries !== 1 ? "s" : ""} · {total} pts wagered
          {bet.closes_at && isOpen ? ` · closes ${new Date(bet.closes_at).toLocaleDateString()}` : ""}
        </p>

        {/* Public posts */}
        {bet.public_posts.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              what people are saying
            </p>
            {bet.public_posts.map((p) => (
              <div key={p.id} className="rounded-[12px] p-3 flex flex-col gap-2"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <Avatar url={p.user?.avatar_url} name={p.user?.display_name ?? "?"} size={26} />
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>{p.user?.display_name}</p>
                    <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                      @{p.user?.username}
                      {p.side ? ` · ${p.side === "a" ? bet.option_a : bet.option_b}` : ""}
                    </p>
                  </div>
                </div>
                {p.caption && <p className="text-[14px] leading-relaxed" style={{ color: "var(--text)" }}>{p.caption}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />

      {/* Share sheet */}
      {showShare && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowShare(false); setShareCaption(""); } }}
        >
          <div className="w-full max-w-lg rounded-t-[20px] p-6 flex flex-col gap-4"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-[18px]" style={{ fontFamily: "var(--font-nunito)", color: "var(--text)" }}>
                share to explore
              </h2>
              <button onClick={() => { setShowShare(false); setShareCaption(""); }} style={{ color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              you picked {bet.my_entry?.side === "a" ? bet.option_a : bet.option_b} — add a caption (optional)
            </p>
            <textarea
              className="w-full rounded-[12px] px-4 py-3 text-[14px] resize-none outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)", minHeight: 80 }}
              placeholder="what do you think?"
              value={shareCaption}
              onChange={(e) => setShareCaption(e.target.value.slice(0, 280))}
              maxLength={280}
              autoFocus
            />
            <div className="text-right text-[12px]" style={{ color: "var(--dimmer)" }}>{shareCaption.length}/280</div>
            <button
              onClick={submitPost}
              disabled={sharing}
              className="w-full py-3 rounded-[12px] font-bold text-[15px] text-white transition-opacity"
              style={{ background: "var(--accent)", opacity: sharing ? 0.5 : 1 }}
            >
              {sharing ? "sharing…" : "post"}
            </button>
          </div>
        </div>
      )}

      {/* Delete sheet */}
      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDelete(false); }}
        >
          <div className="w-full max-w-lg rounded-t-[20px] p-6 flex flex-col gap-4"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-[18px]" style={{ fontFamily: "var(--font-nunito)", color: "var(--text)" }}>
                delete bet?
              </h2>
              <button onClick={() => setShowDelete(false)} style={{ color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-[14px]" style={{ color: "var(--muted)" }}>
              this will refund all entries and remove the bet permanently.
            </p>
            <button
              onClick={deleteBet}
              disabled={deleting}
              className="w-full py-3 rounded-[12px] font-bold text-[15px] text-white transition-opacity"
              style={{ background: "var(--loss)", opacity: deleting ? 0.5 : 1 }}
            >
              {deleting ? "deleting…" : "delete bet"}
            </button>
          </div>
        </div>
      )}

      {/* Resolve sheet */}
      {showResolve && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowResolve(false); }}
        >
          <div className="w-full max-w-lg rounded-t-[20px] p-6 flex flex-col gap-3"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-black text-[18px]" style={{ fontFamily: "var(--font-nunito)", color: "var(--text)" }}>
                resolve bet
              </h2>
              <button onClick={() => setShowResolve(false)} style={{ color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-[14px]" style={{ color: "var(--muted)" }}>{bet.question}</p>

            {(["a", "b"] as const).map((side) => (
              <button
                key={side}
                onClick={() => resolve(side)}
                disabled={resolving}
                className="w-full py-3 rounded-[12px] font-semibold text-[15px] transition-opacity"
                style={{ border: "1px solid var(--win-border)", color: "var(--win)", opacity: resolving ? 0.5 : 1 }}
              >
                {side === "a" ? bet.option_a : bet.option_b} wins
              </button>
            ))}
            <button
              onClick={() => resolve(null)}
              disabled={resolving}
              className="w-full py-3 rounded-[12px] text-[15px] transition-opacity"
              style={{ border: "1px solid var(--border)", color: "var(--muted)", opacity: resolving ? 0.5 : 1 }}
            >
              void (refund all)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

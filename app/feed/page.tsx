"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useEffect, useState, useCallback, useRef } from "react";

type BetOption = { id: string; label: string };
type FeedBet = {
  id: string;
  question: string;
  deadline: string;
  status: "open" | "resolved";
  winning_option_id: string | null;
  creator_id: string;
  created_at: string;
  bet_options: BetOption[];
  bet_entries: { user_id: string; option_id: string; points_staked: number }[];
  balances: { display_name: string | null; avatar_url: string | null; username: string | null } | null;
};

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function FeedPage() {
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const router = useRouter();

  const [bets, setBets] = useState<FeedBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myPoints, setMyPoints] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seenBetIds, setSeenBetIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("seenFeedBetIds") ?? "[]")); } catch { return new Set(); }
  });

  // New bet sheet
  const [showPost, setShowPost] = useState(false);
  const [postQuestion, setPostQuestion] = useState("");
  const [postOptions, setPostOptions] = useState(["", ""]);
  const [postDeadline, setPostDeadline] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    const token = await getAccessToken();
    if (!token) return;
    const url = cursor ? `/api/v1/feed?cursor=${encodeURIComponent(cursor)}` : "/api/v1/feed";
    const requests = cursor
      ? [fetch(url, { headers: { Authorization: `Bearer ${token}` } })]
      : [
          fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/v1/me", { headers: { Authorization: `Bearer ${token}` } }),
        ];
    const [feedRes, meRes] = await Promise.all(requests);
    const feedData = await feedRes.json();
    if (!feedRes.ok) {
      setFeedError(feedData.error ?? "failed to load feed");
      return;
    }
    setFeedError(null);
    if (meRes) {
      const meData = await meRes.json();
      setMyPoints(meData.points ?? null);
      setAvatarUrl(meData.avatar_url ?? null);
    }
    const incoming: FeedBet[] = feedData.bets ?? [];
    setBets((prev) => cursor ? [...prev, ...incoming] : incoming);
    setNextCursor(feedData.nextCursor ?? null);
    // Mark all loaded bets as seen after this render
    setTimeout(() => {
      setSeenBetIds((prev) => {
        const next = new Set(prev);
        incoming.forEach((b) => next.add(b.id));
        try { sessionStorage.setItem("seenFeedBetIds", JSON.stringify([...next])); } catch {}
        return next;
      });
    }, 0);
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    load().finally(() => setLoading(false));
  }, [ready, authenticated, router, load]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && authenticated) {
        load().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [authenticated, load]);

  useEffect(() => {
    if (!menuOpenId) return;
    function onClickOutside() { setMenuOpenId(null); }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [menuOpenId]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await load(nextCursor);
    setLoadingMore(false);
  }

  async function vote(betId: string, optionId: string) {
    if (votingId) return;
    setVotingId(betId);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/bets/place", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bet_id: betId, option_id: optionId, points: 50 }),
    });
    if (res.ok) {
      setBets((prev) => prev.map((b) => b.id !== betId ? b : {
        ...b,
        bet_entries: [...b.bet_entries, { user_id: privyUser!.id, option_id: optionId, points_staked: 50 }],
      }));
      if (myPoints !== null) setMyPoints((p) => (p ?? 0) - 50);
    }
    setVotingId(null);
  }

  async function deleteBet(betId: string) {
    setDeletingId(betId);
    setMenuOpenId(null);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/bets/${encodeURIComponent(betId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setBets((prev) => prev.filter((b) => b.id !== betId));
    }
    setDeletingId(null);
  }

  async function postBet() {
    const filled = postOptions.filter((o) => o.trim());
    if (!postQuestion.trim() || filled.length < 2 || !postDeadline) return;
    setPosting(true);
    setPostError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/feed/bets", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        question: postQuestion.trim(),
        options: filled.map((o) => ({ label: o.trim() })),
        deadline: new Date(postDeadline).toISOString(),
      }),
    });
    setPosting(false);
    if (res.ok) {
      setShowPost(false);
      setPostQuestion(""); setPostOptions(["", ""]); setPostDeadline(""); setPostError(null);
      setLoading(true);
      try { await load(); } finally { setLoading(false); }
    } else {
      const data = await res.json();
      setPostError(data.error ?? "something went wrong");
    }
  }

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const canPost = postQuestion.trim() && postOptions.filter((o) => o.trim()).length >= 2 && postDeadline;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-3 flex items-center justify-between">
        <h1 className="font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)", fontSize: 27, letterSpacing: "-0.035em", lineHeight: 1 }}>
          <span style={{ color: "var(--text)" }}>jury</span>
          <span style={{ color: "var(--dimmer)", fontWeight: 800 }}>·</span>
          <span style={{ color: "var(--accent)", fontStyle: "italic" }}>duty</span>
        </h1>
        <div className="flex items-center gap-3">
          {myPoints !== null && (
            <span className="text-[12px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
              {myPoints.toLocaleString()} pts
            </span>
          )}
          <button
            onClick={() => setShowPost(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            post
          </button>
        </div>
      </div>

      <p className="text-[10px] font-semibold px-5 pb-3" style={{ color: "var(--dimmer)", letterSpacing: "0.14em", textTransform: "uppercase" }}>feed</p>

      {/* Feed list */}
      <div className="px-4 pb-36 flex flex-col gap-3">
        {feedError && (
          <div className="flex flex-col items-center justify-center pt-20 gap-2">
            <p className="font-bold text-[15px]" style={{ color: "var(--accent)" }}>couldn't load feed</p>
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>{feedError}</p>
          </div>
        )}

        {!feedError && bets.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p className="font-bold text-[15px]" style={{ color: "var(--text)" }}>nothing here yet</p>
            <p className="text-[13px] text-center px-8" style={{ color: "var(--muted)" }}>follow people to see their predictions, or post your own</p>
          </div>
        )}

        {bets.map((bet) => {
          const myEntry = bet.bet_entries.find((e) => e.user_id === privyUser?.id);
          const isOpen = bet.status === "open" && new Date(bet.deadline) > new Date();
          const totalStaked = bet.bet_entries.reduce((s, e) => s + e.points_staked, 0);
          const creator = bet.balances;
          const creatorName = creator?.display_name ?? creator?.username ?? "someone";
          const isVoting = votingId === bet.id;

          return (
            <div key={bet.id} className="rounded-[16px] p-4 flex flex-col gap-3"
              style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
              {/* Creator row */}
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-2.5"
                  onClick={() => creator?.username && router.push(`/u/${creator.username}`)}
                  style={{ opacity: creator?.username ? 1 : 0.7 }}
                >
                  <div className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ width: 32, height: 32, background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
                    {creator?.avatar_url
                      ? <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[12px] font-black" style={{ color: "var(--accent)", fontFamily: "var(--font-nunito)" }}>{creatorName[0]?.toUpperCase() ?? "?"}</span>
                    }
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-bold leading-none" style={{ color: "var(--text)" }}>{creatorName}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{timeAgo(bet.created_at)}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  {bet.status === "resolved" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-[6px]"
                      style={{ background: "var(--win-dim)", color: "var(--win)", border: "1px solid var(--win-border)" }}>
                      resolved
                    </span>
                  )}
                  {isOpen && !seenBetIds.has(bet.id) && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />}
                  {bet.creator_id === privyUser?.id && (
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === bet.id ? null : bet.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full"
                        style={{ color: "var(--muted)" }}
                      >
                        ···
                      </button>
                      {menuOpenId === bet.id && (
                        <div className="absolute right-0 top-8 z-10 rounded-[12px] overflow-hidden shadow-lg"
                          style={{ background: "var(--card)", border: "1px solid var(--border-soft)", minWidth: 130 }}>
                          <button
                            onClick={() => deleteBet(bet.id)}
                            disabled={deletingId === bet.id}
                            className="w-full px-4 py-3 text-left text-[13px] font-semibold"
                            style={{ color: "var(--accent)" }}
                          >
                            {deletingId === bet.id ? "deleting…" : "delete bet"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Question */}
              <p className="text-[15px] font-bold leading-snug" style={{ color: "var(--text)" }}>{bet.question}</p>

              {/* Options */}
              <div className="flex flex-col gap-2">
                {bet.bet_options.map((opt) => {
                  const optTotal = bet.bet_entries.filter((e) => e.option_id === opt.id).reduce((s, e) => s + e.points_staked, 0);
                  const pct = totalStaked > 0 ? Math.round((optTotal / totalStaked) * 100) : 0;
                  const isWinner = bet.winning_option_id === opt.id;
                  const isMine = myEntry?.option_id === opt.id;
                  const hasVoted = !!myEntry;

                  if (hasVoted || !isOpen) {
                    return (
                      <div key={opt.id} className="rounded-[10px] p-2.5 flex flex-col gap-1.5"
                        style={{
                          background: isWinner ? "var(--win-dim)" : isMine ? "var(--accent-dim)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${isWinner ? "var(--win-border)" : isMine ? "var(--accent-border)" : "rgba(255,255,255,0.06)"}`,
                        }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold" style={{ color: isMine || isWinner ? (isMine ? "var(--accent)" : "var(--win)") : "var(--text)" }}>{opt.label}</span>
                          <span className="text-[13px] font-bold" style={{ color: isMine ? "var(--accent)" : "var(--muted)" }}>{pct}%</span>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full" style={{
                            width: `${pct}%`,
                            background: isWinner ? "var(--win-border)" : isMine ? "var(--accent-border)" : "rgba(255,255,255,0.18)",
                          }} />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button key={opt.id}
                      onClick={() => vote(bet.id, opt.id)}
                      disabled={!!isVoting}
                      className="rounded-[10px] py-2.5 px-3 text-[14px] font-semibold text-center transition-opacity"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        color: "var(--text)",
                        opacity: isVoting ? 0.5 : 1,
                      }}>
                      {isVoting ? "…" : opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-[11px]" style={{ color: "var(--dimmer)" }}>
                  {bet.bet_entries.length} {bet.bet_entries.length === 1 ? "vote" : "votes"}
                  {totalStaked > 0 ? ` · ${totalStaked.toLocaleString()} pts` : ""}
                </span>
                <span className="text-[11px]" style={{ color: "var(--dimmer)" }}>
                  {isOpen ? "closes " : "closed "}
                  {new Date(bet.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            </div>
          );
        })}

        {nextCursor && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-[13px] font-semibold py-3 rounded-[12px] text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--muted)", opacity: loadingMore ? 0.5 : 1 }}>
            {loadingMore ? "loading…" : "load more"}
          </button>
        )}
      </div>

      <BottomNav />

      {/* Post sheet */}
      {showPost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowPost(false); setPostError(null); } }}>
          <div className="w-full max-w-lg rounded-t-[20px] p-6 flex flex-col gap-4"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-[18px]" style={{ fontFamily: "var(--font-nunito)", color: "var(--text)" }}>new prediction</h2>
              <button onClick={() => { setShowPost(false); setPostError(null); }} style={{ color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>question</label>
              <textarea
                className="w-full rounded-[12px] px-4 py-3 text-[14px] resize-none outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)", minHeight: 80 }}
                placeholder="will it happen?"
                value={postQuestion}
                onChange={(e) => setPostQuestion(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>options</label>
              {postOptions.map((opt, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    className="flex-1 rounded-[12px] px-4 py-3 text-[14px] outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                    placeholder={idx === 0 ? "yes" : idx === 1 ? "no" : `option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => setPostOptions((prev) => prev.map((o, i) => i === idx ? e.target.value : o))}
                  />
                  {postOptions.length > 2 && (
                    <button onClick={() => setPostOptions((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-[13px] px-2" style={{ color: "var(--muted)" }}>✕</button>
                  )}
                </div>
              ))}
              {postOptions.length < 5 && (
                <button onClick={() => setPostOptions((prev) => [...prev, ""])}
                  className="text-[13px] font-semibold py-2.5 rounded-[12px] text-center"
                  style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}>
                  + add option
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>closes at</label>
              <input
                type="datetime-local"
                className="w-full rounded-[12px] px-4 py-3 text-[14px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                value={postDeadline}
                onChange={(e) => setPostDeadline(e.target.value)}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              />
            </div>

            {postError && <p className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>{postError}</p>}

            <button
              onClick={postBet}
              disabled={!canPost || posting}
              className="w-full py-4 rounded-[14px] text-[15px] font-black"
              style={{ background: "var(--accent)", color: "#fff", opacity: (!canPost || posting) ? 0.4 : 1, fontFamily: "var(--font-nunito)" }}>
              {posting ? "posting…" : "post prediction"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

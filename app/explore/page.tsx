"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useEffect, useState, useRef, useCallback } from "react";

type PostComment = { id: string; body?: string | null; created_at: string; user_id: string; balances?: { display_name: string | null; avatar_url: string | null; username?: string | null } | null };

type ExploreBet = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  status: "open" | "resolved";
  winning_side: "a" | "b" | null;
  closes_at: string | null;
  created_at: string;
  creator_id: string;
  is_mine: boolean;
  creator: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  total_pts_a: number;
  total_pts_b: number;
  total_entries: number;
  like_count: number;
  liked_by_me: boolean;
  reactions: { emoji: string; count: number }[];
  my_reaction: string | null;
  comment_count: number;
  my_entry: { side: "a" | "b"; points_wagered: number } | null;
  followed_entries: { user_id: string; side: "a" | "b"; bettor: { display_name: string; username: string; avatar_url: string | null } | null }[];
  other_entry_count: number;
  my_post: { id: string; caption: string | null; photo_url: string | null } | null;
  public_posts: { id: string; caption: string | null; photo_url: string | null; created_at: string; user: { user_id: string; display_name: string; username: string; avatar_url: string | null } | null; side: string | null }[];
};

type Poll = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  creator_id: string;
  created_at: string;
  closes_at: string | null;
  creator: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  votes_a: number;
  votes_b: number;
  total_votes: number;
  my_vote: "a" | "b" | null;
  like_count: number;
  liked_by_me: boolean;
  reactions: { emoji: string; count: number }[];
  my_reaction: string | null;
  comment_count: number;
  is_mine: boolean;
  my_post: { caption: string | null; photo_url: string | null } | null;
  followed_votes: { user_id: string; side: "a" | "b"; voter: { display_name: string; username: string; avatar_url: string | null } | null }[];
  other_vote_count: number;
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

export default function ExplorePage() {
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const router = useRouter();

  const [tab, setTab] = useState<"bets" | "polls">("bets");
  const [bets, setBets] = useState<ExploreBet[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPoints, setMyPoints] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const [betsRes, pollsRes, meRes] = await Promise.all([
      fetch("/api/v1/explore-bets", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/v1/polls", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/v1/me", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (betsRes.ok) {
      const d = await betsRes.json();
      setBets(d.bets ?? []);
    }
    if (pollsRes.ok) {
      const d = await pollsRes.json();
      setPolls(d.polls ?? []);
    }
    if (meRes.ok) {
      const d = await meRes.json();
      setMyPoints(d.points ?? null);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    load().finally(() => setLoading(false));
  }, [ready, authenticated, router, load]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-3 flex items-center justify-between">
        <h1 className="font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)", fontSize: 27, letterSpacing: "-0.035em", lineHeight: 1 }}>
          <span style={{ color: "var(--text)" }}>jury</span>
          <span style={{ color: "var(--dimmer)", fontWeight: 800 }}>·</span>
          <span style={{ color: "var(--accent)", fontStyle: "italic" }}>duty</span>
        </h1>
        {myPoints !== null && (
          <span className="text-[12px] font-bold px-3 py-1.5 rounded-full"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
            {myPoints.toLocaleString()} pts
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="px-5 pb-3 flex items-center gap-2">
        <button
          onClick={() => setTab("bets")}
          className="px-4 py-1.5 rounded-full text-[12px] font-bold transition-all"
          style={{
            background: tab === "bets" ? "var(--accent)" : "rgba(255,255,255,0.06)",
            color: tab === "bets" ? "#fff" : "var(--muted)",
            border: tab === "bets" ? "none" : "1px solid rgba(255,255,255,0.06)",
          }}
        >
          predictions
        </button>
        <button
          onClick={() => setTab("polls")}
          className="px-4 py-1.5 rounded-full text-[12px] font-bold transition-all"
          style={{
            background: tab === "polls" ? "#a855f7" : "rgba(255,255,255,0.06)",
            color: tab === "polls" ? "#fff" : "var(--muted)",
            border: tab === "polls" ? "none" : "1px solid rgba(255,255,255,0.06)",
          }}
        >
          polls
        </button>
      </div>

      <div className="px-4 pb-36 flex flex-col gap-3">
        {tab === "bets" && bets.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 gap-3">
            <p className="font-bold text-[15px]" style={{ color: "var(--text)" }}>no predictions yet</p>
          </div>
        )}
        {tab === "polls" && polls.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 gap-3">
            <p className="font-bold text-[15px]" style={{ color: "var(--text)" }}>no polls yet</p>
          </div>
        )}

        {tab === "bets" && bets.map((bet) => (
          <ExploreBetCard
            key={bet.id}
            bet={bet}
            currentUserId={privyUser?.id}
            getAccessToken={getAccessToken}
            myPoints={myPoints}
            onPointsChange={(delta) => setMyPoints((p) => p !== null ? p + delta : null)}
            onBetUpdate={(updated) => setBets((prev) => prev.map((b) => b.id === updated.id ? { ...b, ...updated } : b))}
          />
        ))}

        {tab === "polls" && polls.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            currentUserId={privyUser?.id}
            getAccessToken={getAccessToken}
            onPollUpdate={(updated) => setPolls((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } : p))}
          />
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

const EMOJIS = ["🔥", "😂", "😮", "❤️", "👏"] as const;

function ExploreBetCard({
  bet: initialBet,
  currentUserId,
  getAccessToken,
  myPoints,
  onPointsChange,
  onBetUpdate,
}: {
  bet: ExploreBet;
  currentUserId?: string;
  getAccessToken: () => Promise<string | null>;
  myPoints: number | null;
  onPointsChange: (delta: number) => void;
  onBetUpdate: (updated: Partial<ExploreBet> & { id: string }) => void;
}) {
  const router = useRouter();
  const [bet, setBet] = useState(initialBet);
  const [betting, setBetting] = useState(false);
  const [betPoints, setBetPoints] = useState(50);
  const [showBetInput, setShowBetInput] = useState<"a" | "b" | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareCaption, setShareCaption] = useState("");
  const [sharing, setSharing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentCount, setCommentCount] = useState(bet.comment_count);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOpen = bet.status === "open" && (!bet.closes_at || new Date(bet.closes_at) > new Date());
  const myEntry = bet.my_entry;
  const hasVoted = !!myEntry;
  const totalPts = (bet.total_pts_a ?? 0) + (bet.total_pts_b ?? 0);
  const pctA = totalPts > 0 ? Math.round(((bet.total_pts_a ?? 0) / totalPts) * 100) : 50;
  const pctB = totalPts > 0 ? Math.round(((bet.total_pts_b ?? 0) / totalPts) * 100) : 50;
  const creator = bet.creator;
  const creatorName = creator?.display_name ?? creator?.username ?? "someone";

  const reactionMap: Record<string, number> = {};
  for (const r of bet.reactions) reactionMap[r.emoji] = r.count;

  async function placeBet(side: "a" | "b") {
    if (betting || hasVoted || !isOpen) return;
    setBetting(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${bet.id}/bet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ side, points: betPoints }),
    });
    if (res.ok) {
      const newEntry = { side, points_wagered: betPoints };
      const ptsA = side === "a" ? bet.total_pts_a + betPoints : bet.total_pts_a;
      const ptsB = side === "b" ? bet.total_pts_b + betPoints : bet.total_pts_b;
      setBet((b) => ({ ...b, my_entry: newEntry, total_pts_a: ptsA, total_pts_b: ptsB, total_entries: b.total_entries + 1 }));
      onPointsChange(-betPoints);
      onBetUpdate({ id: bet.id, my_entry: newEntry, total_pts_a: ptsA, total_pts_b: ptsB });
    }
    setShowBetInput(null);
    setBetting(false);
  }

  async function toggleReaction(emoji: string) {
    const token = await getAccessToken();
    const wasActive = bet.my_reaction === emoji;
    const newReaction = wasActive ? null : emoji;
    const newReactions = (() => {
      const map: Record<string, number> = {};
      for (const r of bet.reactions) map[r.emoji] = r.count;
      if (wasActive) { map[emoji] = Math.max(0, (map[emoji] ?? 1) - 1); }
      else {
        if (bet.my_reaction) map[bet.my_reaction] = Math.max(0, (map[bet.my_reaction] ?? 1) - 1);
        map[emoji] = (map[emoji] ?? 0) + 1;
      }
      return Object.entries(map).filter(([, c]) => c > 0).map(([e, c]) => ({ emoji: e, count: c }));
    })();
    setBet((b) => ({ ...b, my_reaction: newReaction, reactions: newReactions }));
    await fetch(`/api/v1/explore-bets/${bet.id}/react`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }

  async function shareToFeed() {
    setSharing(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${bet.id}/post`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ caption: shareCaption.trim() || null }),
    });
    if (res.ok) {
      setBet((b) => ({ ...b, my_post: { id: "", caption: shareCaption.trim() || null, photo_url: null } }));
      setShowShare(false);
      setShareCaption("");
    }
    setSharing(false);
  }

  async function unshare() {
    const token = await getAccessToken();
    await fetch(`/api/v1/explore-bets/${bet.id}/post`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setBet((b) => ({ ...b, my_post: null }));
  }

  async function fetchComments() {
    setCommentsLoading(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${bet.id}/comments`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setComments(data.comments ?? []);
    setCommentCount(data.comments?.length ?? commentCount);
    setCommentsLoading(false);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${bet.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentInput.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setComments((prev) => [...prev, data.comment]);
      setCommentCount((c) => c + 1);
      setCommentInput("");
    }
    setSubmitting(false);
  }

  return (
    <div className="rounded-[16px] p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
      {/* Creator row */}
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-2.5" onClick={() => creator?.username && router.push(`/u/${creator.username}`)}>
          <div className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ width: 32, height: 32, background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
            {creator?.avatar_url
              ? <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-[12px] font-black" style={{ color: "var(--accent)" }}>{creatorName[0]?.toUpperCase() ?? "?"}</span>
            }
          </div>
          <div className="text-left">
            <p className="text-[13px] font-bold leading-none" style={{ color: "var(--text)" }}>{creatorName}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{timeAgo(bet.created_at)}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {bet.status === "resolved" && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-[6px]" style={{ background: "var(--win-dim)", color: "var(--win)", border: "1px solid var(--win-border)" }}>resolved</span>
          )}
          {!isOpen && bet.status === "open" && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-[6px]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)", border: "1px solid rgba(255,255,255,0.08)" }}>closed</span>
          )}
        </div>
      </div>

      {/* Question */}
      <p className="text-[15px] font-bold leading-snug" style={{ color: "var(--text)" }}>{bet.question}</p>

      {/* A/B options */}
      <div className="flex flex-col gap-2">
        {(["a", "b"] as const).map((side) => {
          const label = side === "a" ? bet.option_a : bet.option_b;
          const pts = side === "a" ? bet.total_pts_a : bet.total_pts_b;
          const pct = side === "a" ? pctA : pctB;
          const isWinner = bet.status === "resolved" && bet.winning_side === side;
          const isLoss = bet.status === "resolved" && bet.winning_side !== null && bet.winning_side !== side;
          const isMine = myEntry?.side === side;

          if (!hasVoted && isOpen) {
            return (
              <div key={side}>
                {showBetInput === side ? (
                  <div className="rounded-[10px] p-3 flex flex-col gap-2" style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
                    <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{label}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={10}
                        max={myPoints ?? 9999}
                        value={betPoints}
                        onChange={(e) => setBetPoints(Math.max(10, parseInt(e.target.value) || 10))}
                        className="flex-1 text-[14px] px-3 py-2 rounded-xl outline-none"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                      />
                      <span className="text-[12px]" style={{ color: "var(--muted)" }}>pts</span>
                      <button onClick={() => placeBet(side)} disabled={betting || (myPoints !== null && betPoints > myPoints)}
                        className="px-4 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-40"
                        style={{ background: "var(--accent)" }}>
                        {betting ? "…" : "bet"}
                      </button>
                      <button onClick={() => setShowBetInput(null)} className="text-[13px]" style={{ color: "var(--muted)" }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowBetInput(side)}
                    className="w-full py-3 px-4 rounded-[10px] text-[14px] font-bold text-left"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)" }}>
                    {label}
                  </button>
                )}
              </div>
            );
          }

          return (
            <div key={side} className="rounded-[10px] p-2.5 flex flex-col gap-1.5"
              style={{ background: isWinner ? "var(--win-dim)" : isLoss ? "var(--loss-dim)" : isMine ? "var(--accent-dim)" : "rgba(255,255,255,0.03)", border: `1px solid ${isWinner ? "var(--win-border)" : isLoss ? "var(--loss-border)" : isMine ? "var(--accent-border)" : "rgba(255,255,255,0.06)"}` }}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold" style={{ color: isWinner ? "var(--win)" : isLoss ? "var(--loss)" : isMine ? "var(--accent)" : "var(--text)" }}>{label}</span>
                <span className="text-[13px] font-bold" style={{ color: "var(--muted)" }}>{pct}%</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isWinner ? "var(--win-border)" : isLoss ? "var(--loss-border)" : isMine ? "var(--accent)" : "rgba(255,255,255,0.18)" }} />
              </div>
              {pts > 0 && <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>{pts.toLocaleString()} pts</p>}
            </div>
          );
        })}
      </div>

      {bet.status === "resolved" && bet.winning_side && (
        <p className="text-[12px] font-bold" style={{ color: "var(--win)" }}>
          ✓ {bet.winning_side === "a" ? bet.option_a : bet.option_b} won
        </p>
      )}

      <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>
        {bet.total_entries} {bet.total_entries === 1 ? "entry" : "entries"} · {totalPts.toLocaleString()} pts
        {myEntry && ` · you bet ${myEntry.points_wagered.toLocaleString()} pts on ${myEntry.side === "a" ? bet.option_a : bet.option_b}`}
      </p>

      {/* Followed entries */}
      {bet.followed_entries.length > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            {bet.followed_entries.slice(0, 5).map((e, i) => (
              e.bettor?.avatar_url
                ? <button key={e.user_id} onClick={() => e.bettor?.username && router.push(`/u/${e.bettor.username}`)} style={{ marginLeft: i === 0 ? 0 : -4, zIndex: 10 - i, borderRadius: "50%", padding: 0, lineHeight: 0, border: `1.5px solid ${e.side === "a" ? "var(--accent)" : "rgba(255,255,255,0.2)"}` }}>
                    <img src={e.bettor.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: "50%", display: "block", objectFit: "cover" }} />
                  </button>
                : <div key={e.user_id} className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[7px] font-black" style={{ marginLeft: i === 0 ? 0 : -4, zIndex: 10 - i, border: `1.5px solid ${e.side === "a" ? "var(--accent)" : "rgba(255,255,255,0.2)"}`, background: "rgba(255,255,255,0.1)", color: "var(--muted)" }}>
                    {(e.bettor?.display_name ?? "?")[0].toUpperCase()}
                  </div>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>
            {bet.followed_entries.slice(0, 2).map((e) => e.bettor?.display_name ?? e.bettor?.username ?? "someone").join(", ")}
            {bet.followed_entries.length > 2 ? ` +${bet.followed_entries.length - 2} more` : ""} bet
          </p>
        </div>
      )}

      {/* Reactions + actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {EMOJIS.map((emoji) => {
          const count = reactionMap[emoji] ?? 0;
          const isActive = bet.my_reaction === emoji;
          return (
            <button key={emoji} onClick={() => toggleReaction(emoji)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold"
              style={{ background: isActive ? "var(--accent-dim)" : "rgba(255,255,255,0.04)", border: `1px solid ${isActive ? "var(--accent-border)" : "rgba(255,255,255,0.06)"}`, color: isActive ? "var(--accent)" : "var(--muted)" }}>
              {emoji}{count > 0 && <span className="ml-0.5">{count}</span>}
            </button>
          );
        })}
        <button
          onClick={() => { if (!showComments) fetchComments(); setShowComments(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
          style={{ color: "var(--muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {commentCount > 0 ? commentCount : "comment"}
        </button>
        {/* Share to feed */}
        {bet.my_post ? (
          <button onClick={unshare} className="px-2.5 py-1 rounded-full text-[12px] font-semibold"
            style={{ color: "var(--win)", background: "var(--win-dim)", border: "1px solid var(--win-border)" }}>
            shared ✓
          </button>
        ) : (
          <button onClick={() => setShowShare(true)} className="px-2.5 py-1 rounded-full text-[12px] font-semibold"
            style={{ color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
            share
          </button>
        )}
      </div>

      {/* Public posts preview */}
      {bet.public_posts.length > 0 && (
        <div className="flex flex-col gap-2">
          {bet.public_posts.slice(0, 3).map((post) => {
            const name = post.user?.display_name ?? post.user?.username ?? "someone";
            return (
              <div key={post.id} className="rounded-[10px] p-2.5 flex items-start gap-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => post.user?.username && router.push(`/u/${post.user.username}`)}>
                  <div className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ width: 24, height: 24, background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
                    {post.user?.avatar_url
                      ? <img src={post.user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[9px] font-black" style={{ color: "var(--accent)" }}>{name[0]?.toUpperCase()}</span>
                    }
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold" style={{ color: "var(--text)" }}>{name}
                    {post.side && <span className="font-normal ml-1" style={{ color: "var(--dimmer)" }}>· {post.side === "a" ? bet.option_a : bet.option_b}</span>}
                  </p>
                  {post.caption && <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--muted)" }}>{post.caption}</p>}
                  {post.photo_url && <img src={post.photo_url} alt="" className="w-full rounded-[8px] mt-1 object-cover" style={{ maxHeight: 160 }} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowShare(false); }}>
          <div className="w-full max-w-lg rounded-t-3xl flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: "60vh" }}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>share to feed</p>
              <button onClick={() => setShowShare(false)} className="text-[14px] font-bold" style={{ color: "var(--dimmer)" }}>cancel</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--muted)" }}>
                sharing: <span style={{ color: "var(--text)" }}>{bet.question}</span>
              </p>
              <textarea
                value={shareCaption}
                onChange={(e) => setShareCaption(e.target.value)}
                placeholder="add a caption (optional)..."
                maxLength={280}
                rows={3}
                className="w-full text-[14px] px-4 py-3 rounded-2xl outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
              />
            </div>
            <div className="px-6 pb-6 flex-shrink-0">
              <button onClick={shareToFeed} disabled={sharing}
                className="w-full py-4 rounded-[14px] text-[15px] font-black disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff", fontFamily: "var(--font-nunito)" }}>
                {sharing ? "sharing…" : "share"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments sheet */}
      {showComments && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowComments(false); }}>
          <div className="w-full max-w-lg rounded-t-3xl flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: "75vh" }}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>comments</p>
              <button onClick={() => setShowComments(false)} className="text-[14px] font-bold" style={{ color: "var(--dimmer)" }}>done</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
              {commentsLoading
                ? <p className="text-[13px] text-center py-6" style={{ color: "var(--dimmer)" }}>loading...</p>
                : comments.length === 0
                  ? <p className="text-[13px] text-center py-6" style={{ color: "var(--dimmer)" }}>no comments yet — be first</p>
                  : comments.map((c) => {
                    const name = c.balances?.display_name ?? c.balances?.username ?? "someone";
                    return (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, background: "var(--accent-dim)" }}>
                          {c.balances?.avatar_url
                            ? <img src={c.balances.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            : <span className="text-[10px] font-black" style={{ color: "var(--accent)" }}>{name[0]?.toUpperCase()}</span>
                          }
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{name}</p>
                          {c.body && <p className="text-[13px] mt-0.5" style={{ color: "var(--text)" }}>{c.body}</p>}
                        </div>
                        {c.user_id === currentUserId && (
                          <button onClick={async () => {
                            const token = await getAccessToken();
                            await fetch(`/api/v1/explore-bets/${bet.id}/comments?commentId=${c.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
                            setComments((prev) => prev.filter((x) => x.id !== c.id));
                            setCommentCount((n) => n - 1);
                          }} className="text-[11px] self-start mt-1" style={{ color: "var(--dimmer)" }}>✕</button>
                        )}
                      </div>
                    );
                  })
              }
            </div>
            <form onSubmit={submitComment} className="flex gap-2 px-6 py-3 items-center flex-shrink-0" style={{ borderTop: "1px solid var(--border-soft)" }}>
              <input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="add a comment..."
                maxLength={500}
                className="flex-1 text-[14px] px-4 py-3 rounded-2xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
              />
              <button type="submit" disabled={!commentInput.trim() || submitting} className="px-4 py-3 rounded-2xl text-[14px] font-bold text-white disabled:opacity-40" style={{ background: "var(--accent)" }}>
                post
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PollCard({
  poll: initialPoll,
  currentUserId,
  getAccessToken,
  onPollUpdate,
}: {
  poll: Poll;
  currentUserId?: string;
  getAccessToken: () => Promise<string | null>;
  onPollUpdate: (updated: Partial<Poll> & { id: string }) => void;
}) {
  const router = useRouter();
  const [poll, setPoll] = useState(initialPoll);
  const [voting, setVoting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareCaption, setShareCaption] = useState("");
  const [sharing, setSharing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentCount, setCommentCount] = useState(poll.comment_count);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isClosed = poll.closes_at ? new Date(poll.closes_at) < new Date() : false;
  const hasVoted = !!poll.my_vote;
  const totalVotes = poll.votes_a + poll.votes_b;
  const pctA = totalVotes > 0 ? Math.round((poll.votes_a / totalVotes) * 100) : 50;
  const pctB = totalVotes > 0 ? Math.round((poll.votes_b / totalVotes) * 100) : 50;
  const creator = poll.creator;
  const creatorName = creator?.display_name ?? creator?.username ?? "someone";

  const reactionMap: Record<string, number> = {};
  for (const r of poll.reactions) reactionMap[r.emoji] = r.count;

  async function castVote(side: "a" | "b") {
    if (voting || hasVoted || isClosed) return;
    setVoting(true);
    setPoll((p) => ({
      ...p,
      my_vote: side,
      votes_a: side === "a" ? p.votes_a + 1 : p.votes_a,
      votes_b: side === "b" ? p.votes_b + 1 : p.votes_b,
      total_votes: p.total_votes + 1,
    }));
    const token = await getAccessToken();
    await fetch(`/api/v1/polls/${poll.id}/vote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ side }),
    });
    setVoting(false);
  }

  async function toggleReaction(emoji: string) {
    const token = await getAccessToken();
    const wasActive = poll.my_reaction === emoji;
    const newReaction = wasActive ? null : emoji;
    const newReactions = (() => {
      const map: Record<string, number> = {};
      for (const r of poll.reactions) map[r.emoji] = r.count;
      if (wasActive) { map[emoji] = Math.max(0, (map[emoji] ?? 1) - 1); }
      else {
        if (poll.my_reaction) map[poll.my_reaction] = Math.max(0, (map[poll.my_reaction] ?? 1) - 1);
        map[emoji] = (map[emoji] ?? 0) + 1;
      }
      return Object.entries(map).filter(([, c]) => c > 0).map(([e, c]) => ({ emoji: e, count: c }));
    })();
    setPoll((p) => ({ ...p, my_reaction: newReaction, reactions: newReactions }));
    await fetch(`/api/v1/polls/${poll.id}/react`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }

  async function shareToFeed() {
    setSharing(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/polls/${poll.id}/post`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ caption: shareCaption.trim() || null }),
    });
    if (res.ok) {
      setPoll((p) => ({ ...p, my_post: { caption: shareCaption.trim() || null, photo_url: null } }));
      setShowShare(false);
      setShareCaption("");
    }
    setSharing(false);
  }

  async function unshare() {
    const token = await getAccessToken();
    await fetch(`/api/v1/polls/${poll.id}/post`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setPoll((p) => ({ ...p, my_post: null }));
  }

  async function fetchComments() {
    setCommentsLoading(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/polls/${poll.id}/comments`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setComments(data.comments ?? []);
    setCommentCount(data.comments?.length ?? commentCount);
    setCommentsLoading(false);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/polls/${poll.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentInput.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setComments((prev) => [...prev, data.comment]);
      setCommentCount((c) => c + 1);
      setCommentInput("");
    }
    setSubmitting(false);
  }

  return (
    <div className="rounded-[16px] p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
      {/* Creator row */}
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-2.5" onClick={() => creator?.username && router.push(`/u/${creator.username}`)}>
          <div className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ width: 32, height: 32, background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
            {creator?.avatar_url
              ? <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-[12px] font-black" style={{ color: "var(--accent)" }}>{creatorName[0]?.toUpperCase() ?? "?"}</span>
            }
          </div>
          <div className="text-left">
            <p className="text-[13px] font-bold leading-none" style={{ color: "var(--text)" }}>{creatorName}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{timeAgo(poll.created_at)}</p>
          </div>
        </button>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-[6px]" style={{ background: "rgba(147,51,234,0.15)", color: "#a855f7", border: "1px solid rgba(147,51,234,0.3)" }}>poll</span>
      </div>

      {/* Question */}
      <p className="text-[15px] font-bold leading-snug" style={{ color: "var(--text)" }}>{poll.question}</p>

      {/* A/B options */}
      <div className="flex flex-col gap-2">
        {(["a", "b"] as const).map((side) => {
          const label = side === "a" ? poll.option_a : poll.option_b;
          const votes = side === "a" ? poll.votes_a : poll.votes_b;
          const pct = side === "a" ? pctA : pctB;
          const isMyVote = poll.my_vote === side;

          if (!hasVoted && !isClosed) {
            return (
              <button key={side} onClick={() => castVote(side)} disabled={voting}
                className="w-full py-3 px-4 rounded-[10px] text-[14px] font-bold text-left"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)" }}>
                {label}
              </button>
            );
          }

          return (
            <div key={side} className="rounded-[10px] p-2.5 flex flex-col gap-1.5"
              style={{ background: isMyVote ? "rgba(147,51,234,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${isMyVote ? "rgba(147,51,234,0.3)" : "rgba(255,255,255,0.06)"}` }}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold" style={{ color: isMyVote ? "#a855f7" : "var(--text)" }}>{label}</span>
                <span className="text-[13px] font-bold" style={{ color: "var(--muted)" }}>{pct}%</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isMyVote ? "#a855f7" : "rgba(255,255,255,0.18)" }} />
              </div>
              <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>{votes} {votes === 1 ? "vote" : "votes"}</p>
            </div>
          );
        })}
      </div>

      <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>
        {totalVotes} total · {isClosed ? "closed" : poll.closes_at ? `closes ${timeAgo(poll.closes_at)}` : "open"}
      </p>

      {/* Followed votes */}
      {poll.followed_votes.length > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            {poll.followed_votes.slice(0, 5).map((v, i) => (
              v.voter?.avatar_url
                ? <button key={v.user_id} onClick={() => v.voter?.username && router.push(`/u/${v.voter.username}`)} style={{ marginLeft: i === 0 ? 0 : -4, zIndex: 10 - i, borderRadius: "50%", padding: 0, lineHeight: 0, border: `1.5px solid ${v.side === "a" ? "#a855f7" : "rgba(255,255,255,0.2)"}` }}>
                    <img src={v.voter.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: "50%", display: "block", objectFit: "cover" }} />
                  </button>
                : <div key={v.user_id} className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[7px] font-black" style={{ marginLeft: i === 0 ? 0 : -4, zIndex: 10 - i, border: `1.5px solid rgba(255,255,255,0.2)`, background: "rgba(255,255,255,0.1)", color: "var(--muted)" }}>
                    {(v.voter?.display_name ?? "?")[0].toUpperCase()}
                  </div>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>
            {poll.followed_votes.slice(0, 2).map((v) => v.voter?.display_name ?? v.voter?.username ?? "someone").join(", ")} voted
            {poll.other_vote_count > 0 ? ` +${poll.other_vote_count} more` : ""}
          </p>
        </div>
      )}

      {/* Reactions + actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {EMOJIS.map((emoji) => {
          const count = reactionMap[emoji] ?? 0;
          const isActive = poll.my_reaction === emoji;
          return (
            <button key={emoji} onClick={() => toggleReaction(emoji)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold"
              style={{ background: isActive ? "rgba(147,51,234,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${isActive ? "rgba(147,51,234,0.3)" : "rgba(255,255,255,0.06)"}`, color: isActive ? "#a855f7" : "var(--muted)" }}>
              {emoji}{count > 0 && <span className="ml-0.5">{count}</span>}
            </button>
          );
        })}
        <button
          onClick={() => { if (!showComments) fetchComments(); setShowComments(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
          style={{ color: "var(--muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {commentCount > 0 ? commentCount : "comment"}
        </button>
        {poll.my_post ? (
          <button onClick={unshare} className="px-2.5 py-1 rounded-full text-[12px] font-semibold"
            style={{ color: "var(--win)", background: "var(--win-dim)", border: "1px solid var(--win-border)" }}>
            shared ✓
          </button>
        ) : (
          <button onClick={() => setShowShare(true)} className="px-2.5 py-1 rounded-full text-[12px] font-semibold"
            style={{ color: "#a855f7", background: "rgba(147,51,234,0.15)", border: "1px solid rgba(147,51,234,0.3)" }}>
            share
          </button>
        )}
      </div>

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowShare(false); }}>
          <div className="w-full max-w-lg rounded-t-3xl flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: "60vh" }}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>share to feed</p>
              <button onClick={() => setShowShare(false)} className="text-[14px] font-bold" style={{ color: "var(--dimmer)" }}>cancel</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--muted)" }}>
                sharing: <span style={{ color: "var(--text)" }}>{poll.question}</span>
              </p>
              <textarea
                value={shareCaption}
                onChange={(e) => setShareCaption(e.target.value)}
                placeholder="add a caption (optional)..."
                maxLength={280}
                rows={3}
                className="w-full text-[14px] px-4 py-3 rounded-2xl outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
              />
            </div>
            <div className="px-6 pb-6 flex-shrink-0">
              <button onClick={shareToFeed} disabled={sharing}
                className="w-full py-4 rounded-[14px] text-[15px] font-black disabled:opacity-40"
                style={{ background: "#a855f7", color: "#fff", fontFamily: "var(--font-nunito)" }}>
                {sharing ? "sharing…" : "share"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments sheet */}
      {showComments && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowComments(false); }}>
          <div className="w-full max-w-lg rounded-t-3xl flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: "75vh" }}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>comments</p>
              <button onClick={() => setShowComments(false)} className="text-[14px] font-bold" style={{ color: "var(--dimmer)" }}>done</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
              {commentsLoading
                ? <p className="text-[13px] text-center py-6" style={{ color: "var(--dimmer)" }}>loading...</p>
                : comments.length === 0
                  ? <p className="text-[13px] text-center py-6" style={{ color: "var(--dimmer)" }}>no comments yet — be first</p>
                  : comments.map((c) => {
                    const name = c.balances?.display_name ?? c.balances?.username ?? "someone";
                    return (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, background: "var(--accent-dim)" }}>
                          {c.balances?.avatar_url
                            ? <img src={c.balances.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            : <span className="text-[10px] font-black" style={{ color: "var(--accent)" }}>{name[0]?.toUpperCase()}</span>
                          }
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{name}</p>
                          {c.body && <p className="text-[13px] mt-0.5" style={{ color: "var(--text)" }}>{c.body}</p>}
                        </div>
                        {c.user_id === currentUserId && (
                          <button onClick={async () => {
                            const token = await getAccessToken();
                            await fetch(`/api/v1/polls/${poll.id}/comments?commentId=${c.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
                            setComments((prev) => prev.filter((x) => x.id !== c.id));
                            setCommentCount((n) => n - 1);
                          }} className="text-[11px] self-start mt-1" style={{ color: "var(--dimmer)" }}>✕</button>
                        )}
                      </div>
                    );
                  })
              }
            </div>
            <form onSubmit={submitComment} className="flex gap-2 px-6 py-3 items-center flex-shrink-0" style={{ borderTop: "1px solid var(--border-soft)" }}>
              <input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="add a comment..."
                maxLength={500}
                className="flex-1 text-[14px] px-4 py-3 rounded-2xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
              />
              <button type="submit" disabled={!commentInput.trim() || submitting} className="px-4 py-3 rounded-2xl text-[14px] font-bold text-white disabled:opacity-40" style={{ background: "#a855f7" }}>
                post
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

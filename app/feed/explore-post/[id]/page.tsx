"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import BottomNav from "@/components/BottomNav";

type ExploreBetPost = {
  id: string; explore_bet_id: string; user_id: string;
  caption: string | null; photo_url: string | null; created_at: string;
  balances: { display_name: string | null; avatar_url: string | null; username: string | null } | null;
  explore_bets: {
    id: string; question: string; option_a: string; option_b: string;
    status: "open" | "resolved"; winning_side: "a" | "b" | null; closes_at: string | null;
    total_pts_a: number; total_pts_b: number; total_entries: number;
    my_entry: { side: "a" | "b"; points_wagered: number } | null;
    reactions: { emoji: string; count: number }[];
    my_reaction: string | null;
    comment_count: number;
    followed_entries: { user_id: string; side: "a" | "b"; bettor: { display_name: string; username: string; avatar_url: string | null } | null }[];
    other_entry_count: number;
  } | null;
};
type Comment = { id: string; body?: string | null; created_at: string; user_id: string; balances?: { display_name: string | null; avatar_url: string | null; username?: string | null } | null };

const EMOJIS = ["🔥", "😂", "😮", "❤️", "👏"];

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24); if (dy < 7) return `${dy}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ExplorePostDetailPage() {
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [post, setPost] = useState<ExploreBetPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [reactions, setReactions] = useState<{ emoji: string; count: number }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    async function load() {
      const token = await getAccessToken();
      const res = await fetch(`/api/v1/explore-bet-posts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const d = await res.json();
      setPost(d.post);
      setMyReaction(d.post.explore_bets?.my_reaction ?? null);
      setReactions(d.post.explore_bets?.reactions ?? []);
      setLoading(false);
      // load comments
      setCommentsLoading(true);
      const cr = await fetch(`/api/v1/explore-bets/${d.post.explore_bet_id}/comments`, { headers: { Authorization: `Bearer ${token}` } });
      if (cr.ok) { const cd = await cr.json(); setComments(cd.comments ?? []); }
      setCommentsLoading(false);
    }
    load();
  }, [ready, authenticated, id]);

  async function toggleReaction(emoji: string) {
    if (!post?.explore_bets) return;
    const token = await getAccessToken();
    const wasActive = myReaction === emoji;
    setMyReaction(wasActive ? null : emoji);
    setReactions((prev) => {
      const map: Record<string, number> = {};
      for (const r of prev) map[r.emoji] = r.count;
      if (wasActive) { map[emoji] = Math.max(0, (map[emoji] ?? 1) - 1); }
      else {
        if (myReaction) map[myReaction] = Math.max(0, (map[myReaction] ?? 1) - 1);
        map[emoji] = (map[emoji] ?? 0) + 1;
      }
      return Object.entries(map).filter(([, c]) => c > 0).map(([e, c]) => ({ emoji: e, count: c }));
    });
    await fetch(`/api/v1/explore-bets/${post.explore_bets.id}/react`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim() || submitting || !post?.explore_bets) return;
    setSubmitting(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${post.explore_bets.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentInput.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setComments((prev) => [...prev, data.comment]); setCommentInput(""); }
    setSubmitting(false);
  }

  if (!ready || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="text-[14px]" style={{ color: "var(--dimmer)" }}>loading…</p>
    </div>
  );
  if (notFound || !post) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="text-[14px]" style={{ color: "var(--dimmer)" }}>post not found</p>
    </div>
  );

  const bet = post.explore_bets;
  const sharer = post.balances;
  const sharerName = sharer?.display_name ?? sharer?.username ?? "someone";
  const totalPts = (bet?.total_pts_a ?? 0) + (bet?.total_pts_b ?? 0);
  const pctA = totalPts > 0 ? Math.round(((bet?.total_pts_a ?? 0) / totalPts) * 100) : 50;
  const pctB = totalPts > 0 ? Math.round(((bet?.total_pts_b ?? 0) / totalPts) * 100) : 50;
  const isResolved = bet?.status === "resolved";
  const currentUserId = privyUser?.id;

  return (
    <div className="min-h-screen pb-20" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text)" }}>
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <p className="font-extrabold text-[17px]" style={{ fontFamily: "var(--font-nunito)", color: "var(--text)" }}>post</p>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4 max-w-lg mx-auto">
        {/* Sharer row */}
        <div className="flex items-center gap-2.5">
          <button onClick={() => sharer?.username && router.push(`/u/${sharer.username}`)}>
            <div className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ width: 36, height: 36, background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
              {sharer?.avatar_url
                ? <img src={sharer.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-[13px] font-black" style={{ color: "var(--accent)" }}>{sharerName[0]?.toUpperCase() ?? "?"}</span>
              }
            </div>
          </button>
          <div>
            <p className="text-[14px] font-bold" style={{ color: "var(--text)" }}>
              {sharerName} <span className="font-normal" style={{ color: "var(--muted)" }}>shared a prediction</span>
            </p>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>{timeAgo(post.created_at)}</p>
          </div>
        </div>

        {/* Bet card */}
        {bet && (
          <div className="rounded-[12px] p-3 flex flex-col gap-2" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <p className="text-[14px] font-bold leading-snug" style={{ color: "var(--text)" }}>{bet.question}</p>
            {(["a", "b"] as const).map((side) => {
              const label = side === "a" ? bet.option_a : bet.option_b;
              const pts = side === "a" ? (bet.total_pts_a ?? 0) : (bet.total_pts_b ?? 0);
              const pct = side === "a" ? pctA : pctB;
              const isWinner = isResolved && bet.winning_side === side;
              const isLoss = isResolved && bet.winning_side !== null && bet.winning_side !== side;
              const isMine = bet.my_entry?.side === side;
              return (
                <div key={side} className="rounded-[10px] p-2.5 flex flex-col gap-1.5"
                  style={{ background: isWinner ? "var(--win-dim)" : isLoss ? "var(--loss-dim)" : "rgba(255,255,255,0.03)", border: `1px solid ${isWinner ? "var(--win-border)" : isLoss ? "var(--loss-border)" : "rgba(255,255,255,0.06)"}` }}>
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
            {isResolved && bet.winning_side && (
              <p className="text-[12px] font-bold" style={{ color: "var(--win)" }}>✓ {bet.winning_side === "a" ? bet.option_a : bet.option_b} won</p>
            )}
            <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>{bet.total_entries} entries · {totalPts.toLocaleString()} pts</p>
          </div>
        )}

        {/* Photo */}
        {post.photo_url && (
          <img src={post.photo_url} alt="" className="w-full rounded-[12px] object-cover" style={{ maxHeight: 360 }} />
        )}

        {/* Caption */}
        {post.caption && (
          <p className="text-[15px] leading-snug" style={{ color: "var(--text)" }}>
            {post.caption.split(/(@\w+)/g).map((part, i) =>
              /^@\w+$/.test(part)
                ? <a key={i} href={`/u/${part.slice(1)}`} style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>{part}</a>
                : part
            )}
          </p>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {reactions.filter((r) => r.count > 0).map((r) => (
            <button key={r.emoji} onClick={() => toggleReaction(r.emoji)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold"
              style={{ background: myReaction === r.emoji ? "var(--accent-dim)" : "rgba(255,255,255,0.04)", border: `1px solid ${myReaction === r.emoji ? "var(--accent-border)" : "rgba(255,255,255,0.06)"}`, color: myReaction === r.emoji ? "var(--accent)" : "var(--muted)" }}>
              {r.emoji}<span className="ml-0.5">{r.count}</span>
            </button>
          ))}
          <div className="relative">
            <button onClick={() => setShowEmojiPicker((s) => !s)}
              className="px-2.5 py-1 rounded-full text-[12px] font-semibold"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--muted)" }}>
              ＋
            </button>
            {showEmojiPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                <div className="absolute left-0 bottom-9 z-50 flex gap-1.5 px-3 py-2 rounded-2xl shadow-lg" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
                  {EMOJIS.map((emoji) => (
                    <button key={emoji} onClick={() => { toggleReaction(emoji); setShowEmojiPicker(false); }}
                      className="text-[18px] leading-none px-1 py-0.5 rounded-lg"
                      style={{ background: myReaction === emoji ? "var(--accent-dim)" : "transparent" }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="flex flex-col gap-3">
          <p className="font-extrabold text-[15px]" style={{ fontFamily: "var(--font-nunito)", color: "var(--text)" }}>comments</p>
          {commentsLoading
            ? <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>loading…</p>
            : comments.length === 0
              ? <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>no comments yet — be first</p>
              : comments.map((c) => {
                const name = c.balances?.display_name ?? c.balances?.username ?? "someone";
                return (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, background: "var(--accent-dim)" }}>
                      {c.balances?.avatar_url
                        ? <img src={c.balances.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        : <span className="text-[11px] font-black" style={{ color: "var(--accent)" }}>{name[0]?.toUpperCase()}</span>
                      }
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{name}</p>
                      {c.body && <p className="text-[13px] mt-0.5" style={{ color: "var(--text)" }}>{c.body}</p>}
                    </div>
                    {c.user_id === currentUserId && (
                      <button onClick={async () => {
                        const token = await getAccessToken();
                        await fetch(`/api/v1/explore-bets/${bet!.id}/comments?commentId=${c.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
                        setComments((prev) => prev.filter((x) => x.id !== c.id));
                      }} className="text-[11px] self-start mt-1" style={{ color: "var(--dimmer)" }}>✕</button>
                    )}
                  </div>
                );
              })
          }
          <form onSubmit={submitComment} className="flex gap-2 items-center pt-2" style={{ borderTop: "1px solid var(--border-soft)" }}>
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

      <BottomNav />
    </div>
  );
}

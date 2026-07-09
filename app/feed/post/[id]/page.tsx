"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import BottomNav from "@/components/BottomNav";

type BetOption = { id: string; label: string };
type EmbeddedBet = {
  id: string; question: string; deadline: string; status: "open" | "resolved";
  winning_option_id: string | null; creator_id: string; created_at: string;
  event_id: string | null; events: { name: string } | null;
  bet_options: BetOption[];
  bet_entries: { user_id: string; option_id: string; points_staked: number; balances: { display_name: string | null; avatar_url: string | null; username: string | null } | null }[];
  balances: { display_name: string | null; avatar_url: string | null; username: string | null } | null;
};
type Post = {
  id: string; user_id: string; bet_id: string; caption: string | null; photo_url: string | null; created_at: string;
  balances: { display_name: string | null; avatar_url: string | null; username: string | null } | null;
  post_likes: { user_id: string }[];
  post_comments: { id: string }[];
  bets: EmbeddedBet | null;
};
type Comment = { id: string; body?: string | null; gif_url?: string | null; created_at: string; user_id: string; balances?: { display_name: string | null; avatar_url: string | null; username?: string | null } | null };

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24); if (dy < 7) return `${dy}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PostDetailPage() {
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    async function load() {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/v1/posts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      const p: Post = data.post;
      setPost(p);
      setLiked(p.post_likes.some((l) => l.user_id === privyUser?.id));
      setLikeCount(p.post_likes.length);
      setCommentCount(p.post_comments.length);
      setLoading(false);
    }
    load();
  }, [ready, authenticated, id, getAccessToken, privyUser?.id, router]);

  const loadComments = useCallback(async () => {
    if (!post) return;
    setCommentsLoading(true);
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/v1/posts/${post.id}/comments`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setComments(data.comments ?? []);
    setCommentsLoading(false);
  }, [post, getAccessToken]);

  useEffect(() => { if (post) loadComments(); }, [post, loadComments]);

  async function toggleLike() {
    if (!post) return;
    const token = await getAccessToken();
    if (!token) return;
    const wasLiked = liked;
    setLiked(!wasLiked); setLikeCount((c) => c + (wasLiked ? -1 : 1));
    await fetch(`/api/v1/posts/${post.id}/likes`, {
      method: wasLiked ? "DELETE" : "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim() || submittingRef.current || !post) return;
    submittingRef.current = true; setSubmitting(true);
    const body = commentInput.trim(); setCommentInput("");
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/posts/${post.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setCommentCount((c) => c + 1);
    }
    submittingRef.current = false; setSubmitting(false);
  }

  if (!ready || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
    </div>
  );

  if (notFound || !post) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: "var(--bg)" }}>
      <p className="text-[15px] font-bold" style={{ color: "var(--text)" }}>post not found</p>
      <button onClick={() => router.push("/feed")} className="text-[13px]" style={{ color: "var(--accent)" }}>← back to feed</button>
      <BottomNav />
    </div>
  );

  const bet = post.bets;
  const sharer = post.balances;
  const sharerName = sharer?.display_name ?? sharer?.username ?? "someone";
  const totalStaked = bet?.bet_entries.reduce((s, e) => s + e.points_staked, 0) ?? 0;
  const winOpt = bet?.winning_option_id ? bet.bet_options.find((o) => o.id === bet.winning_option_id) : null;

  return (
    <div className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 pt-12 pb-3" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border-soft)" }}>
        <button onClick={() => router.back()} className="text-[14px] font-semibold" style={{ color: "var(--accent)" }}>← back</button>
        <p className="text-[15px] font-black" style={{ fontFamily: "var(--font-nunito)" }}>post</p>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4 max-w-lg mx-auto">
        {/* Post card */}
        <div className="rounded-[16px] p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
          {/* Sharer row */}
          <div className="flex items-center gap-2.5">
            <button onClick={() => sharer?.username && router.push(`/u/${sharer.username}`)} className="flex items-center gap-2.5">
              <div className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ width: 32, height: 32, background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
                {sharer?.avatar_url
                  ? <img src={sharer.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[12px] font-black" style={{ color: "var(--accent)" }}>{sharerName[0]?.toUpperCase() ?? "?"}</span>
                }
              </div>
              <div className="text-left">
                <p className="text-[13px] font-bold leading-none" style={{ color: "var(--text)" }}>{sharerName}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{timeAgo(post.created_at)}</p>
              </div>
            </button>
          </div>

          {/* Photo */}
          {post.photo_url && <img src={post.photo_url} alt="" className="w-full rounded-[12px]" style={{ maxHeight: 380, objectFit: "cover" }} />}

          {/* Caption */}
          {post.caption && (
            <p className="text-[14px] leading-snug" style={{ color: "var(--text)" }}>
              {post.caption.split(/(@\w+)/g).map((part, i) =>
                /^@\w+$/.test(part)
                  ? <button key={i} onClick={() => router.push(`/u/${part.slice(1)}`)} style={{ color: "var(--accent)", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer" }}>{part}</button>
                  : part
              )}
            </p>
          )}

          {/* Embedded bet */}
          {bet && (
            <div className="rounded-[12px] p-3 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {bet.events?.name && (
                <div className="flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--dimmer)", flexShrink: 0 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="text-[11px] font-semibold" style={{ color: "var(--dimmer)" }}>{bet.events.name}</span>
                </div>
              )}
              <p className="text-[14px] font-bold leading-snug" style={{ color: "var(--text)" }}>{bet.question}</p>
              <div className="flex flex-col gap-1.5">
                {bet.bet_options.map((opt) => {
                  const voters = bet.bet_entries.filter((e) => e.option_id === opt.id);
                  const optTotal = voters.reduce((s, e) => s + e.points_staked, 0);
                  const pct = totalStaked > 0 ? Math.round((optTotal / totalStaked) * 100) : 0;
                  const isWinner = bet.winning_option_id === opt.id;
                  const isLoss = bet.winning_option_id !== null && !isWinner;
                  const isMe = voters.some((e) => e.user_id === privyUser?.id);
                  return (
                    <div key={opt.id} className="rounded-[10px] p-2.5 flex flex-col gap-1.5"
                      style={{ background: isWinner ? "var(--win-dim)" : isLoss ? "var(--loss-dim)" : "rgba(255,255,255,0.03)", border: `1px solid ${isWinner ? "var(--win-border)" : isLoss ? "var(--loss-border)" : "rgba(255,255,255,0.06)"}` }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold" style={{ color: isWinner ? "var(--win)" : isLoss ? "var(--loss)" : isMe ? "var(--accent)" : "var(--text)" }}>{opt.label}</span>
                        <span className="text-[13px] font-bold" style={{ color: "var(--muted)" }}>{pct}%</span>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isWinner ? "var(--win-border)" : isLoss ? "var(--loss-border)" : isMe ? "var(--accent)" : "rgba(255,255,255,0.18)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {winOpt && <p className="text-[12px] font-bold" style={{ color: "var(--win)" }}>✓ {winOpt.label} won</p>}
              {bet.event_id && (
                <button onClick={() => router.push(`/e/${bet.event_id}`)} className="text-[11px] font-semibold text-left" style={{ color: "var(--accent)" }}>
                  view in event →
                </button>
              )}
            </div>
          )}

          {/* Like row */}
          <div className="flex items-center gap-4 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <button onClick={toggleLike} className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: liked ? "var(--accent)" : "var(--muted)" }}>
              <span>{liked ? "♥" : "♡"}</span>
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <span className="text-[12px]" style={{ color: "var(--dimmer)" }}>{commentCount} {commentCount === 1 ? "comment" : "comments"}</span>
          </div>
        </div>

        {/* Comments */}
        <div className="flex flex-col gap-3">
          <p className="text-[13px] font-bold" style={{ color: "var(--muted)" }}>comments</p>
          {commentsLoading && <div className="w-4 h-4 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />}
          {comments.map((c) => {
            const name = c.balances?.display_name ?? c.balances?.username ?? "someone";
            return (
              <div key={c.id} className="flex gap-2.5">
                <button onClick={() => c.balances?.username && router.push(`/u/${c.balances.username}`)} className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
                  {c.balances?.avatar_url
                    ? <img src={c.balances.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    : <span className="text-[10px] font-black" style={{ color: "var(--accent)" }}>{name[0]?.toUpperCase() ?? "?"}</span>
                  }
                </button>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{name}</p>
                  {c.body && <p className="text-[13px]" style={{ color: "var(--text)" }}>{c.body}</p>}
                  {c.gif_url && <img src={c.gif_url} alt="gif" className="rounded-xl mt-1" style={{ maxWidth: 200, maxHeight: 150, objectFit: "cover" }} />}
                </div>
              </div>
            );
          })}
          {comments.length === 0 && !commentsLoading && (
            <p className="text-[13px] italic" style={{ color: "var(--dimmer)" }}>no comments yet</p>
          )}
        </div>

        {/* Comment input */}
        <form onSubmit={submitComment} className="flex gap-2 items-center sticky bottom-20">
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

      <BottomNav />
    </div>
  );
}

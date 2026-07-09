"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useEffect, useState, useCallback, useRef } from "react";

type BetOption = { id: string; label: string };
type EmbeddedBet = {
  id: string;
  question: string;
  deadline: string;
  status: "open" | "resolved";
  winning_option_id: string | null;
  creator_id: string;
  created_at: string;
  event_id: string | null;
  events: { name: string } | null;
  bet_options: BetOption[];
  bet_entries: { user_id: string; option_id: string; points_staked: number; balances: { display_name: string | null; avatar_url: string | null; username: string | null } | null }[];
  balances: { display_name: string | null; avatar_url: string | null; username: string | null } | null;
};
type FeedBet = EmbeddedBet & { type: "bet"; audience: string };
type GifResult = { id: string; images: { fixed_height: { url: string }; fixed_height_small: { url: string } } };
type PostComment = { id: string; body?: string | null; gif_url?: string | null; created_at: string; user_id: string; balances?: { display_name: string | null; avatar_url: string | null; username?: string | null } | null };
type FeedPost = {
  type: "post";
  id: string;
  user_id: string;
  bet_id: string;
  caption: string | null;
  photo_url: string | null;
  created_at: string;
  balances: { display_name: string | null; avatar_url: string | null; username: string | null } | null;
  post_likes: { user_id: string }[];
  post_comments: { id: string }[];
  bets: EmbeddedBet | null;
};
type FeedItem = FeedBet | FeedPost;

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

  const [items, setItems] = useState<FeedItem[]>([]);
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
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

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
    const incoming: FeedItem[] = feedData.items ?? [];
    setItems((prev) => cursor ? [...prev, ...incoming] : incoming);
    setNextCursor(feedData.nextCursor ?? null);
    if (!cursor && feedData.followedIds) setFollowedIds(new Set(feedData.followedIds as string[]));
    // Mark all loaded items as seen after this render
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
      setItems((prev) => prev.map((item) => {
        if (item.type !== "bet" || item.id !== betId) return item;
        return { ...item, bet_entries: [...item.bet_entries, { user_id: privyUser!.id, option_id: optionId, points_staked: 50, balances: null }] };
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
      setItems((prev) => prev.filter((item) => item.id !== betId));
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

        {!feedError && items.length === 0 && (
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

        {items.map((item) => {
          if (item.type === "post") {
            return (
              <PostCard
                key={`post-${item.id}`}
                item={item}
                currentUserId={privyUser?.id}
                followedIds={followedIds}
                getAccessToken={getAccessToken}
                onDelete={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
              />
            );
          }

          // type === "bet"
          const bet = item;
          const myEntry = bet.bet_entries.find((e) => e.user_id === privyUser?.id);
          const isOpen = bet.status === "open" && new Date(bet.deadline) > new Date();
          const totalStaked = bet.bet_entries.reduce((s, e) => s + e.points_staked, 0);
          const creator = bet.balances;
          const creatorName = creator?.display_name ?? creator?.username ?? "someone";
          const isVoting = votingId === bet.id;

          return (
            <div key={`bet-${bet.id}`} className="rounded-[16px] p-4 flex flex-col gap-3"
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

function PostCard({
  item,
  currentUserId,
  followedIds,
  getAccessToken,
  onDelete,
}: {
  item: FeedPost;
  currentUserId?: string;
  followedIds: Set<string>;
  getAccessToken: () => Promise<string | null>;
  onDelete: () => void;
}) {
  const router = useRouter();
  const bet = item.bets;
  const sharer = item.balances;
  const sharerName = sharer?.display_name ?? sharer?.username ?? "someone";
  const isOwn = item.user_id === currentUserId;

  const [liked, setLiked] = useState(() => item.post_likes.some((l) => l.user_id === currentUserId));
  const [likeCount, setLikeCount] = useState(item.post_likes.length);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentCount, setCommentCount] = useState(item.post_comments.length);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [voterSheet, setVoterSheet] = useState<{ label: string; voters: EmbeddedBet["bet_entries"] } | null>(null);
  const [carouselPage, setCarouselPage] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pendingGif, setPendingGif] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  useEffect(() => {
    if (!showMenu) return;
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showMenu]);

  async function toggleLike() {
    const token = await getAccessToken();
    setLiked((v) => !v);
    setLikeCount((c) => liked ? c - 1 : c + 1);
    await fetch(`/api/v1/posts/${item.id}/likes`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  }

  async function fetchComments() {
    setCommentsLoading(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/posts/${item.id}/comments`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setComments(data.comments ?? []);
    setCommentCount(data.comments?.length ?? commentCount);
    setCommentsLoading(false);
  }

  async function searchGifs(query: string) {
    setGifLoading(true);
    const key = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
    const endpoint = query.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(query)}&limit=24&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=pg-13`;
    const res = await fetch(endpoint);
    const data = await res.json();
    setGifResults(data.data ?? []);
    setGifLoading(false);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim() && !pendingGif) return;
    if (submitting) return;
    setSubmitting(true);
    const token = await getAccessToken();
    const payload: Record<string, unknown> = {};
    if (commentInput.trim()) payload.body = commentInput.trim();
    if (pendingGif) payload.gif_url = pendingGif;
    const res = await fetch(`/api/v1/posts/${item.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setComments((prev) => [...prev, data.comment]);
      setCommentCount((c) => c + 1);
      setCommentInput("");
      setPendingGif(null);
      setGifPickerOpen(false);
    }
    setSubmitting(false);
  }

  async function deleteComment(commentId: string) {
    const token = await getAccessToken();
    await fetch(`/api/v1/posts/${item.id}/comments?commentId=${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCommentCount((c) => c - 1);
  }

  async function deletePost() {
    setDeleting(true);
    const token = await getAccessToken();
    await fetch(`/api/v1/posts?post_id=${item.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    onDelete();
  }

  if (!bet) return null;
  const totalStaked = bet.bet_entries.reduce((s, e) => s + e.points_staked, 0);
  const winOpt = bet.winning_option_id ? bet.bet_options.find((o) => o.id === bet.winning_option_id) : null;

  return (
    <div className="rounded-[16px] p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
      {/* Sharer row */}
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-2.5" onClick={() => sharer?.username && router.push(`/u/${sharer.username}`)}>
          <div className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ width: 32, height: 32, background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
            {sharer?.avatar_url
              ? <img src={sharer.avatar_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-[12px] font-black" style={{ color: "var(--accent)" }}>{sharerName[0]?.toUpperCase() ?? "?"}</span>
            }
          </div>
          <div className="text-left">
            <p className="text-[13px] font-bold leading-none" style={{ color: "var(--text)" }}>
              {sharerName} <span className="font-normal" style={{ color: "var(--muted)" }}>shared a prediction</span>
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{timeAgo(item.created_at)}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-[6px]"
            style={{ background: "var(--win-dim)", color: "var(--win)", border: "1px solid var(--win-border)" }}>resolved</span>
          {isOwn && (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu((s) => !s)} className="w-7 h-7 flex items-center justify-center rounded-full text-[15px] font-bold" style={{ color: "var(--muted)" }}>···</button>
              {showMenu && (
                <div className="absolute right-0 top-8 z-10 rounded-[12px] overflow-hidden shadow-lg" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", minWidth: 130 }}>
                  <button onClick={deletePost} disabled={deleting} className="w-full px-4 py-3 text-left text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
                    {deleting ? "deleting…" : "delete post"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Carousel: page 1 = bet, page 2 = photo + caption */}
      {(() => {
        const hasMedia = !!(item.photo_url || item.caption);
        const embeddedBet = (
          <div className="rounded-[12px] p-3 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {bet.events?.name && bet.event_id && (
              <a href={`/e/${bet.event_id}`} className="flex items-center gap-1 w-fit" style={{ textDecoration: "none" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{bet.events.name}</span>
              </a>
            )}
            <p className="text-[14px] font-bold leading-snug" style={{ color: "var(--text)" }}>{bet.question}</p>
            <div className="flex flex-col gap-1.5">
              {bet.bet_options.map((opt) => {
                const voters = bet.bet_entries.filter((e) => e.option_id === opt.id);
                const optTotal = voters.reduce((s, e) => s + e.points_staked, 0);
                const pct = totalStaked > 0 ? Math.round((optTotal / totalStaked) * 100) : 0;
                const isWinner = bet.winning_option_id === opt.id;
                const isLoss = bet.winning_option_id !== null && !isWinner;
                const isMe = voters.some((e) => e.user_id === currentUserId);
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
                    {voters.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex items-center">
                          {voters.slice(0, 5).map((e, i) => {
                            const isFriend = followedIds.has(e.user_id);
                            const isMe = e.user_id === currentUserId;
                            const borderColor = isMe ? "var(--accent)" : isFriend ? "var(--accent-border)" : "var(--card)";
                            return e.balances?.avatar_url
                              ? <button key={e.user_id} onClick={() => e.balances?.username && router.push(`/u/${e.balances.username}`)} style={{ marginLeft: i === 0 ? 0 : -4, zIndex: voters.length - i, borderRadius: "50%", border: `1.5px solid ${borderColor}`, padding: 0, lineHeight: 0, cursor: e.balances?.username ? "pointer" : "default" }}>
                                  <img src={e.balances.avatar_url} alt="" style={{ width: 16, height: 16, borderRadius: "50%", display: "block", objectFit: "cover" }} />
                                </button>
                              : <button key={e.user_id} onClick={() => e.balances?.username && router.push(`/u/${e.balances.username}`)} className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black" style={{ marginLeft: i === 0 ? 0 : -4, zIndex: voters.length - i, border: `1.5px solid ${borderColor}`, background: isMe ? "var(--accent)" : "rgba(255,255,255,0.15)", color: isMe ? "#fff" : "var(--muted)", cursor: e.balances?.username ? "pointer" : "default" }}>
                                  {isMe ? "me" : (e.balances?.display_name?.[0]?.toUpperCase() ?? "?")}
                                </button>;
                          })}
                        </div>
                        {voters.length > 5 && (
                          <button onClick={() => setVoterSheet({ label: opt.label, voters })} className="text-[10px] font-semibold" style={{ color: "var(--accent)" }}>
                            +{voters.length - 5}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {winOpt && <p className="text-[12px] font-bold" style={{ color: "var(--win)" }}>✓ {winOpt.label} won</p>}
          </div>
        );
        if (!hasMedia) return embeddedBet;
        return (
          <div className="flex flex-col gap-2">
            <div
              style={{ display: "flex", overflowX: "auto", width: "100%", scrollSnapType: "x mandatory", scrollbarWidth: "none" } as React.CSSProperties}
              onScroll={(e) => setCarouselPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            >
              <div style={{ minWidth: "100%", flexShrink: 0, scrollSnapAlign: "start" }}>{embeddedBet}</div>
              <div style={{ minWidth: "100%", flexShrink: 0, scrollSnapAlign: "start", display: "flex", flexDirection: "column", gap: 10 }}>
                {bet.events?.name && bet.event_id && (
                  <div className="flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--dimmer)" }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{bet.events.name}</span>
                  </div>
                )}
                {item.photo_url && <img src={item.photo_url} alt="" className="w-full rounded-[12px] object-cover" style={{ maxHeight: 340 }} />}
                {item.caption && (
                  <p className="text-[14px] leading-snug" style={{ color: "var(--text)" }}>
                    {item.caption.split(/(@\w+)/g).map((part, i) =>
                      /^@\w+$/.test(part)
                        ? <a key={i} href={`/u/${part.slice(1)}`} style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>{part}</a>
                        : part
                    )}
                  </p>
                )}
              </div>
            </div>
            {/* Page dots */}
            <div className="flex justify-center gap-1.5">
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: carouselPage === 0 ? "var(--accent)" : "rgba(255,255,255,0.2)", transition: "background 0.2s" }} />
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: carouselPage === 1 ? "var(--accent)" : "rgba(255,255,255,0.2)", transition: "background 0.2s" }} />
            </div>
          </div>
        );
      })()}

      {/* Footer: votes + like + comment */}
      <div className="flex items-center justify-between pt-2.5 mt-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {bet.bet_entries.length} {bet.bet_entries.length === 1 ? "vote" : "votes"}
          {totalStaked > 0 ? ` · ${totalStaked.toLocaleString()} pts` : ""}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleLike}
            className="flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-full transition-colors"
            style={{
              color: liked ? "var(--accent)" : "var(--muted)",
              background: liked ? "var(--accent-dim)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${liked ? "var(--accent-border)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {likeCount > 0 ? likeCount : "like"}
          </button>
          <button
            onClick={() => { if (!showComments) fetchComments(); setShowComments(true); }}
            className="flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-full"
            style={{ color: "var(--muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {commentCount > 0 ? commentCount : "comment"}
          </button>
        </div>
      </div>

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
              {commentsLoading ? (
                <p className="text-[13px] text-center py-6" style={{ color: "var(--dimmer)" }}>loading...</p>
              ) : comments.length === 0 ? (
                <p className="text-[13px] text-center py-6" style={{ color: "var(--dimmer)" }}>no comments yet — be first</p>
              ) : comments.map((c) => {
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
                      {c.gif_url && <img src={c.gif_url} alt="gif" className="rounded-xl mt-1" style={{ maxWidth: 200, maxHeight: 150, objectFit: "cover" }} />}
                    </div>
                    {c.user_id === currentUserId && (
                      <button onClick={() => deleteComment(c.id)} className="text-[11px] self-start mt-1" style={{ color: "var(--dimmer)" }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex-shrink-0" style={{ borderTop: "1px solid var(--border-soft)" }}>
              {gifPickerOpen && (
                <div className="px-4 pt-3 pb-2 flex flex-col gap-2">
                  <input
                    autoFocus
                    placeholder="search GIFs..."
                    value={gifSearch}
                    onChange={(e) => { setGifSearch(e.target.value); searchGifs(e.target.value); }}
                    onFocus={() => { if (gifResults.length === 0) searchGifs(""); }}
                    className="w-full text-[13px] px-3 py-2 rounded-xl outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                  />
                  <div className="grid grid-cols-4 gap-1 overflow-y-auto" style={{ maxHeight: 180 }}>
                    {gifLoading
                      ? <p className="col-span-4 text-center text-[12px] py-4" style={{ color: "var(--dimmer)" }}>loading...</p>
                      : gifResults.map((g) => (
                        <button key={g.id} type="button" onClick={() => { setPendingGif(g.images.fixed_height.url); setGifPickerOpen(false); setGifSearch(""); setGifResults([]); }} className="rounded-lg overflow-hidden aspect-square">
                          <img src={g.images.fixed_height_small.url} alt="gif" className="w-full h-full object-cover" />
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
              {pendingGif && (
                <div className="px-6 pt-2 flex items-start gap-2">
                  <div className="relative">
                    <img src={pendingGif} alt="gif" className="rounded-xl" style={{ maxHeight: 100, maxWidth: 160 }} />
                    <button onClick={() => setPendingGif(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", color: "var(--muted)" }}>✕</button>
                  </div>
                </div>
              )}
              <form onSubmit={submitComment} className="flex gap-2 px-6 py-3 items-center">
                <input
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="add a comment..."
                  maxLength={500}
                  className="flex-1 text-[14px] px-4 py-3 rounded-2xl outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                />
                <button
                  type="button"
                  onClick={() => { setGifPickerOpen((v) => !v); if (!gifPickerOpen && gifResults.length === 0) searchGifs(""); }}
                  className="px-3 py-3 rounded-2xl text-[12px] font-black"
                  style={{ background: gifPickerOpen ? "var(--accent-dim)" : "rgba(255,255,255,0.05)", border: `1px solid ${gifPickerOpen ? "var(--accent-border)" : "var(--border-soft)"}`, color: gifPickerOpen ? "var(--accent)" : "var(--dimmer)" }}
                >
                  GIF
                </button>
                <button type="submit" disabled={(!commentInput.trim() && !pendingGif) || submitting} className="px-4 py-3 rounded-2xl text-[14px] font-bold text-white disabled:opacity-40" style={{ background: "var(--accent)" }}>
                  post
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Voter sheet modal */}
      {voterSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setVoterSheet(null)}>
          <div className="w-full max-w-sm rounded-t-[20px] pb-8 flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <p className="text-[14px] font-black" style={{ color: "var(--text)", fontFamily: "var(--font-nunito)" }}>voted: {voterSheet.label}</p>
              <button onClick={() => setVoterSheet(null)} className="text-[18px]" style={{ color: "var(--muted)" }}>✕</button>
            </div>
            <div className="flex flex-col divide-y overflow-y-auto" style={{ maxHeight: 360, borderColor: "rgba(255,255,255,0.04)" }}>
              {voterSheet.voters.map((e) => {
                const isFriend = followedIds.has(e.user_id);
                const isMe = e.user_id === currentUserId;
                const name = e.balances?.display_name ?? e.balances?.username ?? "someone";
                return (
                  <button key={e.user_id} onClick={() => e.balances?.username && (setVoterSheet(null), router.push(`/u/${e.balances.username}`))} className="flex items-center gap-3 px-5 py-3" style={{ cursor: e.balances?.username ? "pointer" : "default" }}>
                    <div className="rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 32, height: 32, border: `2px solid ${isMe ? "var(--accent)" : isFriend ? "var(--accent-border)" : "rgba(255,255,255,0.1)"}`, background: "var(--accent-dim)" }}>
                      {e.balances?.avatar_url
                        ? <img src={e.balances.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-[11px] font-black" style={{ color: "var(--accent)" }}>{name[0]?.toUpperCase() ?? "?"}</span>
                      }
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate" style={{ color: isMe ? "var(--accent)" : "var(--text)" }}>{isMe ? "you" : name}</p>
                      {e.balances?.username && <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>@{e.balances.username}</p>}
                    </div>
                    {isFriend && !isMe && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>following</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

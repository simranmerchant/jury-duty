"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useEffect, useState, useCallback, useRef } from "react";

type Tab = "explore" | "events" | "groups" | "past";
const TABS: { key: Tab; label: string }[] = [
  { key: "explore", label: "explore" },
  { key: "events", label: "events" },
  { key: "groups", label: "groups" },
  { key: "past", label: "past" },
];

type Bet = { id: string; status: string; visibility: string };
type Event = {
  id: string;
  name: string;
  ends_at: string | null;
  type: "event" | "group";
  host_id: string;
  invite_token: string;
  cover_url: string | null;
  bets: Bet[];
  hasNew: boolean;
  hasUnvotedOpen: boolean;
};

type ExploreBet = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  status: "open" | "resolved";
  winning_side: "a" | "b" | null;
  closes_at: string | null;
  total_pts_a: number;
  total_pts_b: number;
  total_entries: number;
  my_entry: { side: "a" | "b"; points_wagered: number } | null;
  public_posts: { id: string; user: { avatar_url: string | null; display_name: string } | null; caption: string | null }[];
  like_count: number;
  liked_by_me: boolean;
  reactions: { emoji: string; count: number }[];
  my_reaction: string | null;
  comment_count: number;
  is_mine: boolean;
  created_at: string;
};

type ExplorePoll = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  creator_id: string;
  created_at: string;
  closes_at: string | null;
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
};

type ExploreComment = {
  id: string;
  body: string | null;
  gif_url: string | null;
  created_at: string;
  user: { display_name: string; username: string; avatar_url: string | null } | null;
};

const EXPLORE_EMOJIS = ["🔥", "👀", "💀", "😂", "🤝", "🫡", "🙏"];

function ExploreCard({ bet: initialBet, getAccessToken, onDelete }: {
  bet: ExploreBet;
  getAccessToken: () => Promise<string | null>;
  onDelete: () => void;
}) {
  const [myEntry, setMyEntry] = useState(initialBet.my_entry);
  const [totalPtsA, setTotalPtsA] = useState(initialBet.total_pts_a);
  const [totalPtsB, setTotalPtsB] = useState(initialBet.total_pts_b);
  const [totalEntries, setTotalEntries] = useState(initialBet.total_entries);
  const [selectedSide, setSelectedSide] = useState<"a" | "b" | null>(null);
  const [stakeInput, setStakeInput] = useState("");
  const [placing, setPlacing] = useState(false);
  const [doubleInput, setDoubleInput] = useState("");
  const [showDoubleDown, setShowDoubleDown] = useState(false);
  const [doubling, setDoubling] = useState(false);
  const [reactions, setReactions] = useState(initialBet.reactions);
  const [myReaction, setMyReaction] = useState(initialBet.my_reaction);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ExploreComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(initialBet.comment_count);
  const [showShare, setShowShare] = useState(false);
  const [shareCaption, setShareCaption] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const total = totalPtsA + totalPtsB;
  const pctA = total > 0 ? Math.round((totalPtsA / total) * 100) : null;
  const pctB = pctA !== null ? 100 - pctA : null;

  const grouped: Record<string, number> = {};
  for (const r of reactions) grouped[r.emoji] = r.count;

  async function placeBet() {
    const pts = parseInt(stakeInput, 10);
    if (!pts || pts < 10 || placing || !selectedSide) return;
    setPlacing(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${initialBet.id}/bet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ side: selectedSide, points: pts }),
    });
    setPlacing(false);
    if (res.ok) {
      if (selectedSide === "a") setTotalPtsA((p) => p + pts);
      else setTotalPtsB((p) => p + pts);
      setMyEntry({ side: selectedSide, points_wagered: pts });
      setTotalEntries((n) => n + 1);
      setStakeInput(""); setSelectedSide(null);
    }
  }

  async function doubleDown() {
    const pts = parseInt(doubleInput, 10);
    if (!pts || pts < 10 || doubling || !myEntry) return;
    setDoubling(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${initialBet.id}/double-down`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ points: pts }),
    });
    setDoubling(false);
    if (res.ok) {
      if (myEntry.side === "a") setTotalPtsA((p) => p + pts);
      else setTotalPtsB((p) => p + pts);
      setMyEntry((e) => e ? { ...e, points_wagered: e.points_wagered + pts } : e);
      setDoubleInput(""); setShowDoubleDown(false);
    }
  }

  async function deleteBet() {
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${initialBet.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    if (res.ok) onDelete();
  }

  async function shareBet() {
    if (sharing) return;
    setSharing(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${initialBet.id}/post`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ caption: shareCaption.trim() || null }),
    });
    setSharing(false);
    if (res.ok) { setShared(true); setShowShare(false); setShareCaption(""); }
  }

  async function reportBet(reason: string) {
    setShowMenu(false); setShowReport(false);
    const token = await getAccessToken();
    await fetch("/api/v1/reports", {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reported_explore_bet_id: initialBet.id, reason }),
    });
  }

  async function toggleReaction(emoji: string) {
    setShowEmojiPicker(false);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${initialBet.id}/react`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const data = await res.json().catch(() => null);
    if (data) { setMyReaction(data.my_reaction); setReactions(data.reactions); }
  }

  async function fetchComments() {
    setCommentsLoading(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${initialBet.id}/comments`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    const data = await res.json().catch(() => ({}));
    setComments(data.comments ?? []);
    setCommentsLoading(false);
  }

  async function submitComment() {
    if (submitting || !commentInput.trim()) return;
    setSubmitting(true);
    const body = commentInput.trim();
    setCommentInput("");
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/explore-bets/${initialBet.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: body }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);
    if (data?.comment) { setComments((prev) => [...prev, data.comment]); setCommentCount((n) => n + 1); }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[16px] p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {/* Status + winning + delete */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: initialBet.status === "open" ? "var(--accent-dim)" : "rgba(255,255,255,0.05)", color: initialBet.status === "open" ? "var(--accent)" : "var(--muted)" }}>
          {initialBet.status}
        </span>
        {initialBet.status === "resolved" && initialBet.winning_side && (
          <span className="text-[12px] font-semibold" style={{ color: "var(--win)" }}>
            {initialBet.winning_side === "a" ? initialBet.option_a : initialBet.option_b} won
          </span>
        )}
      </div>
      {/* Question */}
      <p className="font-semibold text-[15px] leading-snug" style={{ color: "var(--text)" }}>{initialBet.question}</p>
      {/* Bars */}
      <div className="flex flex-col gap-1">
        {(["a", "b"] as const).map((side) => {
          const label = side === "a" ? initialBet.option_a : initialBet.option_b;
          const pct = side === "a" ? pctA : pctB;
          const pts = side === "a" ? totalPtsA : totalPtsB;
          const myPick = myEntry?.side === side;
          const isSel = selectedSide === side;
          const isResolved = initialBet.status === "resolved";
          const bc = isResolved ? (initialBet.winning_side === side ? "var(--win)" : "var(--loss)") : (myPick || isSel) ? "var(--accent)" : "var(--dimmer)";
          const canClick = initialBet.status === "open" && !myEntry;
          return (
            <div key={side}>
              <button disabled={!canClick} onClick={() => canClick && setSelectedSide(side)}
                className="w-full relative flex items-center rounded-[10px] overflow-hidden text-left"
                style={{ height: 34, border: `1px solid ${(myPick || isSel) ? "var(--accent-border)" : "var(--border)"}`, cursor: canClick ? "pointer" : "default" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct ?? 50}%`, background: bc + "28" }} />
                <span className="relative pl-3 flex-1 text-[12px] font-medium truncate" style={{ color: bc }}>{label}</span>
                <span className="relative pr-3 text-[12px] font-semibold" style={{ color: bc }}>{pct !== null ? `${pct}%` : "—"}</span>
              </button>
              <span className="text-[11px] pl-1" style={{ color: "var(--dimmer)" }}>{pts.toLocaleString()} pts</span>
            </div>
          );
        })}
      </div>

      {/* Place initial bet */}
      {initialBet.status === "open" && !myEntry && selectedSide && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2">
            {[50, 100, 200].map((v) => (
              <button key={v} onClick={() => setStakeInput(String(v))}
                className="flex-1 py-1.5 rounded-[8px] text-[12px] font-bold"
                style={{ background: stakeInput === String(v) ? "var(--accent-dim)" : "rgba(255,255,255,0.04)", border: `1px solid ${stakeInput === String(v) ? "var(--accent-border)" : "rgba(255,255,255,0.1)"}`, color: stakeInput === String(v) ? "var(--accent)" : "var(--muted)" }}>
                {v}
              </button>
            ))}
            <input
              className="flex-1 py-1.5 rounded-[8px] text-[12px] text-center outline-none font-bold"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)" }}
              placeholder="custom"
              value={[50, 100, 200].map(String).includes(stakeInput) ? "" : stakeInput}
              onChange={(e) => setStakeInput(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <button onClick={placeBet} disabled={!stakeInput || placing}
            className="w-full py-2 rounded-[10px] text-[13px] font-bold text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}>
            {placing ? "placing..." : `predict ${selectedSide === "a" ? initialBet.option_a : initialBet.option_b}`}
          </button>
        </div>
      )}

      {/* Double down */}
      {initialBet.status === "open" && myEntry && (
        <div>
          <button onClick={() => setShowDoubleDown((v) => !v)}
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
            double down · {myEntry.points_wagered.toLocaleString()} pts on {myEntry.side === "a" ? initialBet.option_a : initialBet.option_b}
          </button>
          {showDoubleDown && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex gap-2">
                {[50, 100, 200].map((v) => (
                  <button key={v} onClick={() => setDoubleInput(String(v))}
                    className="flex-1 py-1.5 rounded-[8px] text-[12px] font-bold"
                    style={{ background: doubleInput === String(v) ? "var(--accent-dim)" : "rgba(255,255,255,0.04)", border: `1px solid ${doubleInput === String(v) ? "var(--accent-border)" : "rgba(255,255,255,0.1)"}`, color: doubleInput === String(v) ? "var(--accent)" : "var(--muted)" }}>
                    {v}
                  </button>
                ))}
                <input
                  className="flex-1 py-1.5 rounded-[8px] text-[12px] text-center outline-none font-bold"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)" }}
                  placeholder="custom"
                  value={[50, 100, 200].map(String).includes(doubleInput) ? "" : doubleInput}
                  onChange={(e) => setDoubleInput(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
              <button onClick={doubleDown} disabled={!doubleInput || doubling}
                className="w-full py-2 rounded-[10px] text-[13px] font-bold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}>
                {doubling ? "adding..." : "confirm"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Meta */}
      <p className="text-[12px]" style={{ color: "var(--muted)" }}>
        {totalEntries} bet{totalEntries !== 1 ? "s" : ""} · {total.toLocaleString()} pts
        {initialBet.closes_at && initialBet.status === "open" ? ` · closes ${new Date(initialBet.closes_at).toLocaleDateString()}` : ""}
      </p>
      {/* Reactions row */}
      <div className="flex items-center gap-1.5 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {/* Left: share + ⋯ */}
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold"
          style={{ background: shared ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: shared ? "var(--win)" : "var(--muted)" }}>
          {shared ? "shared ✓" : (<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>share</>)}
        </button>
        <div className="relative">
          <button onClick={() => { setShowMenu((v) => !v); setShowReport(false); }}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[15px] font-bold leading-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted)" }}>⋯</button>
          {showMenu && (
            <div className="absolute top-full left-0 mt-1 rounded-[10px] overflow-hidden z-20"
              style={{ background: "var(--card)", border: "1px solid var(--border-soft)", minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
              {showReport ? (
                <>
                  <p className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--dimmer)" }}>report reason</p>
                  {["spam", "harassment", "inappropriate content", "other"].map((r) => (
                    <button key={r} onClick={() => reportBet(r)} className="w-full px-4 py-2.5 text-left text-[13px] font-semibold" style={{ color: "var(--text)" }}>{r}</button>
                  ))}
                </>
              ) : (
                <>
                  <button onClick={() => setShowReport(true)} className="w-full px-4 py-2.5 text-left text-[13px] font-semibold" style={{ color: "var(--text)" }}>report</button>
                  {initialBet.is_mine && (
                    <button onClick={() => { setShowMenu(false); deleteBet(); }} className="w-full px-4 py-2.5 text-left text-[13px] font-semibold" style={{ color: "var(--loss)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>delete prediction</button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {/* Right: emoji pills + ＋ + comments */}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {Object.entries(grouped).map(([emoji, count]) => {
            const isMe = myReaction === emoji;
            return (
              <button key={emoji} onClick={() => toggleReaction(emoji)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px]"
                style={{ background: isMe ? "var(--accent-dim)" : "rgba(255,255,255,0.05)", border: `1px solid ${isMe ? "var(--accent-border)" : "rgba(255,255,255,0.1)"}`, color: isMe ? "var(--accent)" : "var(--muted)" }}>
                <span>{emoji}</span><span className="font-bold text-[11px]">{count}</span>
              </button>
            );
          })}
          <div className="relative">
            <button onClick={() => setShowEmojiPicker((v) => !v)} className="px-2.5 py-1 rounded-full text-[13px] font-bold"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted)" }}>＋</button>
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 flex gap-1 p-2 rounded-[12px] z-10"
                style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                {EXPLORE_EMOJIS.map((e) => (
                  <button key={e} onClick={() => toggleReaction(e)} className="text-[18px] w-8 h-8 flex items-center justify-center rounded-[8px]" style={{ background: "rgba(255,255,255,0.05)" }}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { if (!showComments) fetchComments(); setShowComments((v) => !v); }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {commentCount > 0 ? `${commentCount}` : "comment"}
          </button>
        </div>
      </div>
      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowShare(false); setShareCaption(""); } }}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>share prediction to feed</p>
              <button onClick={() => { setShowShare(false); setShareCaption(""); }} style={{ color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>caption (optional)</label>
              <textarea
                className="w-full rounded-[12px] px-4 py-3 text-[14px] resize-none outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)", minHeight: 80 }}
                placeholder="say something about this bet..."
                value={shareCaption}
                onChange={(e) => setShareCaption(e.target.value.slice(0, 280))}
                maxLength={280}
              />
            </div>
            <button onClick={shareBet} disabled={sharing}
              className="w-full py-4 rounded-[14px] text-[15px] font-black"
              style={{ background: "var(--accent)", color: "#fff", opacity: sharing ? 0.5 : 1, fontFamily: "var(--font-nunito)" }}>
              {sharing ? "sharing…" : "share to feed"}
            </button>
          </div>
        </div>
      )}
      {/* Inline comments */}
      {showComments && (
        <div className="flex flex-col gap-3 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {commentsLoading ? (
            <p className="text-[12px] text-center py-2" style={{ color: "var(--muted)" }}>loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-[12px] text-center py-2" style={{ color: "var(--dimmer)" }}>no comments yet — be first</p>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                    style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                    {(c.user?.display_name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{c.user?.display_name ?? "someone"}</span>
                      <span className="text-[10px]" style={{ color: "var(--dimmer)" }}>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    {c.body && <p className="text-[13px] mt-0.5 leading-snug" style={{ color: "var(--text)" }}>{c.body}</p>}
                    {c.gif_url && <img src={c.gif_url} alt="" className="mt-1 rounded-[8px]" style={{ maxWidth: 160, height: 100, objectFit: "cover" }} />}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-[10px] px-3 py-2 text-[13px] outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)" }}
              placeholder="add a comment..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
            />
            <button onClick={submitComment} disabled={!commentInput.trim() || submitting}
              className="px-3 py-2 rounded-[10px] text-[13px] font-bold text-white disabled:opacity-40"
              style={{ background: "var(--accent)" }}>
              {submitting ? "..." : "post"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExplorePollCard({ poll: initialPoll, getAccessToken, onDelete }: {
  poll: ExplorePoll;
  getAccessToken: () => Promise<string | null>;
  onDelete: () => void;
}) {
  const [votesA, setVotesA] = useState(initialPoll.votes_a);
  const [votesB, setVotesB] = useState(initialPoll.votes_b);
  const [myVote, setMyVote] = useState<"a" | "b" | null>(initialPoll.my_vote);
  const [reactions, setReactions] = useState(initialPoll.reactions);
  const [myReaction, setMyReaction] = useState(initialPoll.my_reaction);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ExploreComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(initialPoll.comment_count);
  const [showShare, setShowShare] = useState(false);
  const [shareCaption, setShareCaption] = useState("");
  const [sharePhoto, setSharePhoto] = useState<File | null>(null);
  const [sharePhotoPreview, setSharePhotoPreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const sharePhotoInputRef = useRef<HTMLInputElement>(null);
  const [shareMode, setShareMode] = useState<"followers" | "specific">("followers");
  const [targetUsers, setTargetUsers] = useState<{ user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }[]>([]);
  const [userSearchQ, setUserSearchQ] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<{ user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }[]>([]);
  const userSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const totalVotes = votesA + votesB;
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : null;
  const pctB = pctA !== null ? 100 - pctA : null;
  const grouped: Record<string, number> = {};
  for (const r of reactions) grouped[r.emoji] = r.count;

  async function castVote(side: "a" | "b") {
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/polls/${initialPoll.id}/vote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ side }),
    });
    const data = await res.json().catch(() => null);
    if (data) { setVotesA(data.votes_a); setVotesB(data.votes_b); setMyVote(data.side); }
  }

  async function toggleReaction(emoji: string) {
    setShowEmojiPicker(false);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/polls/${initialPoll.id}/react`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const data = await res.json().catch(() => null);
    if (data) { setMyReaction(data.my_reaction); setReactions(data.reactions); }
  }

  async function fetchComments() {
    setCommentsLoading(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/polls/${initialPoll.id}/comments`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    const data = await res.json().catch(() => ({}));
    setComments(data.comments ?? []);
    setCommentsLoading(false);
  }

  async function submitComment() {
    if (submitting || !commentInput.trim()) return;
    setSubmitting(true);
    const body = commentInput.trim();
    setCommentInput("");
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/polls/${initialPoll.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: body }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);
    if (data?.comment) { setComments((prev) => [...prev, data.comment]); setCommentCount((n) => n + 1); }
  }

  async function deletePoll() {
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/polls/${initialPoll.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    if (res.ok) onDelete();
  }

  async function reportPoll(reason: string) {
    setShowMenu(false); setShowReport(false);
    const token = await getAccessToken();
    await fetch("/api/v1/reports", {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reported_poll_id: initialPoll.id, reason }),
    });
  }

  async function searchUsers(q: string) {
    setUserSearchQ(q);
    if (userSearchTimer.current) clearTimeout(userSearchTimer.current);
    if (!q.trim()) { setUserSearchResults([]); return; }
    userSearchTimer.current = setTimeout(async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/v1/users/search?q=${encodeURIComponent(q.trim())}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      const data = await res.json().catch(() => ({}));
      setUserSearchResults(data.users ?? []);
    }, 300);
  }

  async function sharePoll() {
    if (sharing) return;
    setSharing(true);
    const token = await getAccessToken();
    let photo_url: string | null = null;
    if (sharePhoto) {
      const fd = new FormData(); fd.append("file", sharePhoto);
      const up = await fetch("/api/v1/posts/upload", { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` }, body: fd });
      const ud = await up.json().catch(() => null);
      if (!up.ok || !ud?.url) { setSharing(false); return; }
      photo_url = ud.url;
    }
    const res = await fetch(`/api/v1/polls/${initialPoll.id}/post`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: shareCaption.trim() || null,
        photo_url,
        targeted_user_ids: shareMode === "specific" && targetUsers.length > 0 ? targetUsers.map((u) => u.user_id) : undefined,
      }),
    });
    setSharing(false);
    if (res.ok) {
      setShared(true); setShowShare(false);
      setShareCaption(""); setSharePhoto(null); setSharePhotoPreview(null);
      setShareMode("followers"); setTargetUsers([]); setUserSearchQ(""); setUserSearchResults([]);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[16px] p-4" style={{ background: "var(--card)", border: "1px solid var(--purple-border)" }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: "var(--purple-dim)", color: "var(--purple)", border: "1px solid var(--purple-border)" }}>
          poll
        </span>
        {initialPoll.closes_at && new Date(initialPoll.closes_at) > new Date() && (
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>closes {new Date(initialPoll.closes_at).toLocaleDateString()}</span>
        )}
      </div>
      {/* Question */}
      <p className="font-semibold text-[15px] leading-snug" style={{ color: "var(--text)" }}>{initialPoll.question}</p>
      {/* Vote bars */}
      <div className="flex flex-col gap-1.5">
        {(["a", "b"] as const).map((side) => {
          const label = side === "a" ? initialPoll.option_a : initialPoll.option_b;
          const pct = side === "a" ? pctA : pctB;
          const isMyVote = myVote === side;
          return (
            <button key={side} onClick={() => castVote(side)}
              className="relative flex items-center rounded-[10px] overflow-hidden text-left"
              style={{ height: 34, border: `1px solid ${isMyVote ? "var(--purple-border)" : "var(--border)"}` }}>
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct ?? 50}%`, background: (isMyVote ? "var(--purple)" : "var(--dimmer)") + "28" }} />
              <span className="relative pl-3 flex-1 text-[12px] font-medium truncate" style={{ color: isMyVote ? "var(--purple)" : "var(--text)" }}>{label}</span>
              <span className="relative pr-3 text-[12px] font-semibold" style={{ color: isMyVote ? "var(--purple)" : "var(--muted)" }}>{pct !== null ? `${pct}%` : "—"}</span>
            </button>
          );
        })}
      </div>
      {/* Meta */}
      <p className="text-[12px]" style={{ color: "var(--muted)" }}>
        {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        {myVote ? ` · you voted ${myVote === "a" ? initialPoll.option_a : initialPoll.option_b}` : " · click to vote"}
      </p>
      {/* Reactions row */}
      <div className="flex items-center gap-1.5 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {/* Left: share + ⋯ */}
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold"
          style={{ background: shared ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: shared ? "var(--win)" : "var(--muted)" }}>
          {shared ? (
            "shared ✓"
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              share
            </>
          )}
        </button>
        <div className="relative">
          <button onClick={() => { setShowMenu((v) => !v); setShowReport(false); }}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[15px] font-bold leading-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted)" }}>⋯</button>
          {showMenu && (
            <div className="absolute top-full left-0 mt-1 rounded-[10px] overflow-hidden z-20"
              style={{ background: "var(--card)", border: "1px solid var(--border-soft)", minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
              {showReport ? (
                <>
                  <p className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--dimmer)" }}>report reason</p>
                  {["spam", "harassment", "inappropriate content", "other"].map((r) => (
                    <button key={r} onClick={() => reportPoll(r)}
                      className="w-full px-4 py-2.5 text-left text-[13px] font-semibold"
                      style={{ color: "var(--text)" }}>{r}</button>
                  ))}
                </>
              ) : (
                <>
                  <button onClick={() => setShowReport(true)}
                    className="w-full px-4 py-2.5 text-left text-[13px] font-semibold"
                    style={{ color: "var(--text)" }}>report</button>
                  {initialPoll.is_mine && (
                    <button onClick={() => { setShowMenu(false); deletePoll(); }}
                      className="w-full px-4 py-2.5 text-left text-[13px] font-semibold"
                      style={{ color: "var(--loss)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>delete poll</button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {/* Right: emoji pills + ＋ + comments */}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {Object.entries(grouped).map(([emoji, count]) => {
            const isMe = myReaction === emoji;
            return (
              <button key={emoji} onClick={() => toggleReaction(emoji)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px]"
                style={{ background: isMe ? "var(--accent-dim)" : "rgba(255,255,255,0.05)", border: `1px solid ${isMe ? "var(--accent-border)" : "rgba(255,255,255,0.1)"}`, color: isMe ? "var(--accent)" : "var(--muted)" }}>
                <span>{emoji}</span>
                <span className="font-bold text-[11px]">{count}</span>
              </button>
            );
          })}
          <div className="relative">
            <button onClick={() => setShowEmojiPicker((v) => !v)} className="px-2.5 py-1 rounded-full text-[13px] font-bold"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted)" }}>
              ＋
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 flex gap-1 p-2 rounded-[12px] z-10"
                style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                {EXPLORE_EMOJIS.map((e) => (
                  <button key={e} onClick={() => toggleReaction(e)}
                    className="text-[18px] w-8 h-8 flex items-center justify-center rounded-[8px]"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { if (!showComments) fetchComments(); setShowComments((v) => !v); }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {commentCount > 0 ? commentCount : "comment"}
          </button>
        </div>
      </div>
      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowShare(false); setShareCaption(""); setSharePhoto(null); setSharePhotoPreview(null); setShareMode("followers"); setTargetUsers([]); setUserSearchQ(""); setUserSearchResults([]); } }}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>share poll to feed</p>
              <button onClick={() => { setShowShare(false); setShareCaption(""); setSharePhoto(null); setSharePhotoPreview(null); setShareMode("followers"); setTargetUsers([]); setUserSearchQ(""); setUserSearchResults([]); }} style={{ color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Audience toggle */}
            <div className="flex rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-soft)" }}>
              {(["followers", "specific"] as const).map((mode) => (
                <button key={mode} onClick={() => setShareMode(mode)}
                  className="flex-1 py-2.5 text-[13px] font-bold"
                  style={{ background: shareMode === mode ? "var(--accent-dim)" : "transparent", color: shareMode === mode ? "var(--accent)" : "var(--muted)" }}>
                  {mode === "followers" ? "all followers" : "specific people"}
                </button>
              ))}
            </div>
            {shareMode === "specific" && (
              <div className="flex flex-col gap-2">
                {targetUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {targetUsers.map((u) => (
                      <button key={u.user_id} onClick={() => setTargetUsers((prev) => prev.filter((t) => t.user_id !== u.user_id))}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold"
                        style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                        {u.display_name ?? u.username ?? "user"} ✕
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    className="w-full rounded-2xl px-4 py-3 text-[14px] outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                    placeholder="search by name or @username..."
                    value={userSearchQ}
                    onChange={(e) => searchUsers(e.target.value)}
                  />
                  {userSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-[12px] overflow-hidden z-10 flex flex-col"
                      style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: 200, overflowY: "auto" }}>
                      {userSearchResults.filter((u) => !targetUsers.some((t) => t.user_id === u.user_id)).slice(0, 8).map((u) => (
                        <button key={u.user_id} type="button"
                          className="flex items-center gap-2.5 px-3 py-2.5 text-left"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                          onMouseDown={(e) => { e.preventDefault(); setTargetUsers((prev) => [...prev, u]); setUserSearchQ(""); setUserSearchResults([]); }}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black overflow-hidden flex-shrink-0" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                            {u.avatar_url ? <img src={u.avatar_url} className="w-7 h-7 object-cover" alt="" /> : (u.display_name?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{u.display_name ?? u.username}</p>
                            {u.username && <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>@{u.username}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>caption (optional)</label>
              <textarea
                className="w-full rounded-[12px] px-4 py-3 text-[14px] resize-none outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)", minHeight: 80 }}
                placeholder="say something about this poll..."
                value={shareCaption}
                onChange={(e) => setShareCaption(e.target.value.slice(0, 280))}
                maxLength={280}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>photo (optional)</label>
              {sharePhotoPreview ? (
                <div className="relative">
                  <img src={sharePhotoPreview} alt="" className="w-full rounded-[12px] object-cover" style={{ maxHeight: 200 }} />
                  <button onClick={() => { setSharePhoto(null); setSharePhotoPreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold"
                    style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}>✕</button>
                </div>
              ) : (
                <button onClick={() => sharePhotoInputRef.current?.click()}
                  className="w-full py-3 rounded-[12px] text-[13px] font-semibold"
                  style={{ border: "1px dashed var(--border-soft)", color: "var(--muted)", background: "rgba(255,255,255,0.02)" }}>
                  + add photo
                </button>
              )}
              <input ref={sharePhotoInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setSharePhoto(f); setSharePhotoPreview(URL.createObjectURL(f)); e.target.value = ""; }} />
            </div>
            <button onClick={sharePoll} disabled={sharing || (shareMode === "specific" && targetUsers.length === 0)}
              className="w-full py-4 rounded-[14px] text-[15px] font-black"
              style={{ background: "var(--purple)", color: "#fff", opacity: sharing || (shareMode === "specific" && targetUsers.length === 0) ? 0.5 : 1, fontFamily: "var(--font-nunito)" }}>
              {sharing ? "sharing…" : shareMode === "specific" ? `share to ${targetUsers.length} ${targetUsers.length === 1 ? "person" : "people"}` : "share to feed"}
            </button>
          </div>
        </div>
      )}
      {/* Inline comments */}
      {showComments && (
        <div className="flex flex-col gap-3 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {commentsLoading ? (
            <p className="text-[12px] text-center py-2" style={{ color: "var(--muted)" }}>loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-[12px] text-center py-2" style={{ color: "var(--dimmer)" }}>no comments yet — be first</p>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                    style={{ background: "var(--purple-dim)", color: "var(--purple)", border: "1px solid var(--purple-border)" }}>
                    {(c.user?.display_name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{c.user?.display_name ?? "someone"}</span>
                      <span className="text-[10px]" style={{ color: "var(--dimmer)" }}>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    {c.body && <p className="text-[13px] mt-0.5 leading-snug" style={{ color: "var(--text)" }}>{c.body}</p>}
                    {c.gif_url && <img src={c.gif_url} alt="" className="mt-1 rounded-[8px]" style={{ maxWidth: 160, height: 100, objectFit: "cover" }} />}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-[10px] px-3 py-2 text-[13px] outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)" }}
              placeholder="add a comment..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
            />
            <button onClick={submitComment} disabled={!commentInput.trim() || submitting}
              className="px-3 py-2 rounded-[10px] text-[13px] font-bold text-white disabled:opacity-40"
              style={{ background: "var(--purple)" }}>
              {submitting ? "..." : "post"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventsPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [exploreBets, setExploreBets] = useState<ExploreBet[]>([]);
  const [explorePolls, setExplorePolls] = useState<ExplorePoll[]>([]);
  const [showExploreCreate, setShowExploreCreate] = useState(false);
  const [exploreCreateType, setExploreCreateType] = useState<"bet" | "poll">("bet");
  const [exploreQ, setExploreQ] = useState("");
  const [exploreOptA, setExploreOptA] = useState("");
  const [exploreOptB, setExploreOptB] = useState("");
  const [exploreCreating, setExploreCreating] = useState(false);
  const [exploreErr, setExploreErr] = useState<string | null>(null);
  const [exploreDeadline, setExploreDeadline] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("explore");
  const touchStartX = useRef<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [name, setName] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [createType, setCreateType] = useState<"event" | "group">("event");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function getSeenIds(): Set<string> {
    try { return new Set(JSON.parse(sessionStorage.getItem("seenEventIds") ?? "[]")); } catch { return new Set(); }
  }
  function markSeen(id: string) {
    try {
      const ids = getSeenIds();
      ids.add(id);
      sessionStorage.setItem("seenEventIds", JSON.stringify([...ids]));
    } catch {}
  }

  const fetchEvents = useCallback(async () => {
    const token = await getAccessToken();
    const [eventsRes, exploreRes, pollsRes] = await Promise.all([
      fetch("/api/v1/events", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/v1/explore-bets", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/v1/polls", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const eventsData = await eventsRes.json();
    const exploreData = await exploreRes.json().catch(() => ({}));
    const pollsData = await pollsRes.json().catch(() => ({}));
    const seenIds = getSeenIds();
    const rawEvents: Event[] = eventsData.events ?? [];
    setEvents(rawEvents.map((e) => seenIds.has(e.id) ? { ...e, hasNew: false } : e));
    setExploreBets(exploreData.bets ?? []);
    setExplorePolls(pollsData.polls ?? []);
  }, [getAccessToken]);

  function resetExploreCreate() {
    setExploreQ(""); setExploreOptA(""); setExploreOptB(""); setExploreDeadline(""); setExploreErr(null); setExploreCreateType("bet");
  }

  async function createExploreItem() {
    if (!exploreQ.trim() || !exploreOptA.trim() || !exploreOptB.trim()) {
      setExploreErr("fill in all fields");
      return;
    }
    setExploreErr(null);
    setExploreCreating(true);
    const token = await getAccessToken();
    const endpoint = exploreCreateType === "poll" ? "/api/v1/polls" : "/api/v1/explore-bets";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question: exploreQ.trim(), option_a: exploreOptA.trim(), option_b: exploreOptB.trim(), closes_at: exploreDeadline ? new Date(exploreDeadline).toISOString() : null }),
    });
    setExploreCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setExploreErr(data.error ?? "something went wrong");
      return;
    }
    resetExploreCreate();
    setShowExploreCreate(false);
    fetchEvents();
  }

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    fetchEvents();
  }, [ready, authenticated, router, fetchEvents]);

  // Re-fetch when the tab regains focus so hasNew clears after visiting an event
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && authenticated) fetchEvents();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [authenticated, fetchEvents]);

  async function createEvent() {
    if (!name.trim()) return;
    if (createType === "event" && !endsAt) return;
    if (createType === "event" && new Date(endsAt) <= new Date()) {
      setCreateError("end date must be in the future");
      return;
    }
    setCreateError(null);
    setCreating(true);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: createType, ...(createType === "event" ? { ends_at: new Date(endsAt).toISOString() } : {}) }),
    });
    if (!res.ok) {
      const data = await res.json();
      setCreateError(data.error ?? "something went wrong");
      setCreating(false);
      return;
    }
    setName(""); setEndsAt(""); setShowCreate(false); setCreating(false); setCreateType("event"); setCreateError(null);
    fetchEvents();
  }


  if (!ready) return null;

  const now = new Date();
  const activeEventsList = events
    .filter((e) => e.type !== "group" && e.ends_at && new Date(e.ends_at) >= now)
    .sort((a, b) => new Date(a.ends_at!).getTime() - new Date(b.ends_at!).getTime());
  const pastEventsList = events
    .filter((e) => e.type !== "group" && (!e.ends_at || new Date(e.ends_at) < now))
    .sort((a, b) => new Date(b.ends_at ?? 0).getTime() - new Date(a.ends_at ?? 0).getTime());
  const groups = events.filter((e) => e.type === "group");
  const featured = activeEventsList[0] ?? null;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) < 50) return;
    const idx = TABS.findIndex((t) => t.key === activeTab);
    if (diff > 0 && idx < TABS.length - 1) setActiveTab(TABS[idx + 1].key);
    if (diff < 0 && idx > 0) setActiveTab(TABS[idx - 1].key);
  }

  function EventRow({ event }: { event: Event }) {
    const totalBets = event.bets?.length ?? 0;
    const isGroup = event.type === "group";
    const isPast = !isGroup && event.ends_at && new Date(event.ends_at) < now;
    return (
      <button
        onClick={() => {
          markSeen(event.id);
          if (event.hasNew) setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, hasNew: false } : e));
          router.push(`/e/${event.id}`);
        }}
        className="w-full text-left flex items-center gap-3 px-3 py-[11px] rounded-[10px]"
        style={{
          background: "var(--card)",
          border: `1px solid var(--border)`,
          borderLeft: isGroup ? "2px solid var(--purple-border)" : "1px solid var(--border)",
          opacity: 1,
        }}
      >
        {/* Thumb */}
        <div className="flex-shrink-0 rounded-[8px] overflow-hidden flex items-center justify-center text-[18px]"
          style={{ width: 42, height: 42, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          {event.cover_url
            ? <img src={event.cover_url} alt="" className="w-full h-full object-cover" />
            : <span>🎲</span>
          }
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-[14px] leading-tight truncate" style={{ fontFamily: "var(--font-nunito)", letterSpacing: "-0.01em" }}>
            {event.name}
          </p>
          <p className="text-[11px] mt-0.5 italic" style={{ color: "var(--muted)" }}>
            {isGroup ? "ongoing" : isPast ? "ended" : event.ends_at
              ? new Date(event.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : ""}
            {totalBets > 0 ? ` · ${totalBets} prediction${totalBets !== 1 ? "s" : ""}` : " · no predictions"}
          </p>
        </div>
        {/* Right */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isGroup && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px]"
              style={{ background: "var(--purple-dim)", color: "var(--purple)", border: "1px solid var(--purple-border)", letterSpacing: "0.04em" }}>
              group
            </span>
          )}
          {!isPast && (
            <div className="flex items-center gap-1">
              {!isGroup && event.hasNew && <span className="text-[10px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.02em" }}>new</span>}
              {event.hasUnvotedOpen && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#f97316" }} />}
            </div>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div className="px-5 pt-14 pb-3 flex items-center justify-between">
        <h1 className="font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)", fontSize: 27, letterSpacing: "-0.035em", lineHeight: 1 }}>
          <span style={{ color: "var(--text)" }}>jury</span>
          <span style={{ color: "var(--dimmer)", fontWeight: 800 }}>·</span>
          <span style={{ color: "var(--accent)", fontStyle: "italic" }}>duty</span>
        </h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 px-4 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="px-4 py-1.5 rounded-full text-[13px] font-bold"
            style={{
              background: activeTab === t.key ? "var(--accent-dim)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${activeTab === t.key ? "var(--accent-border)" : "rgba(255,255,255,0.06)"}`,
              color: activeTab === t.key ? "var(--accent)" : "var(--muted)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pb-36 px-4 flex flex-col gap-2">
        {/* Events tab */}
        {activeTab === "events" && (
          <>
            {featured && (
              <>
                <p className="text-[10px] font-semibold px-1 pt-1" style={{ color: "var(--dimmer)", letterSpacing: "0.14em", textTransform: "uppercase" }}>next up</p>
                <button
                  onClick={() => {
                    markSeen(featured.id);
                    if (featured.hasNew) setEvents((prev) => prev.map((e) => e.id === featured.id ? { ...e, hasNew: false } : e));
                    router.push(`/e/${featured.id}`);
                  }}
                  className="w-full text-left rounded-[14px] overflow-hidden relative"
                  style={{ height: 128, border: "1px solid rgba(255,143,163,0.12)" }}
                >
                  {featured.cover_url ? (
                    <img src={featured.cover_url} alt="" className="w-full h-full object-cover absolute inset-0" style={{ filter: "brightness(0.5) saturate(0.75)" }} />
                  ) : (
                    <div className="absolute inset-0" style={{ background: "var(--card)" }} />
                  )}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,143,163,0.18) 0%, transparent 55%), linear-gradient(to top, rgba(16,14,12,0.75) 0%, transparent 60%)" }} />
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {featured.hasNew && (
                      <span className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full" style={{ background: "var(--accent)" }}>new</span>
                    )}
                    {featured.hasUnvotedOpen && (
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f97316" }} />
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3.5">
                    <p className="font-black text-[19px] text-white leading-tight" style={{ fontFamily: "var(--font-nunito)", letterSpacing: "-0.02em" }}>{featured.name}</p>
                    <p className="text-[11px] mt-0.5 italic" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {featured.ends_at ? new Date(featured.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                      {(featured.bets?.length ?? 0) > 0 ? ` · ${featured.bets.length} prediction${featured.bets.length !== 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                </button>
                {activeEventsList.slice(1).length > 0 && <p className="text-[10px] font-semibold px-1 pt-2" style={{ color: "var(--dimmer)", letterSpacing: "0.14em", textTransform: "uppercase" }}>all events</p>}
              </>
            )}
            {activeEventsList.slice(featured ? 1 : 0).map((e) => <EventRow key={e.id} event={e} />)}
            {activeEventsList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <p className="text-[15px] font-semibold italic" style={{ color: "var(--muted)" }}>no active events</p>
                <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>tap + new to create one</p>
              </div>
            )}
          </>
        )}

        {/* Groups tab */}
        {activeTab === "groups" && (
          <>
            {groups.map((e) => <EventRow key={e.id} event={e} />)}
            {groups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <p className="text-[15px] font-semibold italic" style={{ color: "var(--muted)" }}>no groups yet</p>
                <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>groups are ongoing — each prediction has its own deadline</p>
              </div>
            )}
          </>
        )}

        {/* Past tab */}
        {activeTab === "past" && (
          <>
            {pastEventsList.map((e) => <EventRow key={e.id} event={e} />)}
            {pastEventsList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <p className="text-[15px] font-semibold italic" style={{ color: "var(--muted)" }}>no past events</p>
                <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>completed events show up here</p>
              </div>
            )}
          </>
        )}

        {/* Explore tab */}
        {activeTab === "explore" && (() => {
          const items = [
            ...exploreBets.map((b) => ({ kind: "bet" as const, id: b.id, created_at: b.created_at, data: b })),
            ...explorePolls.map((p) => ({ kind: "poll" as const, id: p.id, created_at: p.created_at, data: p })),
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return (
            <>
              {items.map((item) =>
                item.kind === "bet"
                  ? <ExploreCard key={`bet-${item.id}`} bet={item.data} getAccessToken={getAccessToken} onDelete={() => setExploreBets((prev) => prev.filter((b) => b.id !== item.id))} />
                  : <ExplorePollCard key={`poll-${item.id}`} poll={item.data} getAccessToken={getAccessToken} onDelete={() => setExplorePolls((prev) => prev.filter((p) => p.id !== item.id))} />
              )}
              {items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <p className="text-[15px] font-semibold italic" style={{ color: "var(--muted)" }}>nothing here yet</p>
                  <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>tap + new to post a prediction or poll</p>
                </div>
              )}
            </>
          );
        })()}

      </div>

      {/* Floating action buttons */}
      <div className="fixed bottom-0 left-0 right-0 flex gap-2.5 px-4 pb-[76px] pt-3" style={{ zIndex: 10, background: "linear-gradient(to top, var(--bg) 65%, transparent 100%)" }}>
        {activeTab !== "explore" && (
          <button
            onClick={() => setShowJoin(true)}
            className="flex-1 py-3.5 rounded-[12px] font-semibold text-[14px]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            join
          </button>
        )}
        <button
          onClick={() => activeTab === "explore" ? setShowExploreCreate(true) : setShowCreate(true)}
          className="flex-[2] py-3.5 rounded-[12px] font-black text-[15px] text-white"
          style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)", letterSpacing: "-0.01em" }}
        >
          + new
        </button>
      </div>

      {/* Create modal — full screen */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto" style={{ background: "var(--bg)", color: "var(--text)" }}>
          <div className="px-5 pt-14 pb-2">
            <button
              onClick={() => { setShowCreate(false); setCreateType("event"); setCreateError(null); setName(""); setEndsAt(""); }}
              className="text-sm mb-5 flex items-center gap-1"
              style={{ color: "var(--muted)" }}
            >
              ← back
            </button>
            <h1 className="text-[28px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
              new {createType}
            </h1>
          </div>

          <div className="px-5 pt-4 pb-32 flex flex-col gap-6">
            {/* Type toggle */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {(["event", "group"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCreateType(t)}
                    className="flex-1 py-2.5 rounded-2xl font-bold text-[14px]"
                    style={{
                      background: createType === t ? "var(--accent-dim)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${createType === t ? "var(--accent-border)" : "var(--border-soft)"}`,
                      color: createType === t ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[12px]" style={{ color: "var(--dimmer)" }}>
                {createType === "event"
                  ? "time-boxed — predictions close when the event ends"
                  : "ongoing — each prediction has its own deadline"}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>name</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                placeholder={createType === "event" ? "Ava's Birthday" : "The Squad"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {createType === "event" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>closes at</label>
                <input
                  type="datetime-local"
                  className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            )}

            {createError && (
              <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{createError}</p>
            )}

            <button
              onClick={createEvent}
              disabled={creating || !name.trim() || (createType === "event" && !endsAt)}
              className="w-full py-4 rounded-2xl font-black text-[16px] text-white disabled:opacity-40"
              style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              {creating ? "creating..." : `create ${createType}`}
            </button>
          </div>
        </div>
      )}

      {/* Explore create modal */}
      {showExploreCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowExploreCreate(false); resetExploreCreate(); } }}
        >
          <div className="w-full max-w-lg rounded-t-[20px] p-6 flex flex-col gap-4"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5 p-1 rounded-[12px]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {([{ value: "bet", label: "prediction" }, { value: "poll", label: "poll" }] as const).map(({ value, label }) => (
                  <button key={value} onClick={() => setExploreCreateType(value)}
                    className="px-4 py-1.5 rounded-[8px] text-[13px] font-bold transition-colors"
                    style={{
                      background: exploreCreateType === value ? (value === "poll" ? "var(--purple-dim)" : "var(--accent-dim)") : "transparent",
                      color: exploreCreateType === value ? (value === "poll" ? "var(--purple)" : "var(--accent)") : "var(--muted)",
                      border: exploreCreateType === value ? `1px solid ${value === "poll" ? "var(--purple-border)" : "var(--accent-border)"}` : "1px solid transparent",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowExploreCreate(false); resetExploreCreate(); }} style={{ color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              {exploreCreateType === "poll" ? "no points — anyone can vote, no resolution" : "stake points — open to everyone on explore"}
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>question</label>
              <textarea
                className="w-full rounded-[12px] px-4 py-3 text-[14px] resize-none outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)", minHeight: 72 }}
                placeholder={exploreCreateType === "poll" ? "e.g. Will Taylor Swift release a new album this year?" : "e.g. Will it snow in NYC this winter?"}
                value={exploreQ}
                onChange={(e) => setExploreQ(e.target.value.slice(0, 200))}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>option A</label>
                <input className="rounded-[12px] px-3 py-2.5 text-[14px] outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                  placeholder="Yes" value={exploreOptA} onChange={(e) => setExploreOptA(e.target.value.slice(0, 80))} maxLength={80} />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>option B</label>
                <input className="rounded-[12px] px-3 py-2.5 text-[14px] outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                  placeholder="No" value={exploreOptB} onChange={(e) => setExploreOptB(e.target.value.slice(0, 80))} maxLength={80} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>deadline (optional)</label>
              <input
                type="datetime-local"
                className="rounded-[12px] px-3 py-2.5 text-[14px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)", colorScheme: "dark" }}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                value={exploreDeadline}
                onChange={(e) => setExploreDeadline(e.target.value)}
              />
            </div>
            {exploreErr && <p className="text-[13px]" style={{ color: "var(--loss)" }}>{exploreErr}</p>}
            <button
              onClick={createExploreItem}
              disabled={exploreCreating || !exploreQ.trim() || !exploreOptA.trim() || !exploreOptB.trim()}
              className="w-full py-3 rounded-[12px] font-bold text-[15px] text-white transition-opacity disabled:opacity-40"
              style={{ background: exploreCreateType === "poll" ? "var(--purple)" : "var(--accent)" }}
            >
              {exploreCreating ? "posting…" : `post ${exploreCreateType === "bet" ? "prediction" : "poll"}`}
            </button>
          </div>
        </div>
      )}

      {/* Join modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-t-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="w-9 h-1 rounded-full mx-auto mb-1" style={{ background: "var(--border)" }} />
            <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-nunito)" }}>Join</h2>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>Paste invite link or code</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                placeholder="juryduty.xyz/join/... or paste code"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-1">
              <button onClick={() => { setShowJoin(false); setJoinInput(""); }} className="flex-1 py-3.5 rounded-2xl font-bold text-[15px]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>
                Cancel
              </button>
              <button
                disabled={!joinInput.trim()}
                onClick={() => {
                  const input = joinInput.trim();
                  const match = input.match(/\/join\/([^/?#]+)/);
                  const token = match ? match[1] : input;
                  setShowJoin(false); setJoinInput("");
                  router.push(`/join/${token}`);
                }}
                className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40"
                style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}

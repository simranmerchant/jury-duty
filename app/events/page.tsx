"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useEffect, useState, useCallback, useRef } from "react";

type Tab = "events" | "groups" | "past" | "explore";
const TABS: { key: Tab; label: string }[] = [
  { key: "events", label: "events" },
  { key: "groups", label: "groups" },
  { key: "past", label: "past" },
  { key: "explore", label: "explore" },
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

type PostComment = {
  id: string;
  body?: string | null;
  created_at: string;
  user_id: string;
  balances?: { display_name: string | null; avatar_url: string | null; username?: string | null } | null;
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
  is_mine: boolean;
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
  my_post: { caption: string | null; photo_url: string | null } | null;
  followed_votes: { user_id: string; side: "a" | "b"; voter: { display_name: string; username: string; avatar_url: string | null } | null }[];
  other_vote_count: number;
};

const EMOJIS = ["🔥", "😂", "😮", "❤️", "👏"] as const;

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

export default function EventsPage() {
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const touchStartX = useRef<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [name, setName] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [createType, setCreateType] = useState<"event" | "group">("event");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Explore state
  const [exploreSubTab, setExploreSubTab] = useState<"bets" | "polls">("bets");
  const [bets, setBets] = useState<ExploreBet[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [exploreLoaded, setExploreLoaded] = useState(false);
  const [myPoints, setMyPoints] = useState<number | null>(null);
  const [showCreateExplore, setShowCreateExplore] = useState(false);
  const [createExploreType, setCreateExploreType] = useState<"prediction" | "poll">("prediction");
  const [createQuestion, setCreateQuestion] = useState("");
  const [createOptionA, setCreateOptionA] = useState("");
  const [createOptionB, setCreateOptionB] = useState("");
  const [createClosesAt, setCreateClosesAt] = useState("");
  const [creatingExplore, setCreatingExplore] = useState(false);
  const [createExploreError, setCreateExploreError] = useState<string | null>(null);

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
    const eventsRes = await fetch("/api/v1/events", { headers: { Authorization: `Bearer ${token}` } });
    const eventsData = await eventsRes.json();
    const seenIds = getSeenIds();
    const rawEvents: Event[] = eventsData.events ?? [];
    setEvents(rawEvents.map((e) => seenIds.has(e.id) ? { ...e, hasNew: false } : e));
  }, [getAccessToken]);

  const loadExplore = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const [betsRes, pollsRes, meRes] = await Promise.all([
      fetch("/api/v1/explore-bets", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/v1/polls", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/v1/me", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (betsRes.ok) { const d = await betsRes.json(); setBets(d.bets ?? []); }
    if (pollsRes.ok) { const d = await pollsRes.json(); setPolls(d.polls ?? []); }
    if (meRes.ok) { const d = await meRes.json(); setMyPoints(d.points ?? null); }
    setExploreLoaded(true);
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    fetchEvents();
  }, [ready, authenticated, router, fetchEvents]);

  useEffect(() => {
    if (activeTab === "explore" && !exploreLoaded && authenticated) {
      loadExplore();
    }
  }, [activeTab, exploreLoaded, authenticated, loadExplore]);

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

  async function createExploreBet() {
    if (!createQuestion.trim() || !createOptionA.trim() || !createOptionB.trim()) return;
    setCreatingExplore(true);
    setCreateExploreError(null);
    const token = await getAccessToken();
    const body: Record<string, unknown> = {
      question: createQuestion.trim(),
      option_a: createOptionA.trim(),
      option_b: createOptionB.trim(),
    };
    if (createClosesAt) body.closes_at = new Date(createClosesAt).toISOString();
    const res = await fetch("/api/v1/explore-bets", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setCreateExploreError(d.error ?? "something went wrong");
      setCreatingExplore(false);
      return;
    }
    setCreateQuestion(""); setCreateOptionA(""); setCreateOptionB(""); setCreateClosesAt("");
    setShowCreateExplore(false);
    setCreatingExplore(false);
    setExploreLoaded(false);
    loadExplore();
  }

  async function createExplorePoll() {
    if (!createQuestion.trim() || !createOptionA.trim() || !createOptionB.trim()) return;
    setCreatingExplore(true);
    setCreateExploreError(null);
    const token = await getAccessToken();
    const body: Record<string, unknown> = {
      question: createQuestion.trim(),
      option_a: createOptionA.trim(),
      option_b: createOptionB.trim(),
    };
    if (createClosesAt) body.closes_at = new Date(createClosesAt).toISOString();
    const res = await fetch("/api/v1/polls", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setCreateExploreError(d.error ?? "something went wrong");
      setCreatingExplore(false);
      return;
    }
    setCreateQuestion(""); setCreateOptionA(""); setCreateOptionB(""); setCreateClosesAt("");
    setShowCreateExplore(false);
    setCreatingExplore(false);
    setExploreLoaded(false);
    loadExplore();
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
        <div className="flex-shrink-0 rounded-[8px] overflow-hidden flex items-center justify-center text-[18px]"
          style={{ width: 42, height: 42, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          {event.cover_url
            ? <img src={event.cover_url} alt="" className="w-full h-full object-cover" />
            : <span>🎲</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-[14px] leading-tight truncate" style={{ fontFamily: "var(--font-nunito)", letterSpacing: "-0.01em" }}>
            {event.name}
          </p>
          <p className="text-[11px] mt-0.5 italic" style={{ color: "var(--muted)" }}>
            {isGroup ? "ongoing" : isPast ? "ended" : event.ends_at
              ? new Date(event.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : ""}
            {totalBets > 0 ? ` · ${totalBets} bet${totalBets !== 1 ? "s" : ""}` : " · no bets"}
          </p>
        </div>
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
        {activeTab === "explore" && myPoints !== null && (
          <span className="text-[12px] font-bold px-3 py-1.5 rounded-full"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
            {myPoints.toLocaleString()} pts
          </span>
        )}
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
                      {(featured.bets?.length ?? 0) > 0 ? ` · ${featured.bets.length} bet${featured.bets.length !== 1 ? "s" : ""}` : ""}
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
                <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>groups are ongoing — each bet has its own deadline</p>
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
        {activeTab === "explore" && (
          <>
            {/* Sub-tabs */}
            <div className="flex items-center gap-2 pb-1">
              <button
                onClick={() => setExploreSubTab("bets")}
                className="px-4 py-1.5 rounded-full text-[12px] font-bold transition-all"
                style={{
                  background: exploreSubTab === "bets" ? "var(--accent)" : "rgba(255,255,255,0.06)",
                  color: exploreSubTab === "bets" ? "#fff" : "var(--muted)",
                  border: exploreSubTab === "bets" ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                predictions
              </button>
              <button
                onClick={() => setExploreSubTab("polls")}
                className="px-4 py-1.5 rounded-full text-[12px] font-bold transition-all"
                style={{
                  background: exploreSubTab === "polls" ? "#a855f7" : "rgba(255,255,255,0.06)",
                  color: exploreSubTab === "polls" ? "#fff" : "var(--muted)",
                  border: exploreSubTab === "polls" ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                polls
              </button>
            </div>

            {!exploreLoaded && (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
              </div>
            )}

            {exploreLoaded && exploreSubTab === "bets" && bets.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-20 gap-3">
                <p className="font-bold text-[15px]" style={{ color: "var(--text)" }}>no predictions yet</p>
              </div>
            )}
            {exploreLoaded && exploreSubTab === "polls" && polls.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-20 gap-3">
                <p className="font-bold text-[15px]" style={{ color: "var(--text)" }}>no polls yet</p>
              </div>
            )}

            {exploreLoaded && exploreSubTab === "bets" && bets.map((bet) => (
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

            {exploreLoaded && exploreSubTab === "polls" && polls.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                currentUserId={privyUser?.id}
                getAccessToken={getAccessToken}
                onPollUpdate={(updated) => setPolls((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } : p))}
              />
            ))}
          </>
        )}
      </div>

      {/* Floating action buttons */}
      {activeTab !== "explore" && (
        <div className="fixed bottom-0 left-0 right-0 flex gap-2.5 px-4 pb-[76px] pt-3" style={{ zIndex: 10, background: "linear-gradient(to top, var(--bg) 65%, transparent 100%)" }}>
          <button
            onClick={() => setShowJoin(true)}
            className="flex-1 py-3.5 rounded-[12px] font-semibold text-[14px]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            join
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex-[2] py-3.5 rounded-[12px] font-black text-[15px] text-white"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)", letterSpacing: "-0.01em" }}
          >
            + new
          </button>
        </div>
      )}

      {activeTab === "explore" && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-[76px] pt-3" style={{ zIndex: 10, background: "linear-gradient(to top, var(--bg) 65%, transparent 100%)" }}>
          <button
            onClick={() => setShowCreateExplore(true)}
            className="w-full py-3.5 rounded-[12px] font-black text-[15px] text-white"
            style={{ background: exploreSubTab === "polls" ? "#a855f7" : "var(--accent)", fontFamily: "var(--font-nunito)", letterSpacing: "-0.01em" }}
          >
            + post
          </button>
        </div>
      )}

      {/* Create event modal */}
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
                  ? "time-boxed — bets close when the event ends"
                  : "ongoing — each bet has its own deadline"}
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

      {/* Create explore modal */}
      {showCreateExplore && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto" style={{ background: "var(--bg)", color: "var(--text)" }}>
          <div className="px-5 pt-14 pb-2">
            <button
              onClick={() => {
                setShowCreateExplore(false);
                setCreateQuestion(""); setCreateOptionA(""); setCreateOptionB(""); setCreateClosesAt("");
                setCreateExploreError(null);
              }}
              className="text-sm mb-5 flex items-center gap-1"
              style={{ color: "var(--muted)" }}
            >
              ← back
            </button>
            <h1 className="text-[28px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
              new {createExploreType}
            </h1>
          </div>

          <div className="px-5 pt-4 pb-32 flex flex-col gap-6">
            {/* Type toggle */}
            <div className="flex gap-2">
              {(["prediction", "poll"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCreateExploreType(t)}
                  className="flex-1 py-2.5 rounded-2xl font-bold text-[14px]"
                  style={{
                    background: createExploreType === t ? (t === "poll" ? "rgba(147,51,234,0.15)" : "var(--accent-dim)") : "rgba(255,255,255,0.04)",
                    border: `1px solid ${createExploreType === t ? (t === "poll" ? "rgba(147,51,234,0.3)" : "var(--accent-border)") : "var(--border-soft)"}`,
                    color: createExploreType === t ? (t === "poll" ? "#a855f7" : "var(--accent)") : "var(--muted)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <p className="text-[12px] -mt-3" style={{ color: "var(--dimmer)" }}>
              {createExploreType === "prediction"
                ? "friends bet points on which option wins"
                : "friends vote on their pick — no points wagered"}
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>question</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                placeholder={createExploreType === "prediction" ? "Will she say yes?" : "Who will win tonight?"}
                value={createQuestion}
                onChange={(e) => setCreateQuestion(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>option A</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                placeholder="yes"
                value={createOptionA}
                onChange={(e) => setCreateOptionA(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>option B</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                placeholder="no"
                value={createOptionB}
                onChange={(e) => setCreateOptionB(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>closes at (optional)</label>
              <input
                type="datetime-local"
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                value={createClosesAt}
                onChange={(e) => setCreateClosesAt(e.target.value)}
              />
            </div>

            {createExploreError && (
              <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{createExploreError}</p>
            )}

            <button
              onClick={createExploreType === "prediction" ? createExploreBet : createExplorePoll}
              disabled={creatingExplore || !createQuestion.trim() || !createOptionA.trim() || !createOptionB.trim()}
              className="w-full py-4 rounded-2xl font-black text-[16px] text-white disabled:opacity-40"
              style={{ background: createExploreType === "poll" ? "#a855f7" : "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              {creatingExplore ? "posting..." : `post ${createExploreType}`}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

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
  const [sharePhoto, setSharePhoto] = useState<File | null>(null);
  const [sharePhotoPreview, setSharePhotoPreview] = useState<string | null>(null);
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
    let photoUrl: string | null = null;
    if (sharePhoto) {
      const fd = new FormData();
      fd.append("file", sharePhoto);
      const uploadRes = await fetch("/api/v1/posts/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (uploadRes.ok) { const d = await uploadRes.json(); photoUrl = d.photo_url ?? null; }
    }
    const res = await fetch(`/api/v1/explore-bets/${bet.id}/post`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ caption: shareCaption.trim() || null, photo_url: photoUrl }),
    });
    if (res.ok) {
      setBet((b) => ({ ...b, my_post: { id: "", caption: shareCaption.trim() || null, photo_url: photoUrl } }));
      setShowShare(false);
      setShareCaption(""); setSharePhoto(null); setSharePhotoPreview(null);
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

      <p className="text-[15px] font-bold leading-snug" style={{ color: "var(--text)" }}>{bet.question}</p>

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

      {bet.public_posts.length > 0 && (
        <div className="flex flex-col gap-2">
          {bet.public_posts.slice(0, 3).map((post) => {
            const pname = post.user?.display_name ?? post.user?.username ?? "someone";
            return (
              <div key={post.id} className="rounded-[10px] p-2.5 flex items-start gap-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => post.user?.username && router.push(`/u/${post.user.username}`)}>
                  <div className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ width: 24, height: 24, background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
                    {post.user?.avatar_url
                      ? <img src={post.user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[9px] font-black" style={{ color: "var(--accent)" }}>{pname[0]?.toUpperCase()}</span>
                    }
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold" style={{ color: "var(--text)" }}>{pname}
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

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowShare(false); setSharePhoto(null); setSharePhotoPreview(null); } }}>
          <div className="w-full max-w-lg rounded-t-3xl flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: "70vh" }}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>share to feed</p>
              <button onClick={() => { setShowShare(false); setSharePhoto(null); setSharePhotoPreview(null); }} className="text-[14px] font-bold" style={{ color: "var(--dimmer)" }}>cancel</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
              <p className="text-[13px] font-semibold" style={{ color: "var(--muted)" }}>
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
              {sharePhotoPreview ? (
                <div className="relative rounded-[12px] overflow-hidden" style={{ maxHeight: 200 }}>
                  <img src={sharePhotoPreview} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />
                  <button onClick={() => { setSharePhoto(null); setSharePhotoPreview(null); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>✕</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-2xl cursor-pointer text-[13px] font-semibold w-fit"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)", color: "var(--muted)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="m21 15-5-5L5 21"/>
                  </svg>
                  add photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setSharePhoto(f);
                    setSharePhotoPreview(URL.createObjectURL(f));
                  }} />
                </label>
              )}
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
                    const cname = c.balances?.display_name ?? c.balances?.username ?? "someone";
                    return (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, background: "var(--accent-dim)" }}>
                          {c.balances?.avatar_url
                            ? <img src={c.balances.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            : <span className="text-[10px] font-black" style={{ color: "var(--accent)" }}>{cname[0]?.toUpperCase()}</span>
                          }
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{cname}</p>
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
  const [sharePhoto, setSharePhoto] = useState<File | null>(null);
  const [sharePhotoPreview, setSharePhotoPreview] = useState<string | null>(null);
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
    let photoUrl: string | null = null;
    if (sharePhoto) {
      const fd = new FormData();
      fd.append("file", sharePhoto);
      const uploadRes = await fetch("/api/v1/posts/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (uploadRes.ok) { const d = await uploadRes.json(); photoUrl = d.photo_url ?? null; }
    }
    const res = await fetch(`/api/v1/polls/${poll.id}/post`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ caption: shareCaption.trim() || null, photo_url: photoUrl }),
    });
    if (res.ok) {
      setPoll((p) => ({ ...p, my_post: { caption: shareCaption.trim() || null, photo_url: photoUrl } }));
      setShowShare(false);
      setShareCaption(""); setSharePhoto(null); setSharePhotoPreview(null);
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

      <p className="text-[15px] font-bold leading-snug" style={{ color: "var(--text)" }}>{poll.question}</p>

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

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowShare(false); setSharePhoto(null); setSharePhotoPreview(null); } }}>
          <div className="w-full max-w-lg rounded-t-3xl flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: "70vh" }}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>share to feed</p>
              <button onClick={() => { setShowShare(false); setSharePhoto(null); setSharePhotoPreview(null); }} className="text-[14px] font-bold" style={{ color: "var(--dimmer)" }}>cancel</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
              <p className="text-[13px] font-semibold" style={{ color: "var(--muted)" }}>
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
              {sharePhotoPreview ? (
                <div className="relative rounded-[12px] overflow-hidden" style={{ maxHeight: 200 }}>
                  <img src={sharePhotoPreview} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />
                  <button onClick={() => { setSharePhoto(null); setSharePhotoPreview(null); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>✕</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-2xl cursor-pointer text-[13px] font-semibold w-fit"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)", color: "var(--muted)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="m21 15-5-5L5 21"/>
                  </svg>
                  add photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setSharePhoto(f);
                    setSharePhotoPreview(URL.createObjectURL(f));
                  }} />
                </label>
              )}
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
                    const cname = c.balances?.display_name ?? c.balances?.username ?? "someone";
                    return (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, background: "var(--accent-dim)" }}>
                          {c.balances?.avatar_url
                            ? <img src={c.balances.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            : <span className="text-[10px] font-black" style={{ color: "var(--accent)" }}>{cname[0]?.toUpperCase()}</span>
                          }
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{cname}</p>
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

"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useEffect, useState, useCallback, useRef } from "react";

type Tab = "events" | "groups" | "past";
const TABS: { key: Tab; label: string }[] = [
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
};

export default function EventsPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
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
  const featuredNewCount = featured?.bets?.filter((b) => b.status === "open").length ?? 0;

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
          opacity: isPast ? 0.3 : 1,
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
            {totalBets > 0 ? ` · ${totalBets} bet${totalBets !== 1 ? "s" : ""}` : " · no bets"}
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
          {!isGroup && event.hasNew && !isPast && (
            <span className="text-[10px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.02em" }}>new</span>
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
                  {featuredNewCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-bold text-white px-2.5 py-1 rounded-full" style={{ background: "var(--accent)" }}>
                      {featuredNewCount} new
                    </span>
                  )}
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

      </div>

      {/* Floating action buttons */}
      <div className="fixed bottom-0 left-0 right-0 flex gap-2.5 px-4 pb-8 pt-3" style={{ zIndex: 10, background: "linear-gradient(to top, var(--bg) 65%, transparent 100%)" }}>
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
      <BottomNav />
    </div>
  );
}

"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

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
  const [points, setPoints] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; type: string; title: string; body: string; read: boolean; created_at: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [joinInput, setJoinInput] = useState("");
  const [name, setName] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [createType, setCreateType] = useState<"event" | "group">("event");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    const token = await getAccessToken();
    const [eventsRes, meRes] = await Promise.all([
      fetch("/api/v1/events", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/v1/me", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const eventsData = await eventsRes.json();
    const meData = await meRes.json();
    setEvents(eventsData.events ?? []);
    setPoints(meData.points ?? null);
    setAvatarUrl(meData.avatar_url ?? null);
    setDisplayName(meData.display_name ?? null);

    const notifsRes = await fetch("/api/v1/me/notifications", { headers: { Authorization: `Bearer ${token}` } });
    const notifsData = await notifsRes.json();
    setNotifications(notifsData.notifications ?? []);
    setUnreadCount(notifsData.unreadCount ?? 0);
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    fetchEvents();
  }, [ready, authenticated, router, fetchEvents]);

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

  async function openNotifs() {
    setShowNotifs(true);
    if (unreadCount > 0) {
      const token = await getAccessToken();
      await fetch("/api/v1/me/notifications", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  if (!ready) return null;

  const groups = events.filter((e) => e.type === "group");
  const now = new Date();
  const activeEventsList = events
    .filter((e) => e.type !== "group" && e.ends_at && new Date(e.ends_at) >= now)
    .sort((a, b) => new Date(a.ends_at!).getTime() - new Date(b.ends_at!).getTime());
  const pastEventsList = events
    .filter((e) => e.type !== "group" && (!e.ends_at || new Date(e.ends_at) < now))
    .sort((a, b) => new Date(b.ends_at ?? 0).getTime() - new Date(a.ends_at ?? 0).getTime());
  const eventsList = [...activeEventsList, ...pastEventsList];
  const activeEvents = activeEventsList.length;

  function EventCard({ event }: { event: Event }) {
    const publicBets = event.bets?.filter((b) => b.visibility === "public").length ?? 0;
    const privateBets = event.bets?.filter((b) => b.visibility === "private").length ?? 0;
    const isGroup = event.type === "group";
    const isPast = !isGroup && event.ends_at && new Date(event.ends_at) < new Date();
    return (
      <button
        onClick={() => router.push(`/e/${event.id}`)}
        className="w-full text-left rounded-3xl overflow-hidden"
        style={{
          background: isGroup ? "rgba(147,51,234,0.06)" : "var(--card)",
          border: `1px solid ${isGroup ? "var(--purple-border)" : "var(--border-soft)"}`,
          opacity: isPast ? 0.45 : 1,
        }}
      >
        {event.cover_url && (
          <div className="relative w-full" style={{ height: 110 }}>
            <img src={event.cover_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 100%)" }} />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="font-extrabold text-[17px] leading-snug flex-1 flex items-center gap-2" style={{ fontFamily: "var(--font-nunito)" }}>
              {event.name}
              {event.hasNew && !isPast && (
                <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ background: "var(--accent)" }} />
              )}
            </div>
            {isGroup ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: "var(--purple-dim)", color: "var(--purple)", border: "1px solid var(--purple-border)" }}>
                ongoing
              </span>
            ) : event.ends_at && !isPast ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                {new Date(event.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2 flex-wrap">
            {publicBets > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>
                {publicBets} public {publicBets === 1 ? "bet" : "bets"}
              </span>
            )}
            {privateBets > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--purple-dim)", color: "var(--purple)", border: "1px solid var(--purple-border)" }}>
                {privateBets} private
              </span>
            )}
            {publicBets === 0 && privateBets === 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "var(--dimmer)" }}>
                no bets yet
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="px-5 pt-14 pb-2 flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
            jury<span style={{ color: "var(--accent)" }}>duty</span>
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--dimmer)" }}>
            {groups.length > 0 ? `${groups.length} group${groups.length !== 1 ? "s" : ""} · ` : ""}{activeEvents} active event{activeEvents !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
        <button onClick={openNotifs} className="relative w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-black text-white px-1" style={{ background: "var(--accent)" }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        <button onClick={() => router.push("/profile")} className="flex flex-col items-center gap-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt="profile" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-black" style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
              {displayName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          {points !== null && (
            <span className="text-[11px] font-bold" style={{ color: "var(--dimmer)" }}>
              {points.toLocaleString()} pts
            </span>
          )}
        </button>
        </div>
      </div>

      <div className="px-3 pt-2 pb-32 flex flex-col gap-3">
        {/* Groups section */}
        {groups.length > 0 && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider px-2 pt-2" style={{ color: "var(--dimmer)" }}>groups</p>
            {groups.map((g) => <EventCard key={g.id} event={g} />)}
          </>
        )}

        {/* Events section */}
        {eventsList.length > 0 && (
          <>
            {groups.length > 0 && (
              <p className="text-[11px] font-bold uppercase tracking-wider px-2 pt-2" style={{ color: "var(--dimmer)" }}>events</p>
            )}
            {eventsList.map((e) => <EventCard key={e.id} event={e} />)}
          </>
        )}

        {events.length === 0 && (
          <p className="text-center py-12 text-[14px]" style={{ color: "var(--dimmer)" }}>no events or groups yet</p>
        )}

        <div className="flex gap-2 mt-1">
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 rounded-2xl px-4 py-3.5 flex items-center gap-2"
            style={{ border: "1px dashed var(--border)", color: "var(--dimmer)" }}
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>+</span>
            <span className="text-sm">new</span>
          </button>
          <button
            onClick={() => setShowJoin(true)}
            className="flex-1 rounded-2xl px-4 py-3.5 flex items-center gap-2"
            style={{ border: "1px dashed var(--border)", color: "var(--dimmer)" }}
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>→</span>
            <span className="text-sm">join</span>
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-t-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="w-9 h-1 rounded-full mx-auto mb-1" style={{ background: "var(--border)" }} />

            {/* Type toggle */}
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
                  {t === "event" ? "event" : "group"}
                </button>
              ))}
            </div>
            <p className="text-[12px] -mt-1" style={{ color: "var(--dimmer)" }}>
              {createType === "event"
                ? "time-boxed — bets close when the event ends"
                : "ongoing — each bet has its own deadline"}
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Name</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                placeholder={createType === "event" ? "Ava's Birthday 🎂" : "The Squad"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {createType === "event" && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Closes at</label>
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
            <div className="flex gap-3 mt-1">
              <button onClick={() => { setShowCreate(false); setCreateType("event"); setCreateError(null); }} className="flex-1 py-3.5 rounded-2xl font-bold text-[15px]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>
                Cancel
              </button>
              <button
                onClick={createEvent}
                disabled={creating || !name.trim() || (createType === "event" && !endsAt)}
                className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40"
                style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
              >
                {creating ? "Creating..." : `Create ${createType}`}
              </button>
            </div>
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
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Paste invite link</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                placeholder="juryduty.app/join/..."
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
      {/* Notifications panel */}
      {showNotifs && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowNotifs(false)}>
          <div className="rounded-t-3xl flex flex-col max-h-[80vh]" style={{ background: "var(--card)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border-soft)" }}>
              <div className="w-9 h-1 rounded-full absolute left-1/2 -translate-x-1/2 top-3" style={{ background: "var(--border)" }} />
              <h2 className="text-lg font-black mt-2" style={{ fontFamily: "var(--font-nunito)" }}>notifications</h2>
              <button onClick={() => setShowNotifs(false)} className="text-[20px] mt-2" style={{ color: "var(--muted)" }}>×</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <p className="text-center py-12 text-[14px]" style={{ color: "var(--dimmer)" }}>no notifications yet</p>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: "var(--border-soft)" }}>
                  {notifications.map((n) => (
                    <div key={n.id} className="px-6 py-4 flex gap-3 items-start" style={{ opacity: n.read ? 0.6 : 1 }}>
                      <span className="text-[22px] flex-shrink-0 mt-0.5">
                        {n.type === "bet_resolved_won" ? "🎉" : n.type === "bet_resolved_lost" ? "😬" : n.type === "bet_resolved_refunded" ? "↩️" : n.type === "points_earned" ? "🪙" : "⏰"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[14px] leading-snug">{n.title}</p>
                        <p className="text-[13px] mt-0.5 leading-snug" style={{ color: "var(--muted)" }}>{n.body}</p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--dimmer)" }}>
                          {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "var(--accent)" }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

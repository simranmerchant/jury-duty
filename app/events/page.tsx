"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

type Bet = { id: string; status: string; visibility: string };
type Event = {
  id: string;
  name: string;
  ends_at: string;
  host_id: string;
  invite_token: string;
  bets: Bet[];
};

export default function EventsPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [points, setPoints] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [name, setName] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [creating, setCreating] = useState(false);

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
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    fetchEvents();
  }, [ready, authenticated, router, fetchEvents]);

  async function createEvent() {
    if (!name.trim() || !endsAt) return;
    setCreating(true);
    const token = await getAccessToken();
    await fetch("/api/v1/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, ends_at: endsAt }),
    });
    setName(""); setEndsAt(""); setShowCreate(false); setCreating(false);
    fetchEvents();
  }

  if (!ready) return null;

  const openCount = events.filter((e) => new Date(e.ends_at) >= new Date()).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="px-5 pt-14 pb-2 flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
            betsy<span style={{ color: "var(--accent)" }}>gal</span>
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--dimmer)" }}>
            your events · {openCount} active
          </p>
        </div>
        {points !== null && (
          <button
            onClick={() => router.push("/profile")}
            className="mt-1 flex flex-col items-end gap-0.5"
          >
            <span className="text-[20px] font-black leading-none" style={{ fontFamily: "var(--font-nunito)", color: "var(--accent)" }}>
              {points.toLocaleString()}
            </span>
            <span className="text-[11px]" style={{ color: "var(--dimmer)" }}>pts</span>
          </button>
        )}
      </div>

      <div className="px-3 pt-2 pb-32 flex flex-col gap-3">
        {events.map((event) => {
          const publicBets = event.bets?.filter((b) => b.visibility === "public").length ?? 0;
          const privateBets = event.bets?.filter((b) => b.visibility === "private").length ?? 0;
          const isPast = new Date(event.ends_at) < new Date();
          return (
            <button
              key={event.id}
              onClick={() => router.push(`/e/${event.id}`)}
              className="w-full text-left rounded-3xl p-5"
              style={{ background: "var(--card)", border: "1px solid var(--border-soft)", opacity: isPast ? 0.45 : 1 }}
            >
              <div className="font-extrabold text-[17px] mb-0.5" style={{ fontFamily: "var(--font-nunito)" }}>
                {event.name}
              </div>
              <div className="text-[13px] mb-3" style={{ color: "var(--muted)" }}>
                closes {new Date(event.ends_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="flex gap-2 flex-wrap">
                {publicBets > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
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
            </button>
          );
        })}

        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 rounded-2xl px-4 py-3.5 flex items-center gap-2"
            style={{ border: "1px dashed var(--border)", color: "var(--dimmer)" }}
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>+</span>
            <span className="text-sm">new event</span>
          </button>
          <button
            onClick={() => setShowJoin(true)}
            className="flex-1 rounded-2xl px-4 py-3.5 flex items-center gap-2"
            style={{ border: "1px dashed var(--border)", color: "var(--dimmer)" }}
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>→</span>
            <span className="text-sm">join event</span>
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-t-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="w-9 h-1 rounded-full mx-auto mb-1" style={{ background: "var(--border)" }} />
            <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-nunito)" }}>New Event</h2>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Name</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                placeholder="Ava's Birthday 🎂"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Closes at</label>
              <input
                type="datetime-local"
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3.5 rounded-2xl font-bold text-[15px]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>
                Cancel
              </button>
              <button onClick={createEvent} disabled={creating || !name.trim() || !endsAt} className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40" style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-t-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="w-9 h-1 rounded-full mx-auto mb-1" style={{ background: "var(--border)" }} />
            <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-nunito)" }}>Join an Event</h2>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Paste invite link</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                placeholder="betsygal.vercel.app/join/..."
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
                  setShowJoin(false);
                  setJoinInput("");
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
    </div>
  );
}

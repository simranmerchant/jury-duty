"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

type Bet = { id: string; status: string; visibility: string };
type Event = {
  id: string;
  name: string;
  date: string;
  host_id: string;
  invite_token: string;
  bets: Bet[];
};

export default function EventsPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchEvents = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/v1/events", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setEvents(data.events ?? []);
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    fetchEvents();
  }, [ready, authenticated, router, fetchEvents]);

  async function createEvent() {
    if (!name.trim() || !date) return;
    setCreating(true);
    const token = await getAccessToken();
    await fetch("/api/v1/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, date }),
    });
    setName(""); setDate(""); setShowCreate(false); setCreating(false);
    fetchEvents();
  }

  if (!ready) return null;

  const openCount = events.filter((e) => new Date(e.date) >= new Date()).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="px-5 pt-14 pb-2">
        <h1 className="text-[32px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
          betsy<span style={{ color: "var(--accent)" }}>gal</span>
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--dimmer)" }}>
          your events · {openCount} active
        </p>
      </div>

      <div className="px-3 pt-2 pb-32 flex flex-col gap-3">
        {events.map((event) => {
          const publicBets = event.bets?.filter((b) => b.visibility === "public").length ?? 0;
          const privateBets = event.bets?.filter((b) => b.visibility === "private").length ?? 0;
          const isPast = new Date(event.date) < new Date();
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
                {new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
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

        <button
          onClick={() => setShowCreate(true)}
          className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3"
          style={{ border: "1px dashed var(--border)", color: "var(--dimmer)" }}
        >
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>+</span>
          <span className="text-sm">create or join an event</span>
        </button>
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
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Date</label>
              <input
                type="datetime-local"
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3.5 rounded-2xl font-bold text-[15px]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>
                Cancel
              </button>
              <button onClick={createEvent} disabled={creating || !name.trim() || !date} className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40" style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

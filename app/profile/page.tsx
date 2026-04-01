"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

type HistoryEntry = {
  id: string;
  bet_id: string;
  event_id: string;
  event_name: string;
  question: string;
  pick: string;
  points_staked: number;
  outcome: "pending" | "won" | "lost" | "refunded";
};
type Stats = { total: number; won: number; lost: number; pending: number };

const OUTCOME_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  won:      { label: "won",      color: "var(--win)",    bg: "rgba(48,209,88,0.12)",   border: "rgba(48,209,88,0.25)" },
  lost:     { label: "lost",     color: "var(--muted)",  bg: "rgba(255,255,255,0.04)", border: "transparent" },
  refunded: { label: "refunded", color: "var(--purple)", bg: "var(--purple-dim)",      border: "var(--purple-border)" },
  pending:  { label: "open",     color: "var(--accent)", bg: "var(--accent-dim)",      border: "var(--accent-border)" },
};

export default function ProfilePage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const router = useRouter();

  const [points, setPoints] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setPoints(data.points);
    setDisplayName(data.display_name ?? "");
    setHistory(data.history ?? []);
    setStats(data.stats ?? null);
    setLoading(false);
  }, [getAccessToken]);

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || savingName) return;
    setSavingName(true);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: trimmed }),
    });
    if (res.ok) {
      setDisplayName(trimmed);
      setEditingName(false);
    }
    setSavingName(false);
  }

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    fetchMe();
  }, [ready, authenticated, router, fetchMe]);

  if (!ready || loading) return null;

  const winRate = stats && stats.total - stats.pending > 0
    ? Math.round((stats.won / (stats.total - stats.pending)) * 100)
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="px-5 pt-14 pb-4">
        <button
          onClick={() => router.push("/events")}
          className="text-sm mb-4 flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          ← events
        </button>
        <div className="flex items-center justify-between">
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                className="rounded-xl px-3 py-2 text-[18px] font-bold outline-none flex-1"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                maxLength={40}
                autoFocus
              />
              <button
                onClick={saveName}
                disabled={!nameInput.trim() || savingName}
                className="px-3 py-2 rounded-xl font-bold text-[13px] text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}
              >
                {savingName ? "..." : "save"}
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="px-3 py-2 rounded-xl font-bold text-[13px]"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}
              >
                cancel
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-[32px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
                {displayName || "you"}
              </h1>
              <button
                onClick={() => { setNameInput(displayName); setEditingName(true); }}
                className="text-[12px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}
              >
                edit name
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pb-32 flex flex-col gap-4">
        {/* Balance card */}
        <div
          className="rounded-3xl p-6 flex flex-col gap-1"
          style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
        >
          <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            your balance
          </p>
          <p
            className="text-[48px] font-black leading-none tracking-tight"
            style={{ fontFamily: "var(--font-nunito)", color: "var(--accent)" }}
          >
            {points?.toLocaleString() ?? "—"}
          </p>
          <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>points</p>
        </div>

        {/* Stats row */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "total bets", value: stats.total },
              { label: "won", value: stats.won },
              { label: "win rate", value: winRate !== null ? `${winRate}%` : "—" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl p-4 flex flex-col gap-0.5"
                style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
              >
                <p className="text-[20px] font-black" style={{ fontFamily: "var(--font-nunito)" }}>
                  {value}
                </p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <p
              className="text-[11px] font-bold uppercase tracking-wider px-1 pt-2"
              style={{ color: "var(--dimmer)" }}
            >
              bet history
            </p>
            <div className="flex flex-col gap-2">
              {history.map((entry) => {
                const style = OUTCOME_STYLE[entry.outcome];
                return (
                  <button
                    key={entry.id}
                    onClick={() => entry.event_id && router.push(`/e/${entry.event_id}`)}
                    className="w-full text-left rounded-2xl p-4 flex items-start justify-between gap-3"
                    style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
                  >
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <p className="text-[13px] font-bold leading-snug truncate">
                        {entry.question}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                        {entry.event_name} · {entry.pick} · {entry.points_staked.toLocaleString()} pts
                      </p>
                    </div>
                    <span
                      className="text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
                    >
                      {style.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {history.length === 0 && (
          <p className="text-center py-8 text-[14px]" style={{ color: "var(--dimmer)" }}>
            no bets yet
          </p>
        )}

        {/* Log out */}
        <button
          onClick={() => logout().then(() => router.replace("/login"))}
          className="mt-4 py-3.5 rounded-2xl font-bold text-[14px]"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}
        >
          log out
        </button>
      </div>
    </div>
  );
}

"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TaggedBet = {
  bet_id: string;
  question: string;
  label: string;
  event_id: string | null;
  event_name: string | null;
  status: string;
  outcome: "pending" | "won" | "lost" | "refunded";
};

type HistoryEntry = {
  id: string;
  bet_id: string;
  event_id: string | null;
  event_name: string | null;
  question: string;
  pick: string;
  points_staked: number;
  outcome: "pending" | "won" | "lost" | "refunded";
};

type Stats = { total: number; won: number; lost: number; pending: number; win_rate: number | null };
type MutualEvent = { id: string; name: string; type: string };

type Profile = {
  user_id: string;
  display_name: string | null;
  username: string;
  avatar_url: string | null;
};

const OUTCOME_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  won:      { label: "won",      color: "var(--win)",    bg: "rgba(48,209,88,0.12)",   border: "rgba(48,209,88,0.25)" },
  lost:     { label: "lost",     color: "var(--muted)",  bg: "rgba(255,255,255,0.04)", border: "transparent" },
  refunded: { label: "refunded", color: "var(--purple)", bg: "var(--purple-dim)",      border: "var(--purple-border)" },
  pending:  { label: "open",     color: "var(--accent)", bg: "var(--accent-dim)",      border: "var(--accent-border)" },
};

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const { ready, getAccessToken } = usePrivy();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [taggedBets, setTaggedBets] = useState<TaggedBet[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mutualEvents, setMutualEvents] = useState<MutualEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!ready) return;
    getAccessToken().then((token) => {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(`/api/v1/users/${encodeURIComponent(username)}`, { headers });
    }).then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setProfile(data.user);
        setTaggedBets(data.tagged_bets ?? []);
        setHistory(data.history ?? []);
        setStats(data.stats ?? null);
        setMutualEvents(data.mutual_events ?? []);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [ready, username, getAccessToken]);

  if (loading) return null;

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <p className="text-[28px] font-black" style={{ fontFamily: "var(--font-nunito)" }}>@{username}</p>
        <p className="text-[15px]" style={{ color: "var(--muted)" }}>user not found</p>
        <button onClick={() => router.back()} className="text-sm mt-2" style={{ color: "var(--accent)" }}>← go back</button>
      </div>
    );
  }

  const name = profile?.display_name ?? profile?.username ?? "unknown";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="px-5 pt-14 pb-4">
        <button
          onClick={() => router.back()}
          className="text-sm mb-4 flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          ← back
        </button>

        {/* Avatar */}
        <div className="w-20 h-20 rounded-full mb-3 flex items-center justify-center text-[28px] font-black overflow-hidden" style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            name[0]?.toUpperCase() ?? "?"
          )}
        </div>

        <h1 className="text-[32px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
          {name}
        </h1>
        {profile?.username && (
          <p className="text-[14px] font-semibold mt-0.5" style={{ color: "var(--muted)" }}>@{profile.username}</p>
        )}
      </div>

      <div className="px-4 pb-32 flex flex-col gap-4">
        {/* Stats */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "total bets", value: stats.total },
              { label: "won", value: stats.won },
              { label: "win rate", value: stats.win_rate !== null ? `${stats.win_rate}%` : "—" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl p-4 flex flex-col gap-0.5"
                style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
              >
                <p className="text-[20px] font-black" style={{ fontFamily: "var(--font-nunito)" }}>{value}</p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mutual events */}
        {mutualEvents.length > 0 && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider px-1 pt-2" style={{ color: "var(--dimmer)" }}>
              in common
            </p>
            <div className="flex flex-col gap-2">
              {mutualEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => router.push(`/e/${e.id}`)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left"
                  style={{
                    background: e.type === "group" ? "rgba(147,51,234,0.06)" : "var(--card)",
                    border: `1px solid ${e.type === "group" ? "var(--purple-border)" : "var(--border-soft)"}`,
                  }}
                >
                  <p className="text-[14px] font-bold">{e.name}</p>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={e.type === "group"
                      ? { background: "var(--purple-dim)", color: "var(--purple)", border: "1px solid var(--purple-border)" }
                      : { background: "rgba(255,255,255,0.06)", color: "var(--muted)" }
                    }
                  >
                    {e.type}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Tagged in */}
        {taggedBets.length > 0 && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider px-1 pt-2" style={{ color: "var(--dimmer)" }}>
              tagged in
            </p>
            <div className="flex flex-col gap-2">
              {taggedBets.map((tb) => {
                const style = OUTCOME_STYLE[tb.outcome];
                return (
                  <button
                    key={tb.bet_id}
                    onClick={() => tb.event_id && router.push(`/e/${tb.event_id}`)}
                    className="w-full text-left rounded-2xl p-4 flex items-start justify-between gap-3"
                    style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
                  >
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <p className="text-[13px] font-bold leading-snug truncate">{tb.question}</p>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                        {tb.event_name} · {tb.label}
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

        {/* Bet history */}
        {history.length > 0 && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider px-1 pt-2" style={{ color: "var(--dimmer)" }}>
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
                      <p className="text-[13px] font-bold leading-snug truncate">{entry.question}</p>
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

        {taggedBets.length === 0 && history.length === 0 && (
          <p className="text-center py-8 text-[14px]" style={{ color: "var(--dimmer)" }}>no public bets yet</p>
        )}
      </div>
    </div>
  );
}

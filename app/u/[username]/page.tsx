"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = {
  user_id: string;
  display_name: string | null;
  username: string;
  avatar_url: string | null;
  points: number;
};

type EventItem = { id: string; name: string; type: string };

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const { ready, authenticated, getAccessToken } = usePrivy();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [mutualEvents, setMutualEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
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
        setWinRate(data.win_rate ?? null);
        setMutualEvents(data.mutual_events ?? []);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [ready, authenticated, username, getAccessToken]);

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
  const isMutual = mutualEvents.length > 0;

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

        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-[32px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
            {name}
          </h1>
          {isMutual && (
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
            >
              mutual
            </span>
          )}
        </div>
        {profile?.username && (
          <p className="text-[14px] font-semibold mt-0.5" style={{ color: "var(--muted)" }}>@{profile.username}</p>
        )}
      </div>

      <div className="px-4 pb-32 flex flex-col gap-4">
        {/* Stats: points + win rate */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-2xl p-4 flex flex-col gap-0.5"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
          >
            <p className="text-[20px] font-black" style={{ fontFamily: "var(--font-nunito)" }}>
              {(profile?.points ?? 0).toLocaleString()}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>points</p>
          </div>
          <div
            className="rounded-2xl p-4 flex flex-col gap-0.5"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
          >
            <p className="text-[20px] font-black" style={{ fontFamily: "var(--font-nunito)" }}>
              {winRate !== null ? `${winRate}%` : "—"}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>win rate</p>
          </div>
        </div>

        {/* Mutual events / groups */}
        {mutualEvents.length > 0 && (
          <>
            <p className="text-[12px] font-semibold px-1 pt-2" style={{ color: "var(--dimmer)" }}>
              events & groups in common
            </p>
            <div className="flex flex-col gap-2">
              {mutualEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => router.push(`/e/${e.id}`)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left"
                  style={{
                    background: e.type === "group" ? "var(--purple-dim)" : "var(--card)",
                    border: `1px solid ${e.type === "group" ? "var(--purple-border)" : "var(--border-soft)"}`,
                  }}
                >
                  <p className="text-[14px] font-bold">{e.name}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={e.type === "group"
                        ? { background: "rgba(0,0,0,0.15)", color: "var(--purple)" }
                        : { background: "rgba(255,255,255,0.06)", color: "var(--muted)" }
                      }
                    >
                      {e.type}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--dimmer)" }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {mutualEvents.length === 0 && (
          <p className="text-center py-8 text-[14px]" style={{ color: "var(--dimmer)" }}>no events in common</p>
        )}
      </div>
    </div>
  );
}

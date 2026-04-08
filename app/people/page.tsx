"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";

type UserResult = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function PeoplePage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/users/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!res) { setLoading(false); return; }
    const data = await res.json();
    setResults(data.users ?? []);
    setLoading(false);
  }, [getAccessToken]);

  function onQueryChange(val: string) {
    setQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => search(val), 350);
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="px-5 pt-14 pb-2">
        <button
          onClick={() => router.push("/events")}
          className="text-sm mb-5 flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          ← events
        </button>
        <h1 className="text-[28px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
          people
        </h1>
      </div>

      <div className="px-5 pt-4 pb-32 flex flex-col gap-4">
        {/* Search bar */}
        <div
          className="flex items-center gap-2 rounded-2xl px-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)" }}
        >
          <span className="text-[16px]" style={{ color: "var(--dimmer)" }}>🔍</span>
          <input
            className="flex-1 py-3.5 text-[15px] outline-none bg-transparent"
            style={{ color: "var(--text)" }}
            placeholder="search by name or @username"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
              className="text-[13px] font-bold"
              style={{ color: "var(--muted)" }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Results */}
        {loading && (
          <p className="text-center text-[13px]" style={{ color: "var(--dimmer)" }}>searching...</p>
        )}

        {!loading && searched && results.length === 0 && (
          <p className="text-center py-6 text-[14px]" style={{ color: "var(--dimmer)" }}>
            no users found for "{query}"
          </p>
        )}

        {!loading && results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((u) => {
              const name = u.display_name ?? u.username ?? "unknown";
              const hasProfile = !!u.username;
              return (
                <button
                  key={u.user_id}
                  onClick={() => hasProfile && router.push(`/u/${u.username}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left"
                  style={{ background: "var(--card)", border: "1px solid var(--border-soft)", opacity: hasProfile ? 1 : 0.6, cursor: hasProfile ? "pointer" : "default" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-black flex-shrink-0 overflow-hidden"
                    style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "var(--font-nunito)" }}
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      name[0]?.toUpperCase() ?? "?"
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <p className="text-[15px] font-bold truncate">{name}</p>
                    {u.username
                      ? <p className="text-[12px]" style={{ color: "var(--muted)" }}>@{u.username}</p>
                      : <p className="text-[12px]" style={{ color: "var(--dimmer)" }}>no username set</p>
                    }
                  </div>
                  {hasProfile && <span className="text-[16px]" style={{ color: "var(--dimmer)" }}>›</span>}
                </button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

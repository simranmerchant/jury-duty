"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import BottomNav from "@/components/BottomNav";

type PublicPost = {
  id: string;
  caption: string | null;
  created_at: string;
  user: { user_id: string; display_name: string; username: string; avatar_url: string | null } | null;
  side: "a" | "b" | null;
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
  creator: { display_name: string; username: string; avatar_url: string | null } | null;
  total_pts_a: number;
  total_pts_b: number;
  total_entries: number;
  my_entry: { side: "a" | "b"; points_wagered: number } | null;
  my_post: { id: string; caption: string | null } | null;
  public_posts: PublicPost[];
};

function Avatar({ url, name, size = 26 }: { url?: string | null; name?: string; size?: number }) {
  if (url) {
    return <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 700, color: "var(--accent)",
    }}>
      {(name ?? "?")[0].toUpperCase()}
    </div>
  );
}

function BetCard({ bet, onClick }: { bet: ExploreBet; onClick: () => void }) {
  const total = bet.total_pts_a + bet.total_pts_b;
  const pctA = total > 0 ? Math.round((bet.total_pts_a / total) * 100) : 50;
  const pctB = 100 - pctA;

  function barColor(side: "a" | "b") {
    if (bet.status === "resolved") {
      return bet.winning_side === side ? "var(--win)" : "var(--loss)";
    }
    return bet.my_entry?.side === side ? "var(--accent)" : "var(--dimmer)";
  }

  function labelColor(side: "a" | "b") {
    if (bet.status === "resolved") {
      return bet.winning_side === side ? "var(--win)" : "var(--muted)";
    }
    return bet.my_entry?.side === side ? "var(--accent)" : "var(--text)";
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex flex-col gap-3 rounded-[16px] p-4 transition-colors hover:bg-white/[0.02]"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Avatar url={bet.creator?.avatar_url} name={bet.creator?.display_name ?? "?"} size={20} />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>@{bet.creator?.username ?? "unknown"}</span>
        <span
          className="ml-auto text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            background: bet.status === "open" ? "var(--accent-dim)" : "rgba(255,255,255,0.05)",
            color: bet.status === "open" ? "var(--accent)" : "var(--muted)",
          }}
        >
          {bet.status}
        </span>
      </div>

      {/* Question */}
      <p className="font-semibold text-[16px] leading-snug" style={{ color: "var(--text)" }}>
        {bet.question}
      </p>

      {/* Bars */}
      <div className="flex flex-col gap-2">
        {(["a", "b"] as const).map((side) => {
          const label = side === "a" ? bet.option_a : bet.option_b;
          const pct = side === "a" ? pctA : pctB;
          const myPick = bet.my_entry?.side === side;
          return (
            <div key={side} className="relative flex items-center rounded-[10px] overflow-hidden"
              style={{
                height: 36,
                border: `1px solid ${myPick ? "var(--accent-border)" : "var(--border)"}`,
              }}
            >
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${pct}%`,
                background: barColor(side) + "28",
              }} />
              <span className="relative pl-3 flex-1 text-[13px] font-medium truncate" style={{ color: labelColor(side) }}>
                {label}
              </span>
              <span className="relative pr-3 text-[13px] font-semibold" style={{ color: labelColor(side) }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Activity strip */}
      {bet.public_posts.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex" style={{ gap: -4 }}>
            {bet.public_posts.slice(0, 4).map((p) => (
              <div key={p.id} style={{ marginRight: -6 }}>
                <Avatar url={p.user?.avatar_url} name={p.user?.display_name ?? "?"} size={20} />
              </div>
            ))}
          </div>
          {bet.public_posts[0]?.caption && (
            <span className="text-[13px] italic truncate flex-1" style={{ color: "var(--muted)", marginLeft: 10 }}>
              "{bet.public_posts[0].caption}"
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
          {bet.total_entries} bet{bet.total_entries !== 1 ? "s" : ""}
        </span>
        {bet.closes_at && bet.status === "open" && (
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            closes {new Date(bet.closes_at).toLocaleDateString()}
          </span>
        )}
        {bet.my_entry && (
          <span className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>
            you picked {bet.my_entry.side === "a" ? bet.option_a : bet.option_b}
          </span>
        )}
      </div>
    </button>
  );
}

export default function ExplorePage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();

  const [bets, setBets] = useState<ExploreBet[]>([]);
  const [loading, setLoading] = useState(true);

  // Create sheet
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch("/api/v1/explore-bets", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setBets(data.bets ?? []);
    }
    setLoading(false);
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    load();
  }, [ready, authenticated, router, load]);

  async function createBet() {
    if (!question.trim() || !optA.trim() || !optB.trim()) {
      setCreateError("fill in all fields");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/explore-bets", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.trim(), option_a: optA.trim(), option_b: optB.trim() }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setCreateError(data.error ?? "something went wrong"); return; }
    setShowCreate(false);
    setQuestion(""); setOptA(""); setOptB(""); setCreateError(null);
    await load();
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-10 pb-3"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <h1 className="text-[22px] font-black" style={{ fontFamily: "var(--font-nunito)", color: "var(--text)" }}>
          explore
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="text-[14px] font-semibold px-4 py-1.5 rounded-full"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}
        >
          + new
        </button>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        ) : bets.length === 0 ? (
          <div className="flex flex-col items-center pt-20 gap-2">
            <p style={{ color: "var(--muted)", fontSize: 15 }}>no bets yet — be the first</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-[14px] font-semibold px-5 py-2 rounded-full mt-2"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              post a bet
            </button>
          </div>
        ) : (
          bets.map((bet) => (
            <BetCard key={bet.id} bet={bet} onClick={() => router.push(`/explore/${bet.id}`)} />
          ))
        )}
      </div>

      <BottomNav />

      {/* Create sheet */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCreate(false); setCreateError(null); } }}
        >
          <div className="w-full max-w-lg rounded-t-[20px] p-6 flex flex-col gap-4"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-[18px]" style={{ fontFamily: "var(--font-nunito)", color: "var(--text)" }}>
                new explore bet
              </h2>
              <button onClick={() => { setShowCreate(false); setCreateError(null); }} style={{ color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>question</label>
              <textarea
                className="w-full rounded-[12px] px-4 py-3 text-[14px] resize-none outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)", minHeight: 72 }}
                placeholder="e.g. Will it snow in NYC this winter?"
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
                maxLength={200}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>option A</label>
                <input
                  className="w-full rounded-[12px] px-4 py-2.5 text-[14px] outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                  placeholder="Yes"
                  value={optA}
                  onChange={(e) => setOptA(e.target.value.slice(0, 80))}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>option B</label>
                <input
                  className="w-full rounded-[12px] px-4 py-2.5 text-[14px] outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                  placeholder="No"
                  value={optB}
                  onChange={(e) => setOptB(e.target.value.slice(0, 80))}
                />
              </div>
            </div>

            {createError && <p className="text-[13px]" style={{ color: "var(--loss)" }}>{createError}</p>}

            <button
              onClick={createBet}
              disabled={submitting}
              className="w-full py-3 rounded-[12px] font-bold text-[15px] text-white transition-opacity"
              style={{ background: "var(--accent)", opacity: submitting ? 0.5 : 1 }}
            >
              {submitting ? "posting…" : "post bet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

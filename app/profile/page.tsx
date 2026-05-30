"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$|^[a-z0-9]{3}$/;

type HistoryEntry = {
  id: string;
  bet_id: string;
  event_id: string;
  event_name: string;
  question: string;
  pick: string;
  points_staked: number;
  outcome: "pending" | "won" | "lost" | "refunded";
  is_hidden_from_profile: boolean;
  is_anonymous: boolean;
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [username, setUsername] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "unchanged">("idle");
  const [savingName, setSavingName] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setUsername(data.username ?? null);
    setAvatarUrl(data.avatar_url ?? null);
    setHistory(data.history ?? []);
    setStats(data.stats ?? null);
    setLoading(false);
  }, [getAccessToken]);

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    // Compress + resize to 400px JPEG before upload
    const blob = await new Promise<Blob>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.82);
      };
      img.src = url;
    });
    const token = await getAccessToken();
    const form = new FormData();
    form.append("file", blob, "avatar.jpg");
    const res = await fetch("/api/v1/me/avatar", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (res.ok) setAvatarUrl(data.avatar_url);
    setUploadingAvatar(false);
    e.target.value = "";
  }

  function onUsernameInputChange(val: string) {
    const u = val.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setUsernameInput(u);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!u) { setUsernameStatus("idle"); return; }
    if (u === username) { setUsernameStatus("unchanged"); return; }
    if (!USERNAME_RE.test(u)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    checkTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/v1/me/username?u=${encodeURIComponent(u)}`).catch(() => null);
      if (!res) { setUsernameStatus("idle"); return; }
      const data = await res.json().catch(() => ({}));
      setUsernameStatus(data.available ? "available" : "taken");
    }, 400);
  }

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || savingName) return;
    if (usernameInput && usernameStatus !== "available" && usernameStatus !== "unchanged") return;
    setSavingName(true);
    const token = await getAccessToken();
    const promises: Promise<any>[] = [
      fetch("/api/v1/me", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      }),
    ];
    if (usernameInput && usernameStatus === "available") {
      promises.push(
        fetch("/api/v1/me/username", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ username: usernameInput }),
        })
      );
    }
    await Promise.all(promises);
    setDisplayName(trimmed);
    if (usernameInput && usernameStatus === "available") setUsername(usernameInput);
    setEditingName(false);
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

  const staked = history
    .filter((h) => h.outcome === "pending")
    .reduce((sum, h) => sum + h.points_staked, 0);

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
        {/* Avatar */}
        <label className="relative w-20 h-20 rounded-full cursor-pointer block mb-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-[28px] font-black" style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
              {displayName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: uploadingAvatar ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)" }}>
            {uploadingAvatar && <span className="text-white text-[11px] font-bold">uploading...</span>}
          </div>
          {!uploadingAvatar && (
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--card)", border: "2px solid var(--bg)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploadingAvatar} />
        </label>

        <div className="flex items-center justify-between">
          {editingName ? (
            <div className="flex flex-col gap-2 flex-1">
              <input
                className="rounded-xl px-3 py-2 text-[18px] font-bold outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                placeholder="display name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={40}
                autoFocus
              />
              <div
                className="flex items-center rounded-xl px-3 gap-1"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent-border)" }}
              >
                <span className="font-bold text-[15px]" style={{ color: "var(--accent)" }}>@</span>
                <input
                  className="flex-1 py-2 text-[15px] font-bold outline-none bg-transparent"
                  style={{ color: "var(--text)" }}
                  placeholder="username"
                  value={usernameInput}
                  onChange={(e) => onUsernameInputChange(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                {usernameStatus === "checking" && <span className="text-[12px]" style={{ color: "var(--dimmer)" }}>...</span>}
                {(usernameStatus === "available" || usernameStatus === "unchanged") && <span style={{ color: "var(--win)" }}>✓</span>}
                {usernameStatus === "taken" && <span style={{ color: "var(--accent)" }}>✕</span>}
              </div>
              {usernameStatus === "invalid" && <p className="text-[11px]" style={{ color: "var(--muted)" }}>3–20 chars, lowercase, letters/numbers/. and _</p>}
              {usernameStatus === "taken" && <p className="text-[11px]" style={{ color: "var(--accent)" }}>username taken</p>}
              <div className="flex gap-2">
                <button
                  onClick={saveName}
                  disabled={!nameInput.trim() || savingName || usernameStatus === "taken" || usernameStatus === "invalid" || usernameStatus === "checking"}
                  className="flex-1 py-2 rounded-xl font-bold text-[13px] text-white disabled:opacity-40"
                  style={{ background: "var(--accent)" }}
                >
                  {savingName ? "..." : "save"}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="px-4 py-2 rounded-xl font-bold text-[13px]"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}
                >
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-[32px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
                  {displayName || "you"}
                </h1>
                {username && (
                  <p className="text-[14px] font-semibold mt-0.5" style={{ color: "var(--muted)" }}>@{username}</p>
                )}
              </div>
              <button
                onClick={() => { setNameInput(displayName); setUsernameInput(username ?? ""); setUsernameStatus(username ? "unchanged" : "idle"); setEditingName(true); }}
                className="text-[12px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}
              >
                edit
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
          <p className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
            your balance
          </p>
          <p
            className="text-[48px] font-black leading-none tracking-tight"
            style={{ fontFamily: "var(--font-nunito)", color: "var(--accent)" }}
          >
            {points?.toLocaleString() ?? "—"}
          </p>
          <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>points available</p>
          {staked > 0 && (
            <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
              + {staked.toLocaleString()} pts in {stats?.pending} open {stats?.pending === 1 ? "prediction" : "predictions"}
            </p>
          )}
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
              className="text-[12px] font-semibold px-1 pt-2"
              style={{ color: "var(--dimmer)" }}
            >
              bet history
            </p>
            <div className="flex flex-col gap-2">
              {history.map((entry) => {
                const style = OUTCOME_STYLE[entry.outcome];
                const hidden = entry.is_hidden_from_profile;
                async function toggleHidden(e: React.MouseEvent) {
                  e.stopPropagation();
                  const token = await getAccessToken();
                  const res = await fetch(`/api/v1/me/history/${entry.id}`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ hidden: !hidden }),
                  });
                  if (res.ok) {
                    setHistory((prev) => prev.map((h) => h.id === entry.id ? { ...h, is_hidden_from_profile: !hidden } : h));
                  }
                }
                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl p-4 flex items-start justify-between gap-3"
                    style={{ background: "var(--card)", border: "1px solid var(--border-soft)", opacity: hidden ? 0.5 : 1 }}
                  >
                    <button
                      className="flex flex-col gap-0.5 flex-1 min-w-0 text-left"
                      onClick={() => entry.event_id && router.push(`/e/${entry.event_id}`)}
                    >
                      <p className="text-[13px] font-bold leading-snug truncate">
                        {entry.question}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                        {entry.event_name} · {entry.pick} · {entry.points_staked.toLocaleString()} pts
                      </p>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-[11px] font-bold px-2 py-1 rounded-full"
                        style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
                      >
                        {style.label}
                      </span>
                      {hidden && (
                        <div
                          onClick={entry.is_anonymous ? undefined : toggleHidden}
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(255,255,255,0.05)", color: "var(--dimmer)", cursor: entry.is_anonymous ? "default" : "pointer" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
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

        {/* How it works */}
        <button
          onClick={() => router.push("/how-it-works")}
          className="flex items-center justify-between px-5 py-4 rounded-2xl font-semibold text-[14px]"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--muted)" }}
        >
          <span>how it works</span>
          <span style={{ color: "var(--dimmer)", fontSize: 18, fontWeight: 300 }}>›</span>
        </button>

        {/* Log out */}
        <button
          onClick={() => logout().then(() => router.replace("/login"))}
          className="py-3.5 rounded-2xl font-bold text-[14px]"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}
        >
          log out
        </button>
      </div>
    </div>
  );
}

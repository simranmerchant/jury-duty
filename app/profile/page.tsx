"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import { useBlinkDeposit } from "@swype-org/deposit/react";
import { getDisplayMessage } from "@swype-org/deposit";
import { BLINK_CHAIN_ID, BLINK_USDC_BASE } from "@/lib/blink";
import { centsToDisplay, displayToCents } from "@/lib/usdc";

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? "";

const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$|^[a-z0-9]{3}$/;

type FollowRequest = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  requested_at: string;
};

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
  const [isPrivate, setIsPrivate] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [ensInput, setEnsInput] = useState("");
  const [ensName, setEnsName] = useState<string | null>(null);
  const [ensLoading, setEnsLoading] = useState(false);
  const [ensError, setEnsError] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const [lastTransferId, setLastTransferId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    const token = await getAccessToken();
    const [meRes, reqRes] = await Promise.all([
      fetch("/api/v1/me", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/v1/me/follow-requests", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const data = await meRes.json();
    setPoints(data.points);
    setDisplayName(data.display_name ?? "");
    setUsername(data.username ?? null);
    setAvatarUrl(data.avatar_url ?? null);
    setIsPrivate(data.is_private ?? false);
    setFollowerCount(data.follower_count ?? 0);
    setFollowingCount(data.following_count ?? 0);
    setEnsName(data.ens_name ?? null);
    setHistory(data.history ?? []);
    setStats(data.stats ?? null);
    if (reqRes.ok) {
      const reqData = await reqRes.json();
      setFollowRequests(reqData.requests ?? []);
    }
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

  async function linkEns() {
    const name = ensInput.trim().toLowerCase();
    if (!name || ensLoading) return;
    setEnsLoading(true);
    setEnsError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/me/ens", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ens_name: name }),
    });
    const data = await res.json();
    if (res.ok) {
      setEnsName(data.ens_name);
      if (data.avatar_url) setAvatarUrl(data.avatar_url);
      setDisplayName(name);
      setEnsInput("");
    } else {
      setEnsError(data.error ?? "failed to link ENS");
    }
    setEnsLoading(false);
  }

  async function unlinkEns() {
    setEnsLoading(true);
    const token = await getAccessToken();
    await fetch("/api/v1/me/ens", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ens_name: null }),
    });
    setEnsName(null);
    setEnsLoading(false);
  }


  // Custom signer function so we can attach the Privy auth token.
  // getAccessToken is a stable reference from Privy, safe to capture in the closure.
  const { requestDeposit, status: blinkStatus } = useBlinkDeposit({
    environment: (process.env.NEXT_PUBLIC_BLINK_ENV as "sandbox" | "production" | undefined) ?? "sandbox",
    signer: async (signerReq) => {
      const token = await getAccessToken();
      const res = await fetch("/api/v1/me/blink-sign", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signerReq),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  async function handleDeposit(amountUsd: number) {
    if (!TREASURY_ADDRESS) {
      setDepositError("deposits not configured");
      return;
    }
    setDepositError(null);
    setDepositSuccess(null);
    try {
      const result = await requestDeposit({
        amount: amountUsd,
        chainId: BLINK_CHAIN_ID,
        address: TREASURY_ADDRESS,
        token: BLINK_USDC_BASE,
      });
      const token = await getAccessToken();
      const res = await fetch("/api/v1/me/blink-deposit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ transfer_id: result.transfer.id, amount_usd: amountUsd }),
      });
      if (res.ok) {
        const data = await res.json();
        setPoints(data.new_balance);
        setLastTransferId(result.transfer.id);
        setDepositSuccess(`+${centsToDisplay(displayToCents(amountUsd))} added!`);
      } else {
        const data = await res.json().catch(() => ({}));
        setDepositError((data as any).error ?? "failed to credit deposit");
      }
    } catch (err: any) {
      if (err?.code !== "DEPOSIT_DISMISSED") {
        setDepositError(getDisplayMessage(err) ?? "deposit failed");
      }
    }
  }

  async function handleWithdraw() {
    if (withdrawing || !points || points <= 0) return;
    setWithdrawing(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/me/withdraw", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cents: points }),
    });
    const data = await res.json();
    if (res.ok) {
      setWithdrawSuccess(`${centsToDisplay(points)} sent to your wallet!`);
      setPoints(data.new_balance);
      setTimeout(() => setWithdrawSuccess(null), 5000);
    } else {
      setWithdrawError(data.error ?? "withdrawal failed");
    }
    setWithdrawing(false);
  }


  async function togglePrivacy() {
    const next = !isPrivate;
    setIsPrivate(next);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ is_private: next }),
    });
    if (!res.ok) setIsPrivate(!next);
  }

  async function handleFollowRequest(requesterId: string, action: "accept" | "decline") {
    const token = await getAccessToken();
    const method = action === "accept" ? "POST" : "DELETE";
    const res = await fetch(`/api/v1/me/follow-requests/${encodeURIComponent(requesterId)}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setFollowRequests((prev) => prev.filter((r) => r.user_id !== requesterId));
      if (action === "accept") setFollowerCount((c) => c + 1);
    }
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
                <div className="flex gap-4 mt-1.5">
                  <span className="text-[13px]" style={{ color: "var(--muted)" }}>
                    <span className="font-bold" style={{ color: "var(--text)" }}>{followerCount.toLocaleString()}</span>{" "}followers
                  </span>
                  <span className="text-[13px]" style={{ color: "var(--muted)" }}>
                    <span className="font-bold" style={{ color: "var(--text)" }}>{followingCount.toLocaleString()}</span>{" "}following
                  </span>
                </div>
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
        {/* Follow requests */}
        {followRequests.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
          >
            <p className="text-[12px] font-semibold px-4 pt-4 pb-2" style={{ color: "var(--dimmer)" }}>
              follow requests ({followRequests.length})
            </p>
            <div className="flex flex-col divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {followRequests.map((r) => {
                const rname = r.display_name ?? r.username ?? "unknown";
                return (
                  <div key={r.user_id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[14px] font-black overflow-hidden"
                      style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "var(--font-nunito)" }}
                    >
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        rname[0]?.toUpperCase() ?? "?"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold leading-tight truncate">{rname}</p>
                      {r.username && (
                        <p className="text-[12px]" style={{ color: "var(--muted)" }}>@{r.username}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleFollowRequest(r.user_id, "accept")}
                        className="px-3 py-1.5 rounded-full font-bold text-[12px] text-white"
                        style={{ background: "var(--accent)" }}
                      >
                        accept
                      </button>
                      <button
                        onClick={() => handleFollowRequest(r.user_id, "decline")}
                        className="px-3 py-1.5 rounded-full font-bold text-[12px]"
                        style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}
                      >
                        decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            {points !== null ? centsToDisplay(points) : "—"}
          </p>
          <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>USDC available</p>
          {staked > 0 && (
            <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
              + {centsToDisplay(staked)} in {stats?.pending} open {stats?.pending === 1 ? "prediction" : "predictions"}
            </p>
          )}
          {points !== null && points > 0 && (
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="mt-3 self-start text-[13px] font-bold px-4 py-2 rounded-xl disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
            >
              {withdrawing ? "sending..." : "withdraw to wallet"}
            </button>
          )}
          {withdrawSuccess && <p className="text-[12px] mt-1 font-bold" style={{ color: "var(--win)" }}>{withdrawSuccess}</p>}
          {withdrawError && <p className="text-[12px] mt-1" style={{ color: "var(--accent)" }}>{withdrawError}</p>}
        </div>

        {/* Web3 Identity */}
        <div className="rounded-2xl overflow-hidden flex flex-col gap-0" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
          <p className="text-[11px] font-semibold px-4 pt-4 pb-3 uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>web3 identity</p>

          {/* ENS */}
          <div className="px-4 pb-4 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2 pt-3">
              <span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>ENS</span>
              {ensName && <a href={`https://app.ens.domains/${ensName}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>{ensName}</a>}
            </div>
            {ensName ? (
              <button onClick={unlinkEns} disabled={ensLoading} className="self-start text-[12px] font-semibold px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "var(--muted)", border: "1px solid var(--border-soft)" }}>
                {ensLoading ? "unlinking..." : "unlink"}
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl px-3 py-2 text-[13px] outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                  placeholder="yourname.eth"
                  value={ensInput}
                  onChange={(e) => { setEnsInput(e.target.value); setEnsError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && linkEns()}
                />
                <button onClick={linkEns} disabled={!ensInput.trim() || ensLoading} className="px-3 py-2 rounded-xl font-bold text-[13px] text-white disabled:opacity-40" style={{ background: "rgba(99,102,241,0.7)" }}>
                  {ensLoading ? "..." : "link"}
                </button>
              </div>
            )}
            {ensError && <p className="text-[12px]" style={{ color: "var(--accent)" }}>{ensError}</p>}
          </div>

        </div>

        {/* Blink Deposit */}
        <div
          className="rounded-2xl flex flex-col gap-3 p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--dimmer)" }}>
              add funds
            </p>
            {depositSuccess && (
              <span className="text-[12px] font-bold" style={{ color: "var(--win)" }}>{depositSuccess}</span>
            )}
          </div>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>
            deposit USDC on Base — instantly credited to your balance
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([5, 10, 25] as const).map((amt) => (
              <button
                key={amt}
                onClick={() => handleDeposit(amt)}
                disabled={blinkStatus === "iframe-active" || blinkStatus === "signer-loading"}
                className="flex items-center justify-center py-3 rounded-xl font-black disabled:opacity-50 transition-opacity text-[17px]"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-soft)", color: "var(--text)", fontFamily: "var(--font-nunito)" }}
              >
                ${amt}
              </button>
            ))}
          </div>
          {depositError && (
            <p className="text-[12px]" style={{ color: "var(--accent)" }}>{depositError}</p>
          )}
          {(blinkStatus === "signer-loading" || blinkStatus === "iframe-active") && (
            <p className="text-[12px]" style={{ color: "var(--dimmer)" }}>opening deposit...</p>
          )}
          {lastTransferId && TREASURY_ADDRESS && (
            <div className="flex flex-col gap-1">
              <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>
                transfer id: <span className="font-mono">{lastTransferId}</span>
              </p>
              <a
                href={`https://basescan.org/address/${TREASURY_ADDRESS}#tokentxns`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold"
                style={{ color: "#818cf8" }}
              >
                view on Base ↗
              </a>
            </div>
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
                        {entry.event_name} · {entry.pick} · {centsToDisplay(entry.points_staked)}
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

        {/* Private account toggle */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)" }}
        >
          <div>
            <p className="font-semibold text-[14px]">private account</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
              {isPrivate ? "followers must be approved" : "anyone can follow you"}
            </p>
          </div>
          <button
            onClick={togglePrivacy}
            className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
            style={{ background: isPrivate ? "var(--accent)" : "rgba(255,255,255,0.12)" }}
            aria-label="toggle private account"
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: isPrivate ? "translateX(20px)" : "translateX(0)" }}
            />
          </button>
        </div>

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
      <BottomNav />
    </div>
  );
}

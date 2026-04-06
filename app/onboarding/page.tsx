"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";

const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$|^[a-z0-9]{3}$/;

function OnboardingInner() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<"name" | "username">("name");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!username) { setUsernameStatus("idle"); return; }
    const u = username.toLowerCase();
    if (!USERNAME_RE.test(u)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/v1/me/username?u=${encodeURIComponent(u)}`).catch(() => null);
      if (!res) { setUsernameStatus("idle"); return; }
      const data = await res.json().catch(() => ({}));
      setUsernameStatus(data.available ? "available" : "taken");
    }, 400);
  }, [username]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: trimmed }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "something went wrong"); return; }
    setStep("username");
  }

  async function saveUsername() {
    if (usernameStatus !== "available" || saving) return;
    setSaving(true);
    setError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/me/username", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.toLowerCase() }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "something went wrong"); return; }
    const redirect = searchParams.get("redirect");
    router.replace(redirect ?? "/events");
  }

  function skip() {
    const redirect = searchParams.get("redirect");
    router.replace(redirect ?? "/events");
  }

  const hint = (() => {
    if (!username) return null;
    if (usernameStatus === "invalid") return { text: "3–20 chars, lowercase, letters/numbers/. and _ only", color: "var(--muted)" };
    if (usernameStatus === "checking") return { text: "checking...", color: "var(--dimmer)" };
    if (usernameStatus === "available") return { text: `@${username.toLowerCase()} is available ✓`, color: "var(--win)" };
    if (usernameStatus === "taken") return { text: "taken", color: "var(--accent)" };
    return null;
  })();

  if (!ready) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="w-full max-w-sm flex flex-col gap-6">
        {step === "name" ? (
          <>
            <div>
              <h1 className="text-[32px] font-black tracking-tight mb-1" style={{ fontFamily: "var(--font-nunito)" }}>
                what should we call you?
              </h1>
              <p className="text-[14px]" style={{ color: "var(--muted)" }}>
                this shows up when you bet with friends
              </p>
            </div>

            <input
              className="rounded-2xl px-4 py-4 text-[18px] font-bold outline-none w-full"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
              placeholder="your name"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              autoFocus
            />

            {error && <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{error}</p>}

            <button
              onClick={saveName}
              disabled={!name.trim() || saving}
              className="w-full py-4 rounded-2xl font-black text-[16px] text-white disabled:opacity-35"
              style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              {saving ? "saving..." : "next →"}
            </button>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-[32px] font-black tracking-tight mb-1" style={{ fontFamily: "var(--font-nunito)" }}>
                pick a username
              </h1>
              <p className="text-[14px]" style={{ color: "var(--muted)" }}>
                so friends can tag you in bets. you can change it later.
              </p>
            </div>

            <div
              className="flex items-center rounded-2xl px-4 gap-1"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent-border)" }}
            >
              <span className="text-[18px] font-bold" style={{ color: "var(--accent)" }}>@</span>
              <input
                className="flex-1 py-4 text-[18px] font-bold outline-none bg-transparent"
                style={{ color: "var(--text)" }}
                placeholder="yourhandle"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              {usernameStatus === "checking" && <span className="text-[13px]" style={{ color: "var(--dimmer)" }}>...</span>}
              {usernameStatus === "available" && <span style={{ color: "var(--win)" }}>✓</span>}
              {usernameStatus === "taken" && <span style={{ color: "var(--accent)" }}>✕</span>}
            </div>

            {hint && <p className="text-[13px] font-semibold" style={{ color: hint.color }}>{hint.text}</p>}
            {error && <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{error}</p>}

            <button
              onClick={saveUsername}
              disabled={usernameStatus !== "available" || saving}
              className="w-full py-4 rounded-2xl font-black text-[16px] text-white disabled:opacity-35"
              style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              {saving ? "saving..." : "let's go →"}
            </button>

            <button onClick={skip} className="text-center text-[14px] font-semibold" style={{ color: "var(--dimmer)" }}>
              skip for now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  );
}

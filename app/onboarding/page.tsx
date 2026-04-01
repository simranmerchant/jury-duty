"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function OnboardingInner() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  async function save() {
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
    if (!res.ok) {
      setError(data.error ?? "something went wrong");
      setSaving(false);
      return;
    }
    const redirect = searchParams.get("redirect");
    router.replace(redirect ?? "/events");
  }

  if (!ready) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div>
          <h1
            className="text-[32px] font-black tracking-tight mb-1"
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            what should we call you?
          </h1>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            this shows up when you bet with friends
          </p>
        </div>

        <input
          className="rounded-2xl px-4 py-4 text-[18px] font-bold outline-none w-full"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--accent-border)",
            color: "var(--text)",
          }}
          placeholder="your name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          autoFocus
        />

        {error && (
          <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{error}</p>
        )}

        <button
          onClick={save}
          disabled={!name.trim() || saving}
          className="w-full py-4 rounded-2xl font-black text-[16px] text-white disabled:opacity-35"
          style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
        >
          {saving ? "saving..." : "let's go →"}
        </button>
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

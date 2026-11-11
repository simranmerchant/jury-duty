"use client";

import { useAuth } from "@/lib/auth-client";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

const ROW1 = ["weddings", "nights out", "birthdays", "bachelorettes", "watch parties", "poker night", "weddings", "nights out", "birthdays", "bachelorettes", "watch parties", "poker night"];
const ROW2 = ["playoffs", "karaoke", "road trips", "concerts", "game night", "playoffs", "karaoke", "road trips", "concerts", "game night"];

function MarqueeRow({ items, reverse }: { items: string[]; reverse?: boolean }) {
  return (
    <div className="overflow-hidden">
      <div className={`flex gap-2 w-max ${reverse ? "marquee-right" : "marquee-left"}`}>
        {items.map((label, i) => (
          <div
            key={i}
            className="h-[30px] px-4 rounded-full flex items-center text-[12px] font-medium whitespace-nowrap flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--muted)" }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

type Step = "landing" | "phone" | "otp" | "loading";

function LoginInner() {
  const { ready, authenticated, getAccessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("landing");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) return;
    getAccessToken().then((token) => {
      if (!token) return;
      fetch("/api/v1/auth/init", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          const redirect = searchParams.get("redirect");
          if (!data.hasName) {
            router.replace(`/onboarding${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`);
          } else {
            router.replace(redirect ?? "/events");
          }
        });
    });
  }, [ready, authenticated, getAccessToken, router, searchParams]);

  function startCooldown() {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((n) => {
        if (n <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return n - 1;
      });
    }, 1000);
  }

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("1") && digits.length <= 11
      ? `+${digits}`
      : digits.length >= 10 ? `+1${digits.slice(-10)}` : `+1${digits}`;
  }

  async function sendOtp() {
    setError(null);
    const formatted = formatPhone(phone);
    if (formatted.replace(/\D/g, "").length < 11) { setError("enter a valid phone number"); return; }
    setSending(true);
    const { error: err } = await supabaseBrowser.auth.signInWithOtp({ phone: formatted });
    setSending(false);
    if (err) { setError(err.message); return; }
    setStep("otp");
    startCooldown();
  }

  async function verifyOtp() {
    setError(null);
    if (otp.length < 6) { setError("enter the 6-digit code"); return; }
    const formatted = formatPhone(phone);
    setVerifying(true);
    const { error: err } = await supabaseBrowser.auth.verifyOtp({ phone: formatted, token: otp, type: "sms" });
    setVerifying(false);
    if (err) { setError("invalid code — try again"); return; }
    setStep("loading");
  }

  if (!ready || step === "loading") {
    return <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg)" }} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10">
      {/* Wordmark */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-[42px] font-black tracking-tight leading-none" style={{ fontFamily: "var(--font-nunito)" }}>
          jury<span style={{ color: "var(--accent)", fontStyle: "italic" }}>duty</span>
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>predict anything with friends</p>
      </div>

      {/* Marquee */}
      <div className="w-full flex flex-col gap-2">
        <MarqueeRow items={ROW1} />
        <MarqueeRow items={ROW2} reverse />
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm px-6 flex flex-col gap-3">
        {step === "landing" && (
          <>
            <button
              onClick={() => setStep("phone")}
              className="w-full py-4 rounded-2xl font-black text-white text-[16px]"
              style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              get started
            </button>
            <p className="text-center text-[12px]" style={{ color: "var(--dimmer)" }}>
              we'll text you a one-time code — no password needed
            </p>
          </>
        )}

        {step === "phone" && (
          <>
            <input
              type="tel"
              autoFocus
              placeholder="phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendOtp()}
              className="w-full py-4 px-5 rounded-2xl text-[16px] font-bold outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
            />
            {error && <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{error}</p>}
            <button
              onClick={sendOtp}
              disabled={sending}
              className="w-full py-4 rounded-2xl font-black text-white text-[16px] disabled:opacity-40"
              style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              {sending ? "sending..." : "send code"}
            </button>
            <button onClick={() => setStep("landing")} className="text-center text-[13px] font-semibold" style={{ color: "var(--dimmer)" }}>back</button>
          </>
        )}

        {step === "otp" && (
          <>
            <p className="text-center text-[14px]" style={{ color: "var(--muted)" }}>
              code sent to {phone}
            </p>
            <input
              type="number"
              autoFocus
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
              className="w-full py-4 px-5 rounded-2xl text-[16px] font-bold outline-none text-center tracking-widest"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
            />
            {error && <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{error}</p>}
            <button
              onClick={verifyOtp}
              disabled={verifying}
              className="w-full py-4 rounded-2xl font-black text-white text-[16px] disabled:opacity-40"
              style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              {verifying ? "verifying..." : "verify"}
            </button>
            <button
              onClick={() => { if (resendCooldown === 0) sendOtp(); }}
              disabled={resendCooldown > 0 || sending}
              className="text-center text-[13px] font-semibold disabled:opacity-40"
              style={{ color: "var(--dimmer)" }}
            >
              {resendCooldown > 0 ? `resend in ${resendCooldown}s` : "resend code"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

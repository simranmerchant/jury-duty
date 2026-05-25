"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";

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

function LoginInner() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ready || !authenticated) return;

    getAccessToken().then((token) => {
      fetch("/api/v1/auth/init", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()).then((data) => {
        const redirect = searchParams.get("redirect");
        if (!data.hasName) {
          router.replace(`/onboarding${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`);
        } else {
          router.replace(redirect ?? "/events");
        }
      });
    });
  }, [ready, authenticated, getAccessToken, router, searchParams]);

  // Auto-open login modal when coming from an invite link — skip the extra tap
  // Use a ref so login() is only called once; Privy updates the login reference
  // during the auth flow which would otherwise re-trigger this and reset the modal.
  const loginCalled = useRef(false);
  useEffect(() => {
    if (!ready || authenticated || loginCalled.current) return;
    const redirect = searchParams.get("redirect");
    if (redirect?.startsWith("/join/")) {
      loginCalled.current = true;
      login();
    }
  }, [ready, authenticated, login, searchParams]);

  if (!ready) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10">
      {/* Wordmark */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-[42px] font-black tracking-tight leading-none" style={{ fontFamily: "var(--font-nunito)" }}>
          jury<span style={{ color: "var(--accent)", fontStyle: "italic" }}>duty</span>
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>bet on anything with friends</p>
      </div>

      {/* Marquee */}
      <div className="w-full flex flex-col gap-2">
        <MarqueeRow items={ROW1} />
        <MarqueeRow items={ROW2} reverse />
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm px-6 flex flex-col gap-3">
        <button
          onClick={login}
          className="w-full py-4 rounded-2xl font-black text-white text-[16px]"
          style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
        >
          get started
        </button>
        <p className="text-center text-[12px]" style={{ color: "var(--dimmer)" }}>
          we'll text you a one-time code — no password needed
        </p>
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

"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

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
  useEffect(() => {
    if (!ready || authenticated) return;
    const redirect = searchParams.get("redirect");
    if (redirect?.startsWith("/join/")) {
      login();
    }
  }, [ready, authenticated, login, searchParams]);

  if (!ready) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <h1
          className="text-4xl font-black tracking-tight"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          jury<span style={{ color: "var(--accent)" }}>duty</span>
        </h1>
        <p className="text-center" style={{ color: "var(--muted)", fontSize: 15 }}>
          you've been summoned.
        </p>
        <button
          onClick={login}
          className="w-full py-4 rounded-2xl font-bold text-white text-lg"
          style={{
            background: "var(--accent)",
            fontFamily: "var(--font-nunito)",
          }}
        >
          Get started
        </button>
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

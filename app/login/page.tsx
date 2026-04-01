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
      }).then(() => {
        const redirect = searchParams.get("redirect");
        router.replace(redirect ?? "/events");
      });
    });
  }, [ready, authenticated, getAccessToken, router, searchParams]);

  if (!ready) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <h1
          className="text-4xl font-black tracking-tight"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          betsy<span style={{ color: "var(--accent)" }}>gal</span>
        </h1>
        <p className="text-center" style={{ color: "var(--muted)", fontSize: 15 }}>
          make bets with your friends
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

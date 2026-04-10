"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

type EventPreview = {
  id: string;
  name: string;
  ends_at: string;
  guest_count: number;
};

function JoinPageInner() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const inviteToken = params.token as string;
  const betId = searchParams.get("bet");

  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always fetch preview — no auth needed
  useEffect(() => {
    fetch(`/api/v1/join?token=${inviteToken}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.event) setPreview(data.event);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [inviteToken]);

  // If user is already authenticated and lands here, join immediately
  useEffect(() => {
    if (!ready || !authenticated || !preview) return;
    joinEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, preview]);

  async function joinEvent() {
    setJoining(true);
    setError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invite_token: inviteToken, ...(betId ? { bet_id: betId } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "something went wrong");
      setJoining(false);
      return;
    }
    router.replace(`/e/${data.eventId}`);
  }

  function handleGetStarted() {
    const destination = betId ? `/join/${inviteToken}?bet=${betId}` : `/join/${inviteToken}`;
    router.push(`/login?redirect=${encodeURIComponent(destination)}`);
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
        <p className="text-[17px] font-bold" style={{ color: "var(--muted)" }}>
          invite link not found
        </p>
        <button
          onClick={() => router.push("/events")}
          className="text-sm"
          style={{ color: "var(--accent)" }}
        >
          go to your events
        </button>
      </div>
    );
  }

  if (!preview) {
    // Loading state
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
      </div>
    );
  }

  const isClosed = new Date(preview.ends_at) < new Date();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        {/* Wordmark */}
        <p className="text-[15px] font-black" style={{ fontFamily: "var(--font-nunito)", color: "var(--dimmer)" }}>
          jury<span style={{ color: "var(--accent)" }}>duty</span>
        </p>

        {/* Event card */}
        <div
          className="w-full rounded-3xl p-6 flex flex-col gap-2"
          style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
        >
          <p className="text-[22px] font-black leading-tight" style={{ fontFamily: "var(--font-nunito)" }}>
            {preview.name}
          </p>
          <div className="flex items-center justify-center gap-3 text-[13px]" style={{ color: "var(--muted)" }}>
            <span>
              {preview.guest_count} {preview.guest_count === 1 ? "guest" : "guests"}
            </span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span style={{ color: isClosed ? "var(--muted)" : "var(--accent)" }}>
              {isClosed
                ? "closed"
                : `closes ${new Date(preview.ends_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
            </span>
          </div>
        </div>

        {/* CTA */}
        {error && (
          <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>
            {error}
          </p>
        )}

        {!authenticated ? (
          <button
            onClick={handleGetStarted}
            className="w-full py-4 rounded-2xl font-black text-[16px] text-white"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
          >
            get started to join
          </button>
        ) : joining ? (
          <div className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <div
              className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)" }}
            />
            <span className="text-[14px]">joining...</span>
          </div>
        ) : (
          <button
            onClick={joinEvent}
            className="w-full py-4 rounded-2xl font-black text-[16px] text-white"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
          >
            join event
          </button>
        )}

        {!authenticated && (
          <p className="text-[12px]" style={{ color: "var(--dimmer)" }}>
            you'll be asked for your phone number — that's it
          </p>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  );
}

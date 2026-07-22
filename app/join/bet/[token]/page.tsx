"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

const APP_STORE_ID = "6770705837";
const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

type BetPreview = {
  id: string;
  question: string;
  deadline: string;
  status: string;
  creator_name: string;
  creator_avatar: string | null;
  entry_count: number;
};

function JoinBetInner() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const router = useRouter();
  const params = useParams();
  const inviteToken = params.token as string;

  const [preview, setPreview] = useState<BetPreview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    fetch(`/api/v1/join/bet?token=${inviteToken}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.bet) setPreview(data.bet);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [inviteToken]);

  useEffect(() => {
    if (!ready || !authenticated || !preview || joined) return;
    joinBet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, preview]);

  async function joinBet() {
    setJoining(true);
    setError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/join/bet", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invite_token: inviteToken }),
    });
    const data = await res.json();
    setJoining(false);
    if (!res.ok) {
      setError(data.error ?? "something went wrong");
      return;
    }
    setJoined(true);
  }

  function handleGetStarted() {
    router.push(`/login?redirect=${encodeURIComponent(`/join/bet/${inviteToken}`)}`);
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
      </div>
    );
  }

  const isClosed = preview.status === "resolved" || new Date(preview.deadline) < new Date();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <p className="text-[15px] font-black" style={{ fontFamily: "var(--font-nunito)", color: "var(--dimmer)" }}>
          jury<span style={{ color: "var(--accent)" }}>duty</span>
        </p>

        <div
          className="w-full rounded-3xl p-6 flex flex-col gap-3"
          style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
        >
          <div className="flex items-center gap-2 justify-center">
            {preview.creator_avatar ? (
              <img src={preview.creator_avatar} className="w-7 h-7 rounded-full" alt="" />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {preview.creator_name[0]?.toUpperCase()}
              </div>
            )}
            <p className="text-[13px] font-semibold" style={{ color: "var(--muted)" }}>
              {preview.creator_name} invited you to a prediction
            </p>
          </div>

          {joined ? (
            /* Reveal the bet after joining */
            <>
              <p className="text-[20px] font-black leading-snug" style={{ fontFamily: "var(--font-nunito)" }}>
                {preview.question}
              </p>
              <div className="flex items-center justify-center gap-3 text-[13px]" style={{ color: "var(--muted)" }}>
                <span>{preview.entry_count} {preview.entry_count === 1 ? "vote" : "votes"}</span>
                <span style={{ color: "var(--border)" }}>·</span>
                <span style={{ color: isClosed ? "var(--muted)" : "var(--accent)" }}>
                  {isClosed ? "closed" : `closes ${new Date(preview.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </span>
              </div>
            </>
          ) : (
            /* Teaser — hide the question until they join */
            <div className="flex flex-col items-center gap-2 py-2">
              <div
                className="w-full h-5 rounded-full"
                style={{ background: "rgba(255,255,255,0.07)" }}
              />
              <div
                className="w-3/4 h-5 rounded-full"
                style={{ background: "rgba(255,255,255,0.07)" }}
              />
              <p className="text-[12px] mt-1" style={{ color: "var(--dimmer)" }}>
                join to see the prediction
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{error}</p>
        )}

        {joined ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-[16px] font-bold" style={{ color: "var(--win)" }}>you&apos;re in! ✓</p>
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>open the app to vote</p>
          </div>
        ) : !authenticated ? (
          <button
            onClick={handleGetStarted}
            className="w-full py-4 rounded-2xl font-black text-[16px] text-white"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
          >
            join to see the prediction
          </button>
        ) : joining ? (
          <div className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
            <span className="text-[14px]">joining...</span>
          </div>
        ) : (
          <button
            onClick={joinBet}
            className="w-full py-4 rounded-2xl font-black text-[16px] text-white"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
          >
            join to see the prediction
          </button>
        )}

        {!authenticated && (
          <p className="text-[12px]" style={{ color: "var(--dimmer)" }}>
            you&apos;ll be asked for your phone number — that&apos;s it
          </p>
        )}

        {isIOS && (
          <a
            href={APP_STORE_URL}
            className="w-full py-4 rounded-2xl font-black text-[16px] text-center block"
            style={{ background: "var(--card)", border: "1px solid var(--border-soft)", color: "var(--text)", fontFamily: "var(--font-nunito)" }}
          >
            📲 get the app for the best experience
          </a>
        )}
      </div>
    </div>
  );
}

export default function JoinBetPage() {
  return (
    <Suspense>
      <JoinBetInner />
    </Suspense>
  );
}

"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

type Guest = { userId: string; label: string };

export default function NewBetPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    getAccessToken().then((token) =>
      fetch(`/api/v1/events/${eventId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => { if (d.event?.type === "group") setIsGroup(true); })
    );
  }, [ready, authenticated, eventId, getAccessToken]);

  const fetchGuests = useCallback(async () => {
    setLoadingGuests(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/events/${eventId}/guests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setGuests(data.guests ?? []);
    setLoadingGuests(false);
  }, [eventId, getAccessToken]);

  function toggleVisibility(v: "public" | "private") {
    setVisibility(v);
    if (v === "private" && guests.length === 0) fetchGuests();
    if (v === "public") setInvitedIds([]);
  }

  function toggleInvite(userId: string) {
    setInvitedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function updateOption(i: number, val: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  }

  function addOption() {
    if (options.length >= 5) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  const canSubmit =
    question.trim().length > 0 &&
    question.trim().length <= 200 &&
    options.filter((o) => o.trim()).length >= 2 &&
    options.every((o) => o.trim().length <= 100) &&
    (!isGroup || !!deadline);

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    const token = await getAccessToken();
    const res = await fetch(`/api/v1/events/${eventId}/bets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        question: question.trim(),
        options: options.filter((o) => o.trim()),
        visibility,
        invitedUserIds: visibility === "private" ? invitedIds : [],
        ...(isGroup && deadline ? { deadline: new Date(deadline).toISOString() } : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "something went wrong");
      setSubmitting(false);
      return;
    }

    router.push(`/e/${eventId}`);
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="px-5 pt-14 pb-2">
        <button
          onClick={() => router.push(`/e/${eventId}`)}
          className="text-sm mb-5 flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          ← back
        </button>
        <h1
          className="text-[28px] font-black tracking-tight"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          add a bet
        </h1>
      </div>

      <div className="px-5 pt-4 pb-32 flex flex-col gap-6">
        {/* Question */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            question
          </label>
          <textarea
            className="rounded-2xl px-4 py-3 text-[15px] outline-none resize-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--accent-border)",
              color: "var(--text)",
              minHeight: 88,
            }}
            placeholder="who leaves the party first?"
            maxLength={200}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            autoFocus
          />
          <p className="text-[11px] text-right" style={{ color: question.length > 180 ? "var(--accent)" : "var(--dimmer)" }}>
            {question.length}/200
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            options
          </label>
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-2xl px-4 py-3 text-[15px] outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border-soft)",
                    color: "var(--text)",
                  }}
                  placeholder={i === 0 ? "Jake" : i === 1 ? "Maya" : `option ${i + 1}`}
                  maxLength={100}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ color: "var(--muted)", background: "rgba(255,255,255,0.05)" }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 5 && (
            <button
              onClick={addOption}
              className="mt-1 self-start text-[13px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
            >
              + add option
            </button>
          )}
        </div>

        {/* Deadline — groups only */}
        {isGroup && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              bet closes at
            </label>
            <input
              type="datetime-local"
              className="rounded-2xl px-4 py-3 text-[15px] outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
              min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        )}

        {/* Visibility */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            who can see this
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => toggleVisibility("public")}
              className="flex-1 py-3 rounded-2xl font-bold text-[14px]"
              style={{
                background: visibility === "public" ? "var(--accent-dim)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${visibility === "public" ? "var(--accent-border)" : "var(--border-soft)"}`,
                color: visibility === "public" ? "var(--accent)" : "var(--muted)",
              }}
            >
              all guests
            </button>
            <button
              onClick={() => toggleVisibility("private")}
              className="flex-1 py-3 rounded-2xl font-bold text-[14px]"
              style={{
                background: visibility === "private" ? "var(--purple-dim)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${visibility === "private" ? "var(--purple-border)" : "var(--border-soft)"}`,
                color: visibility === "private" ? "var(--purple)" : "var(--muted)",
              }}
            >
              invite only
            </button>
          </div>

          {visibility === "private" && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>
                select who can see and join this bet
              </p>
              {loadingGuests && (
                <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>loading guests...</p>
              )}
              {!loadingGuests && guests.length === 0 && (
                <p className="text-[13px]" style={{ color: "var(--dimmer)" }}>
                  no other guests yet — you can add people to this bet later
                </p>
              )}
              {guests.map((g) => {
                const selected = invitedIds.includes(g.userId);
                return (
                  <button
                    key={g.userId}
                    onClick={() => toggleInvite(g.userId)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
                    style={{
                      background: selected ? "var(--purple-dim)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selected ? "var(--purple-border)" : "var(--border-soft)"}`,
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{
                        background: selected ? "var(--purple)" : "rgba(255,255,255,0.1)",
                        color: selected ? "#fff" : "var(--dimmer)",
                      }}
                    >
                      {selected ? "✓" : ""}
                    </span>
                    <span className="text-[14px] font-bold">{g.label}</span>
                  </button>
                );
              })}
              {invitedIds.length === 0 && guests.length > 0 && (
                <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>you can add people now or after creating</p>
              )}
            </div>
          )}

          {visibility === "public" && (
            <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>
              all guests can see and join this bet
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="w-full py-4 rounded-2xl font-black text-[16px] text-white disabled:opacity-35"
          style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
        >
          {submitting ? "creating..." : "create bet"}
        </button>
      </div>
    </div>
  );
}

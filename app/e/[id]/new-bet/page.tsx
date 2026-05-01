"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

type Guest = { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null };
type BetOption = { label: string; tagged_user_id?: string; tagged_display_name?: string; tagged_username?: string | null };

export default function NewBetPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<BetOption[]>([{ label: "" }, { label: "" }]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [deadline, setDeadline] = useState("");

  // Option tag picker
  const [tagPickerIdx, setTagPickerIdx] = useState<number | null>(null);
  const [tagPickerSearch, setTagPickerSearch] = useState("");
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const tagPickerInputRef = useRef<HTMLInputElement>(null);

  // Question @mention
  const [questionTaggedIds, setQuestionTaggedIds] = useState<string[]>([]);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null); // null = no picker
  const [mentionFilter, setMentionFilter] = useState("");
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const mentionPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  const fetchEventData = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/events/${eventId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.event?.type === "group") setIsGroup(true);
    setMyUserId(data.userId ?? null);
    const gs: Guest[] = (data.event?.event_guests ?? []).map((g: any) => ({
      user_id: g.user_id,
      display_name: g.balances?.display_name ?? null,
      username: g.balances?.username ?? null,
      avatar_url: g.balances?.avatar_url ?? null,
    })).filter((g: Guest) => g.user_id !== data.userId);
    setGuests(gs);
  }, [eventId, getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    fetchEventData();
  }, [ready, authenticated, fetchEventData]);

  // Close option tag picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setTagPickerIdx(null);
      }
    }
    if (tagPickerIdx !== null) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagPickerIdx]);

  // Close mention picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        mentionPickerRef.current && !mentionPickerRef.current.contains(e.target as Node) &&
        questionRef.current && !questionRef.current.contains(e.target as Node)
      ) {
        setMentionSearch(null);
      }
    }
    if (mentionSearch !== null) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mentionSearch]);

  function onQuestionChange(val: string) {
    setQuestion(val);

    // Detect @mention: find last @ before cursor in the new value
    const textarea = questionRef.current;
    const cursor = textarea?.selectionStart ?? val.length;
    const textUpToCursor = val.slice(0, cursor);
    const atIndex = textUpToCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const wordAfterAt = textUpToCursor.slice(atIndex + 1);
      // Only show picker if no space in the word (still typing the mention)
      if (!wordAfterAt.includes(" ")) {
        setMentionSearch(wordAfterAt);
        setMentionFilter(wordAfterAt.toLowerCase());
        return;
      }
    }
    setMentionSearch(null);
  }

  function insertMention(guest: Guest) {
    const textarea = questionRef.current;
    const cursor = textarea?.selectionStart ?? question.length;
    const textUpToCursor = question.slice(0, cursor);
    const atIndex = textUpToCursor.lastIndexOf("@");

    const name = guest.display_name ?? guest.username ?? "unknown";
    const before = question.slice(0, atIndex);
    const after = question.slice(cursor);
    const newQuestion = `${before}@${name}${after}`;

    setQuestion(newQuestion);
    setQuestionTaggedIds((prev) => prev.includes(guest.user_id) ? prev : [...prev, guest.user_id]);
    setMentionSearch(null);

    // Restore focus and move cursor after the inserted mention
    setTimeout(() => {
      if (questionRef.current) {
        const newCursor = before.length + name.length + 1;
        questionRef.current.focus();
        questionRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  }

  const mentionGuests = guests.filter((g) =>
    !mentionFilter ||
    g.display_name?.toLowerCase().includes(mentionFilter) ||
    g.username?.toLowerCase().includes(mentionFilter)
  );

  function updateOptionLabel(i: number, val: string) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, label: val } : o));
  }

  function tagOption(i: number, guest: Guest) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? {
      label: guest.display_name ?? guest.username ?? "?",
      tagged_user_id: guest.user_id,
      tagged_display_name: guest.display_name ?? undefined,
      tagged_username: guest.username,
    } : o));
    setTagPickerIdx(null);
  }

  function untagOption(i: number) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { label: o.tagged_display_name ?? o.label } : o));
  }

  function addOption() {
    if (options.length >= 5) return;
    setOptions((prev) => [...prev, { label: "" }]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toggleInvite(userId: string) {
    setInvitedIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  }

  const filledOptions = options.filter((o) => o.label.trim() || o.tagged_user_id);
  const canSubmit =
    question.trim().length > 0 &&
    question.trim().length <= 200 &&
    filledOptions.length >= 2 &&
    options.every((o) => (o.label.trim() || o.tagged_user_id) && o.label.trim().length <= 100) &&
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
        options: options
          .filter((o) => o.label.trim() || o.tagged_user_id)
          .map((o) => ({ label: o.label.trim(), tagged_user_id: o.tagged_user_id })),
        visibility,
        invitedUserIds: visibility === "private" ? invitedIds : [],
        question_tagged_user_ids: questionTaggedIds,
        ...(isGroup && deadline ? { deadline: new Date(deadline).toISOString() } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "something went wrong"); setSubmitting(false); return; }
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
        <h1 className="text-[28px] font-black tracking-tight" style={{ fontFamily: "var(--font-nunito)" }}>
          add a bet
        </h1>
      </div>

      <div className="px-5 pt-4 pb-32 flex flex-col gap-6">
        {/* Question */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
            question
          </label>
          <div className="relative">
            <textarea
              ref={questionRef}
              className="w-full rounded-2xl px-4 py-3 text-[15px] outline-none resize-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--accent-border)",
                color: "var(--text)",
                minHeight: 88,
              }}
              placeholder="who leaves the party first?"
              maxLength={200}
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              autoFocus
            />

            {/* @mention picker */}
            {mentionSearch !== null && mentionGuests.length > 0 && (
              <div
                ref={mentionPickerRef}
                className="absolute left-0 top-full mt-1 w-full rounded-2xl z-10 overflow-hidden"
                style={{ background: "var(--card)", border: "1px solid var(--border-soft)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
              >
                {mentionGuests.slice(0, 5).map((g) => (
                  <button
                    key={g.user_id}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(g); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0"
                      style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                    >
                      {g.display_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold">{g.display_name ?? "anonymous"}</p>
                      {g.username && <p className="text-[11px]" style={{ color: "var(--muted)" }}>@{g.username}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-right" style={{ color: question.length > 180 ? "var(--accent)" : "var(--dimmer)" }}>
            {question.length}/200
            {guests.length > 0 && <span className="ml-2" style={{ color: "var(--dimmer)" }}>· type @ to mention someone</span>}
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
            options
          </label>
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <div key={i} className="relative flex items-center gap-2">
                {opt.tagged_user_id ? (
                  <div
                    className="flex-1 flex items-center gap-2 rounded-2xl px-4 py-3"
                    style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 overflow-hidden"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      {opt.tagged_display_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="flex-1 min-w-0 text-[15px] font-bold truncate" style={{ color: "var(--accent)" }}>
                      {opt.tagged_display_name ?? opt.label}
                    </span>
                    <button
                      onClick={() => untagOption(i)}
                      className="text-[13px] font-bold flex-shrink-0"
                      style={{ color: "var(--muted)" }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex-1 flex items-center rounded-2xl overflow-hidden"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${tagPickerIdx === i ? "var(--accent-border)" : "var(--border-soft)"}`,
                    }}
                  >
                    <input
                      className="flex-1 px-4 py-3 text-[15px] outline-none bg-transparent"
                      style={{ color: "var(--text)" }}
                      placeholder={i === 0 ? "Jake" : i === 1 ? "Maya" : `option ${i + 1}`}
                      maxLength={100}
                      value={opt.label}
                      onChange={(e) => updateOptionLabel(i, e.target.value)}
                    />
                    {guests.length > 0 && (
                      <button
                        onClick={() => {
                          if (tagPickerIdx === i) {
                            setTagPickerIdx(null);
                          } else {
                            setTagPickerIdx(i);
                            setTagPickerSearch("");
                            setTimeout(() => tagPickerInputRef.current?.focus(), 50);
                          }
                        }}
                        className="px-3 py-3 flex items-center justify-center flex-shrink-0"
                        style={{
                          borderLeft: "1px solid var(--border-soft)",
                          color: tagPickerIdx === i ? "var(--accent)" : "var(--dimmer)",
                          background: tagPickerIdx === i ? "var(--accent-dim)" : "transparent",
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ color: "var(--muted)", background: "rgba(255,255,255,0.05)" }}
                  >
                    ×
                  </button>
                )}

                {tagPickerIdx === i && (
                  <div
                    ref={tagPickerRef}
                    className="absolute left-0 top-full mt-1 w-full rounded-2xl z-10 flex flex-col"
                    style={{ background: "var(--card)", border: "1px solid var(--border-soft)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxHeight: 260 }}
                  >
                    <div className="px-3 pt-3 pb-2 flex-shrink-0">
                      <input
                        ref={tagPickerInputRef}
                        type="text"
                        placeholder="search..."
                        value={tagPickerSearch}
                        onChange={(e) => setTagPickerSearch(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-[14px] outline-none"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                      />
                    </div>
                    <div className="overflow-y-auto flex-1 pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
                      {guests
                        .filter((g) => {
                          const q = tagPickerSearch.toLowerCase();
                          return !q || g.display_name?.toLowerCase().startsWith(q) || g.username?.toLowerCase().startsWith(q);
                        })
                        .map((g) => (
                          <button
                            key={g.user_id}
                            onClick={() => { tagOption(i, g); setTagPickerSearch(""); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0"
                              style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                            >
                              {g.display_name?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <p className="text-[14px] font-bold">{g.display_name ?? "anonymous"}</p>
                              {g.username && <p className="text-[11px]" style={{ color: "var(--muted)" }}>@{g.username}</p>}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
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
            <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
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
          <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
            who can see this
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => { setVisibility("public"); setInvitedIds([]); }}
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
              onClick={() => setVisibility("private")}
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

          {visibility === "private" && guests.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>select who can see and join this bet</p>
              {guests.map((g) => {
                const selected = invitedIds.includes(g.user_id);
                return (
                  <button
                    key={g.user_id}
                    onClick={() => toggleInvite(g.user_id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
                    style={{
                      background: selected ? "var(--purple-dim)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selected ? "var(--purple-border)" : "var(--border-soft)"}`,
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: selected ? "var(--purple)" : "rgba(255,255,255,0.1)", color: selected ? "#fff" : "var(--dimmer)" }}
                    >
                      {selected ? "✓" : ""}
                    </span>
                    <div>
                      <p className="text-[14px] font-bold">{g.display_name ?? "anonymous"}</p>
                      {g.username && <p className="text-[11px]" style={{ color: "var(--muted)" }}>@{g.username}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {visibility === "public" && (
            <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>all guests can see and join this bet</p>
          )}
        </div>

        {error && <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{error}</p>}

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

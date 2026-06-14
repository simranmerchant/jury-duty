"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { filterTagPickerGuests } from "../../../lib/tag-picker";
import { parseQuestion, extractTaggedUserIds, insertMentionAt, removeMention, getWordTokens } from "../../../lib/question-tags";
import { centsToDisplay } from "../../../lib/usdc";

type BetOption = { id: string; label: string; tagged_user_id?: string | null; balances?: { display_name: string | null; avatar_url: string | null; username?: string | null } | null };
type BetEntry = { id: string; user_id: string; option_id: string; points_staked: number; is_anonymous: boolean; balances?: { display_name: string | null; avatar_url: string | null } };
type BetInvite = { user_id: string };
type BetComment = { id: string; body: string; created_at: string; user_id: string; parent_id?: string | null; balances?: { display_name: string | null; avatar_url: string | null; username?: string | null } | null; comment_likes?: { user_id: string }[] };
type BetReaction = { user_id: string; emoji: string };
type Bet = {
  id: string;
  question: string;
  question_tagged_user_ids: string[] | null;
  deadline: string;
  visibility: "public" | "private";
  status: "open" | "resolved";
  winning_option_id: string | null;
  creator_id: string;
  created_at: string;
  walrus_blob_id: string | null;
  isNew: boolean;
  bet_options: BetOption[];
  bet_entries: BetEntry[];
  bet_invites: BetInvite[];
  bet_reactions: BetReaction[];
  bet_comments?: { id: string }[];
};
type Guest = { user_id: string; balances?: { display_name: string | null; avatar_url: string | null; username?: string | null } };
type Event = {
  id: string;
  name: string;
  ends_at: string | null;
  type: "event" | "group";
  host_id: string;
  invite_token: string;
  cover_url: string | null;
  event_guests: Guest[];
  bets: Bet[];
};

export default function EventPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Edit event
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  async function saveEvent() {
    if (savingEvent) return;
    setSavingEvent(true);
    const token = await getAccessToken();
    await fetch(`/api/v1/events/${eventId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, ends_at: editEndsAt || undefined }),
    });
    setSavingEvent(false);
    setShowEditEvent(false);
    fetchEvent();
  }

  // Add people to event
  const [showAddGuests, setShowAddGuests] = useState(false);
  const [contacts, setContacts] = useState<{ user_id: string; balances: { display_name: string | null; avatar_url: string | null; username?: string | null } }[]>([]);
  const [addSelected, setAddSelected] = useState<string[]>([]);
  const [addingGuests, setAddingGuests] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const addSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function openAddGuests() {
    setShowAddGuests(true);
    setAddSearch("");
    setSearchResults([]);
    if (contacts.length > 0) return;
    const token = await getAccessToken();
    const res = await fetch("/api/v1/me/contacts", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setContacts(data.contacts ?? []);
  }

  async function onAddSearch(q: string) {
    setAddSearch(q);
    if (addSearchTimer.current) clearTimeout(addSearchTimer.current);
    if (!q.trim()) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    addSearchTimer.current = setTimeout(async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/v1/users/search?q=${encodeURIComponent(q.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setSearchResults(data.users ?? []);
      setSearchLoading(false);
    }, 350);
  }

  async function submitAddGuests() {
    if (addSelected.length === 0 || addingGuests) return;
    setAddingGuests(true);
    const token = await getAccessToken();
    await fetch(`/api/v1/events/${eventId}/guests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: addSelected }),
    });
    setAddingGuests(false);
    setShowAddGuests(false);
    setAddSelected([]);
    fetchEvent();
  }

  const fetchEvent = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const [res, meRes] = await Promise.all([
        fetch(`/api/v1/events/${eventId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/v1/me", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (res.status === 404) { router.replace("/events"); return; }
      const data = await res.json();
      const meData = await meRes.json();
      if (!res.ok) { setFetchError(data.error ?? `error ${res.status}`); setLoading(false); return; }
      setEvent(data.event);
      setUserId(data.userId);
      setUserPoints(meData.points ?? null);
      setLoading(false);
      // Mark event as seen
      fetch(`/api/v1/events/${eventId}/seen`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      setFetchError(String(e));
      setLoading(false);
    }
  }, [eventId, getAccessToken, router]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    fetchEvent();
    // Opened via push notification click — mark all notifications as read silently
    if (searchParams.get("from") === "push") {
      getAccessToken().then((token) => {
        if (token) fetch("/api/v1/me/notifications", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      });
    }
  }, [ready, authenticated, router, fetchEvent, searchParams]);

  async function deleteEvent() {
    setDeleting(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) router.replace("/events");
    else setDeleting(false);
  }

  async function shareInvite() {
    const url = `${window.location.origin}/join/${event!.invite_token}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join "${event!.name}" on jury duty`,
          text: "you've been summoned. 🫵",
          url,
        });
      } catch {
        // user dismissed — no-op
      }
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function copyInviteCode() {
    const url = `${window.location.origin}/join/${event!.invite_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function uploadCover(file: File) {
    if (!file.type.startsWith("image/")) return;
    setCoverUploading(true);
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.src = objUrl;
    await new Promise<void>((r) => { img.onload = () => r(); });
    URL.revokeObjectURL(objUrl);
    const MAX = 1400;
    let { width, height } = img;
    if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
    if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
    const formData = new FormData();
    formData.append("file", blob, "cover.jpg");
    const token = await getAccessToken();
    await fetch(`/api/v1/events/${eventId}/cover`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    setCoverUploading(false);
    fetchEvent();
  }

  if (!ready || loading) return null;
  if (fetchError) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <p className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>something went wrong</p>
      <p className="text-[12px] text-center" style={{ color: "var(--muted)" }}>{fetchError}</p>
      <button onClick={() => router.push("/events")} className="text-[13px] font-bold mt-2" style={{ color: "var(--accent)" }}>← back to events</button>
    </div>
  );
  if (!event) return null;

  const isHost = userId === event.host_id;
  const isGroup = event.type === "group";
  const isClosed = !isGroup && !!event.ends_at && new Date(event.ends_at) < new Date();
  const guestCount = event.event_guests?.length ?? 0;
  const openBets = (event.bets?.filter((b) => b.status === "open") ?? []).slice().reverse();
  const resolvedBets = (event.bets?.filter((b) => b.status === "resolved") ?? []).slice().reverse();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Add guests modal */}
      {showAddGuests && (() => {
        const currentGuestIds = new Set(event.event_guests.map((g) => g.user_id));
        const displayList = addSearch.trim()
          ? searchResults.filter((r) => !currentGuestIds.has(r.user_id)).map((r) => ({ user_id: r.user_id, name: r.display_name ?? r.username ?? "unknown", avatar_url: r.avatar_url, username: r.username }))
          : contacts.filter((c) => !currentGuestIds.has(c.user_id)).map((c) => ({ user_id: c.user_id, name: c.balances?.display_name ?? "unknown", avatar_url: c.balances?.avatar_url ?? null, username: c.balances?.username ?? null }));
        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAddGuests(false); setAddSelected([]); setAddSearch(""); setSearchResults([]); } }}
          >
            <div className="w-full max-w-lg rounded-t-3xl flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: "80vh" }}>
              <div className="px-6 pt-5 pb-4 flex flex-col gap-3 flex-shrink-0">
                <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>add people</p>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--dimmer)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    autoFocus
                    value={addSearch}
                    onChange={(e) => onAddSearch(e.target.value)}
                    placeholder="search by name or @username"
                    className="flex-1 bg-transparent text-[14px] outline-none"
                    style={{ color: "var(--text)" }}
                  />
                  {addSearch && (
                    <button onClick={() => { setAddSearch(""); setSearchResults([]); }} style={{ color: "var(--dimmer)" }}>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-2 flex flex-col gap-2">
                {searchLoading ? (
                  <p className="text-center py-6 text-[13px]" style={{ color: "var(--dimmer)" }}>searching...</p>
                ) : displayList.length === 0 ? (
                  <p className="text-center py-6 text-[13px]" style={{ color: "var(--dimmer)" }}>
                    {addSearch.trim() ? `no users found for "${addSearch}"` : "no mutuals to add yet"}
                  </p>
                ) : (
                  displayList.map((person) => {
                    const selected = addSelected.includes(person.user_id);
                    return (
                      <button
                        key={person.user_id}
                        onClick={() => setAddSelected(selected ? addSelected.filter((id) => id !== person.user_id) : [...addSelected, person.user_id])}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left w-full"
                        style={{ background: selected ? "var(--accent-dim)" : "rgba(255,255,255,0.04)", border: `1px solid ${selected ? "var(--accent-border)" : "transparent"}` }}
                      >
                        {person.avatar_url ? (
                          <img src={person.avatar_url} alt={person.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)", color: "var(--muted)" }}>
                            {person.name[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold truncate">{person.name}</p>
                          {person.username && <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>@{person.username}</p>}
                        </div>
                        {selected && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border-soft)" }}>
                <button onClick={() => { setShowAddGuests(false); setAddSelected([]); setAddSearch(""); setSearchResults([]); }} className="flex-1 py-2.5 rounded-2xl font-bold text-[14px]" style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}>cancel</button>
                <button onClick={submitAddGuests} disabled={addSelected.length === 0 || addingGuests} className="flex-1 py-2.5 rounded-2xl font-bold text-[14px] text-white disabled:opacity-40" style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
                  {addingGuests ? "adding..." : `add${addSelected.length > 0 ? ` ${addSelected.length}` : ""}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invite sheet */}
      {showInviteSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowInviteSheet(false); }}
        >
          <div className="w-full max-w-lg rounded-t-3xl p-6 flex flex-col gap-2" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <div className="w-9 h-1 rounded-full mx-auto mb-3" style={{ background: "var(--border)" }} />
            <button
              onClick={() => { setShowInviteSheet(false); openAddGuests(); }}
              className="flex items-center gap-4 px-4 py-4 rounded-2xl text-left w-full"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-dim)" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <p className="text-[15px] font-bold">invite contacts</p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>add people already on jury duty</p>
              </div>
            </button>
            <button
              onClick={() => { setShowInviteSheet(false); shareInvite(); }}
              className="flex items-center gap-4 px-4 py-4 rounded-2xl text-left w-full"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </div>
              <div>
                <p className="text-[15px] font-bold">share link</p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>send via text, airdrop, or any app</p>
              </div>
            </button>
            <button
              onClick={() => { copyInviteCode(); setShowInviteSheet(false); }}
              className="flex items-center gap-4 px-4 py-4 rounded-2xl text-left w-full"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </div>
              <div>
                <p className="text-[15px] font-bold">{copied ? "copied!" : "copy link"}</p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>copy the invite link to your clipboard</p>
              </div>
            </button>
            <button
              onClick={() => setShowInviteSheet(false)}
              className="mt-2 w-full py-3.5 rounded-2xl font-bold text-[15px]"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit event modal */}
      {showEditEvent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditEvent(false); }}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
            <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>edit</p>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>name</label>
              <input
                className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </div>
            {!isGroup && (
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>closes at</label>
                <input
                  type="datetime-local"
                  className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                  value={editEndsAt}
                  onChange={(e) => setEditEndsAt(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowEditEvent(false)} className="flex-1 py-2.5 rounded-2xl font-bold text-[14px]" style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}>cancel</button>
              <button onClick={saveEvent} disabled={!editName.trim() || savingEvent} className="flex-1 py-2.5 rounded-2xl font-bold text-[14px] text-white disabled:opacity-40" style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
                {savingEvent ? "saving..." : "save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover photo */}
      <div className="relative w-full overflow-hidden" style={{ height: 240 }}>
        {event.cover_url ? (
          <img src={event.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, rgba(255,94,128,0.18) 0%, rgba(255,94,128,0.04) 100%)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.55) 100%)" }} />
        <button
          onClick={() => router.push("/events")}
          className="absolute text-sm flex items-center gap-1"
          style={{ top: 56, left: 20, color: "rgba(255,255,255,0.9)" }}
        >
          ← events
        </button>
        {isHost && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }}
            />
            <button
              onClick={() => coverInputRef.current?.click()}
              className="absolute text-[11px] font-bold px-2.5 py-1.5 rounded-full"
              style={{ bottom: 12, right: 16, background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(6px)" }}
            >
              {coverUploading ? "uploading..." : event.cover_url ? "change photo" : "+ add photo"}
            </button>
          </>
        )}
      </div>

      {/* Header */}
      <div className="px-5 pt-5 pb-2">
        <h1
          className="text-[28px] font-black tracking-tight leading-tight mb-1"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          {event.name}
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-[13px]" style={{ color: "var(--dimmer)" }}>
            {isGroup ? "ongoing" : isClosed ? "closed" : `closes ${new Date(event.ends_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </span>
          {isHost && <span className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>· host</span>}
        </div>
      </div>

      {/* Guests row */}
      <div className="px-5 pt-3 pb-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px]" style={{ color: "var(--dimmer)" }}>{guestCount} {guestCount === 1 ? "guest" : "guests"}</span>
          <button
            onClick={() => setShowInviteSheet(true)}
            className="text-[12px] font-bold px-3 py-1.5 rounded-full"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
          >
            + invite
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {event.event_guests.map((g) => {
            const name = g.balances?.display_name;
            const avatar = g.balances?.avatar_url;
            const isMe = g.user_id === userId;
            const label = isMe ? "you" : (name ?? "?");
            return (
              <button
                key={g.user_id}
                onClick={() => g.balances?.username && router.push(`/u/${g.balances.username}`)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
              >
                {avatar ? (
                  <img src={avatar} alt={label} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-[14px] font-black"
                    style={{ background: isMe ? "var(--accent-dim)" : "rgba(255,255,255,0.08)", color: isMe ? "var(--accent)" : "var(--muted)" }}
                  >
                    {label[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <span className="text-[11px] max-w-[52px] text-center truncate" style={{ color: "var(--muted)" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Host actions */}
      {isHost && (
        <div className="px-5 pt-2 pb-1 flex items-center gap-2">
          <button
            onClick={() => { setEditName(event.name); setEditEndsAt(event.ends_at ? new Date(event.ends_at).toISOString().slice(0,16) : ""); setShowEditEvent(true); }}
            className="text-[12px] font-bold px-3 py-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)", border: "1px solid var(--border-soft)" }}
          >
            edit
          </button>
          {confirmDelete ? (
            <button onClick={deleteEvent} disabled={deleting} className="text-[12px] font-bold px-3 py-1.5 rounded-full" style={{ background: "rgba(255,60,60,0.15)", color: "#ff3c3c", border: "1px solid rgba(255,60,60,0.3)" }}>
              {deleting ? "deleting..." : "tap again to confirm"}
            </button>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-[12px] font-bold px-3 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)", color: "var(--dimmer)", border: "1px solid var(--border-soft)" }}>
              delete {isGroup ? "group" : "event"}
            </button>
          )}
        </div>
      )}

      {/* Bets list */}
      <div className="px-3 pb-32 flex flex-col gap-3">
        {openBets.length === 0 && resolvedBets.length === 0 && (
          <div className="text-center py-16 text-[15px]" style={{ color: "var(--dimmer)" }}>
            no bets yet — be first
          </div>
        )}

        {openBets.length > 0 && (
          <>
            <div className="flex items-center justify-between px-2 pt-2">
              <p className="text-[12px] font-semibold" style={{ color: "var(--dimmer)" }}>open</p>
              {!isClosed && (
                <button
                  onClick={() => router.push(`/e/${eventId}/new-bet`)}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-full"
                  style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
                >
                  + add bet
                </button>
              )}
            </div>
            {openBets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                userId={userId!}
                isHost={isHost}
                isGroup={isGroup}
                eventGuests={event.event_guests}
                eventInviteToken={event.invite_token}
                userPoints={userPoints}
                onUpdate={fetchEvent}
              />
            ))}
          </>
        )}

        {resolvedBets.length > 0 && (
          <>
            <p className="text-[12px] font-semibold px-2 pt-4" style={{ color: "var(--dimmer)" }}>
              resolved
            </p>
            {resolvedBets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                userId={userId!}
                isHost={isHost}
                isGroup={isGroup}
                eventGuests={event.event_guests}
                eventInviteToken={event.invite_token}
                userPoints={userPoints}
                onUpdate={fetchEvent}
              />
            ))}
          </>
        )}
      </div>

      {!isClosed && (
        <button
          onClick={() => router.push(`/e/${eventId}/new-bet`)}
          className="fixed bottom-8 right-5 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg"
          style={{ background: "var(--accent)" }}
        >
          +
        </button>
      )}
    </div>
  );
}

function relativeDeadline(deadline: string): { label: string; urgency: "none" | "soon" | "critical" } {
  const d = new Date(deadline);
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) {
    const agoH = Math.floor(Math.abs(diffMs) / 3600000);
    const agoD = Math.floor(Math.abs(diffMs) / 86400000);
    if (agoD >= 1) return { label: `closed ${agoD}d ago`, urgency: "none" };
    if (agoH >= 1) return { label: `closed ${agoH}h ago`, urgency: "none" };
    return { label: "just closed", urgency: "none" };
  }
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 60) return { label: `${mins}m left`, urgency: "critical" };
  if (hours < 24) return { label: `${hours}h left`, urgency: "soon" };
  if (days === 1) return { label: "closes tomorrow", urgency: "none" };
  return { label: `${days}d left`, urgency: "none" };
}

function BetCard({
  bet,
  userId,
  isHost,
  isGroup,
  eventGuests,
  eventInviteToken,
  userPoints,
  onUpdate,
}: {
  bet: Bet;
  userId: string;
  isHost: boolean;
  isGroup: boolean;
  eventGuests: Guest[];
  eventInviteToken: string;
  userPoints: number | null;
  onUpdate: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const router = useRouter();

  // Blur/reveal state — private bets start blurred
  const [revealed, setRevealed] = useState(bet.visibility !== "private");

  // Comments
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<BetComment[]>([]);
  const [commentCount, setCommentCount] = useState(bet.bet_comments?.length ?? 0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentMentionSearch, setCommentMentionSearch] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Reactions
  const [reactions, setReactions] = useState<BetReaction[]>(bet.bet_reactions ?? []);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const EMOJIS = ["🔥", "👀", "💀", "😂", "🤝", "🫡", "🙏"];

  async function fetchComments() {
    setCommentsLoading(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/bets/${bet.id}/comments`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    const fetched = data.comments ?? [];
    setComments(fetched);
    setCommentCount(fetched.length);
    setCommentsLoading(false);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim() || submittingComment) return;
    setSubmittingComment(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/bets/${bet.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ body: commentInput.trim(), parentId: replyingTo?.id ?? null }),
    });
    if (res.ok) {
      setCommentInput("");
      setReplyingTo(null);
      if (replyingTo) setExpandedThreads((s) => new Set([...s, replyingTo.id]));
      fetchComments();
    }
    setSubmittingComment(false);
  }

  async function toggleReaction(emoji: string) {
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/bets/${bet.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.action === "removed") {
      setReactions((r) => r.filter((x) => !(x.user_id === userId && x.emoji === emoji)));
    } else {
      setReactions((r) => [...r.filter((x) => x.user_id !== userId), { user_id: userId, emoji }]);
    }
    setShowEmojiPicker(false);
  }

  async function toggleCommentLike(commentId: string) {
    const token = await getAccessToken();
    await fetch(`/api/v1/comments/${commentId}/likes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setComments((prev) => prev.map((c) => {
      if (c.id !== commentId) return c;
      const liked = c.comment_likes?.some((l) => l.user_id === userId);
      return {
        ...c,
        comment_likes: liked
          ? (c.comment_likes ?? []).filter((l) => l.user_id !== userId)
          : [...(c.comment_likes ?? []), { user_id: userId }],
      };
    }));
  }

  async function deleteComment(commentId: string) {
    const token = await getAccessToken();
    await fetch(`/api/v1/bets/${bet.id}/comments?commentId=${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setComments((c) => c.filter((x) => x.id !== commentId));
  }

  // Bet placement state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [stakeInput, setStakeInput] = useState("1");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Resolve state
  const [resolving, setResolving] = useState(false);
  const [resolveOption, setResolveOption] = useState<string | null | "refund">(null);
  const [submittingResolve, setSubmittingResolve] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Delete state
  const [confirmDeleteBet, setConfirmDeleteBet] = useState(false);
  const [deletingBet, setDeletingBet] = useState(false);

  // Double down
  const [doubling, setDoubling] = useState(false);
  const [doubleInput, setDoubleInput] = useState("1");
  const [doubleError, setDoubleError] = useState<string | null>(null);
  const [doublingDown, setDoublingDown] = useState(false);

  async function submitDoubleDown() {
    const pts = Math.round(parseFloat(doubleInput) * 100);
    if (!pts || pts <= 0 || doublingDown) return;
    if (userPoints !== null && pts > userPoints) {
      setDoubleError(`not enough — you have ${centsToDisplay(userPoints)} available`);
      return;
    }
    setDoublingDown(true);
    setDoubleError(null);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/bets/${bet.id}/double-down`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ points: pts }),
    });
    const data = await res.json();
    setDoublingDown(false);
    if (!res.ok) { setDoubleError(data.error ?? "something went wrong"); return; }
    setDoubling(false);
    onUpdate();
  }

  // Inline question tagging
  const [qTagMode, setQTagMode] = useState(false); // word-selection mode
  const [qPendingWord, setQPendingWord] = useState<{ start: number; end: number; label: string } | null>(null);
  const [showQTagPicker, setShowQTagPicker] = useState(false);
  const [qTagSearch, setQTagSearch] = useState("");
  const [qTagging, setQTagging] = useState(false);
  const qTagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (qTagRef.current && !qTagRef.current.contains(e.target as Node)) {
        setShowQTagPicker(false);
        setQTagSearch("");
        setQPendingWord(null);
      }
    }
    if (showQTagPicker) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showQTagPicker]);

  async function applyQTag(userId: string) {
    if (!qPendingWord || qTagging) return;
    setQTagging(true);
    const newQuestion = insertMentionAt(bet.question, qPendingWord.start, qPendingWord.end, userId);
    const newTaggedIds = extractTaggedUserIds(newQuestion);
    const token = await getAccessToken();
    await fetch(`/api/v1/bets/${bet.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question: newQuestion, question_tagged_user_ids: newTaggedIds }),
    });
    setQTagging(false);
    setShowQTagPicker(false);
    setQPendingWord(null);
    setQTagSearch("");
    setQTagMode(false);
    onUpdate();
  }

  async function removeQTag(userId: string) {
    if (qTagging) return;
    setQTagging(true);
    const newQuestion = removeMention(bet.question, userId);
    const newTaggedIds = extractTaggedUserIds(newQuestion);
    const token = await getAccessToken();
    await fetch(`/api/v1/bets/${bet.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question: newQuestion, question_tagged_user_ids: newTaggedIds }),
    });
    setQTagging(false);
    onUpdate();
  }

  // Tag option after creation
  const [tagPickerOptId, setTagPickerOptId] = useState<string | null>(null);
  const [tagPickerSearch, setTagPickerSearch] = useState("");
  const [tagging, setTagging] = useState(false);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const tagPickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setTagPickerOptId(null);
        setTagPickerSearch("");
      }
    }
    if (tagPickerOptId) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagPickerOptId]);

  async function submitTag(optionId: string, taggedUserId: string | null) {
    if (tagging) return;
    setTagging(true);
    const token = await getAccessToken();
    await fetch(`/api/v1/bets/${bet.id}/options/${optionId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tagged_user_id: taggedUserId }),
    });
    setTagging(false);
    setTagPickerOptId(null);
    onUpdate();
  }

  // Edit deadline
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [savingDeadline, setSavingDeadline] = useState(false);

  async function saveDeadline() {
    if (!deadlineInput || savingDeadline) return;
    setSavingDeadline(true);
    const token = await getAccessToken();
    await fetch(`/api/v1/bets/${bet.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: deadlineInput }),
    });
    setSavingDeadline(false);
    setEditingDeadline(false);
    onUpdate();
  }

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSelected, setInviteSelected] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  const [betSharedCopied, setBetSharedCopied] = useState(false);

  const invitedIds = new Set((bet.bet_invites ?? []).map((i) => i.user_id));
  const isInvolved = bet.creator_id === userId || invitedIds.has(userId) || isHost;

  const creatorName =
    eventGuests.find((g) => g.user_id === bet.creator_id)?.balances?.display_name
    ?? (bet.creator_id === userId ? "you" : null);

  async function shareBet() {
    const url = `${window.location.origin}/join/${eventInviteToken}?bet=${bet.id}`;
    const senderName = eventGuests.find((g) => g.user_id === userId)?.balances?.display_name ?? "someone";
    const text = `${senderName} just invited you to a private bet 👀`;
    if (navigator.share) {
      try { await navigator.share({ title: text, text, url }); } catch { /* dismissed */ }
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      setBetSharedCopied(true);
      setTimeout(() => setBetSharedCopied(false), 2000);
    }
  }
  // Guests not yet in this private bet
  const uninvitedGuests = eventGuests.filter(
    (g) => g.user_id !== userId && !invitedIds.has(g.user_id)
  );

  async function sendInvites() {
    if (inviteSelected.length === 0 || inviting) return;
    setInviting(true);
    const token = await getAccessToken();
    await fetch(`/api/v1/bets/${bet.id}/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: inviteSelected }),
    });
    setInviting(false);
    setShowInvite(false);
    setInviteSelected([]);
    onUpdate();
  }

  const myEntry = bet.bet_entries.find((e) => e.user_id === userId);
  const totalPot = bet.bet_entries.reduce((s, e) => s + e.points_staked, 0);
  const isOpen = bet.status === "open";
  const isPast = new Date(bet.deadline) < new Date();
  const { label: deadlineLabel, urgency } = relativeDeadline(bet.deadline);
  const winOpt = bet.winning_option_id ? bet.bet_options.find((o) => o.id === bet.winning_option_id) : null;
  const canBet = isOpen && !isPast && !myEntry && !resolving;
  const past24h = isPast && new Date() > new Date(new Date(bet.deadline).getTime() + 24 * 60 * 60 * 1000);
  const canResolve = isOpen && (bet.creator_id === userId || (past24h && !!userId));

  async function placeBet() {
    if (!selectedOption || placing) return;
    const stake = Math.round(parseFloat(stakeInput) * 100);
    if (!stake || stake <= 0) return;
    if (userPoints !== null && stake > userPoints) {
      setPlaceError(`not enough — you have ${centsToDisplay(userPoints)} available`);
      return;
    }
    setPlacing(true);
    setPlaceError(null);
    const token = await getAccessToken();
    const res = await fetch("/api/v1/bets/place", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bet_id: bet.id, option_id: selectedOption, points: stake, is_anonymous: isAnonymous }),
    });
    const data = await res.json();
    setPlacing(false);
    if (!res.ok) {
      setPlaceError(data.error ?? "something went wrong");
      return;
    }
    setSelectedOption(null);
    onUpdate();
  }

  async function deleteBet() {
    setDeletingBet(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/bets/${bet.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) onUpdate();
    else setDeletingBet(false);
  }

  async function submitResolve() {
    if (resolveOption === null || submittingResolve) return;
    setSubmittingResolve(true);
    setResolveError(null);
    const token = await getAccessToken();
    const res = await fetch(`/api/v1/bets/${bet.id}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        winning_option_id: resolveOption === "refund" ? null : resolveOption,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResolveError(data.error ?? "something went wrong");
      setSubmittingResolve(false);
      return;
    }
    setResolving(false);
    onUpdate();
  }

  // Payout preview for resolve mode
  const winnerCount = resolveOption && resolveOption !== "refund"
    ? bet.bet_entries.filter((e) => e.option_id === resolveOption).length
    : 0;
  const payoutEach = winnerCount > 0 ? Math.floor(totalPot / winnerCount) : 0;

  return (
    <>
    {/* Invite modal */}
    {showInvite && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={(e) => { if (e.target === e.currentTarget) setShowInvite(false); }}
      >
        <div className="w-full max-w-lg rounded-t-3xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
          <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>add people</p>
          {uninvitedGuests.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>everyone in the event is already in this bet</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {uninvitedGuests.map((g) => {
                const name = g.balances?.display_name ?? "unknown";
                const avatar = g.balances?.avatar_url;
                const checked = inviteSelected.includes(g.user_id);
                return (
                  <button
                    key={g.user_id}
                    onClick={() => setInviteSelected(checked ? inviteSelected.filter((id) => id !== g.user_id) : [...inviteSelected, g.user_id])}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left"
                    style={{ background: checked ? "var(--accent-dim)" : "rgba(255,255,255,0.04)", border: `1px solid ${checked ? "var(--accent-border)" : "transparent"}` }}
                  >
                    {avatar ? (
                      <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)", color: "var(--muted)" }}>
                        {name[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <span className="text-[14px] font-bold flex-1">{name}</span>
                    {checked && <span style={{ color: "var(--accent)" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setShowInvite(false); setInviteSelected([]); }} className="flex-1 py-2.5 rounded-2xl font-bold text-[14px]" style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}>cancel</button>
            {uninvitedGuests.length > 0 && (
              <button onClick={sendInvites} disabled={inviteSelected.length === 0 || inviting} className="flex-1 py-2.5 rounded-2xl font-bold text-[14px] text-white disabled:opacity-40" style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
                {inviting ? "adding..." : `add ${inviteSelected.length > 0 ? inviteSelected.length : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    <div
      className="rounded-3xl p-5 relative"
      style={{
        background: "var(--card)",
        border: `1px solid ${isOpen && urgency === "critical" ? "rgba(239,68,68,0.35)" : isOpen && urgency === "soon" ? "rgba(245,158,11,0.35)" : "var(--border-soft)"}`,
        opacity: bet.status === "resolved" || isPast ? 0.45 : 1,
      }}
    >
      {/* Blur overlay for private bets */}
      {!revealed && (
        <button
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-3xl"
          style={{ background: "rgba(24,21,32,0.15)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
          onClick={() => setRevealed(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span className="text-[12px] font-bold" style={{ color: "var(--muted)" }}>tap to reveal</span>
        </button>
      )}

      {/* Question + private badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          {/* Question text — word-select mode or inline render */}
          {qTagMode ? (
            <div className="flex flex-wrap gap-1 mb-1">
              {getWordTokens(parseQuestion(bet.question)).map((t) =>
                t.isMention ? (
                  <span key={t.key} className="text-[16px] font-extrabold" style={{ color: "var(--accent)", fontFamily: "var(--font-nunito)" }}>
                    @{t.label.slice(1)}
                  </span>
                ) : (
                  <button
                    key={t.key}
                    onClick={() => { setQPendingWord({ start: t.start, end: t.end, label: t.label }); setShowQTagPicker(true); setQTagMode(false); setQTagSearch(""); }}
                    className="text-[16px] font-extrabold px-1.5 py-0.5 rounded-lg"
                    style={{ fontFamily: "var(--font-nunito)", background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-soft)" }}
                  >
                    {t.label}
                  </button>
                )
              )}
              <button onClick={() => setQTagMode(false)} className="text-[11px] self-center ml-1" style={{ color: "var(--dimmer)" }}>cancel</button>
            </div>
          ) : (
            <p className="font-extrabold text-[16px] leading-snug" style={{ fontFamily: "var(--font-nunito)" }}>
              {parseQuestion(bet.question).map((seg, i) => {
                if (seg.type === "text") return <span key={i}>{seg.text}</span>;
                const guest = eventGuests.find((g) => g.user_id === seg.userId);
                const name = guest?.balances?.display_name ?? seg.original;
                const username = guest?.balances?.username;
                return (
                  <span key={i} className="inline-flex items-center gap-0.5">
                    <button
                      onClick={() => router.push(username ? `/u/${username}` : "/people")}
                      className="font-extrabold"
                      style={{ color: "var(--accent)" }}
                    >
                      @{name}
                    </button>
                    {bet.creator_id === userId && isOpen && (
                      <button onClick={() => removeQTag(seg.userId)} className="text-[10px] leading-none" style={{ color: "var(--dimmer)" }}>✕</button>
                    )}
                  </span>
                );
              })}
              {bet.isNew && <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block ml-1.5" style={{ background: "var(--accent)" }} />}
            </p>
          )}
          {bet.walrus_blob_id && (
            <a
              href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${bet.walrus_blob_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-semibold mt-0.5 inline-block"
              style={{ color: "var(--dimmer)" }}
            >
              verify on walrus ↗
            </a>
          )}
          {/* Tag someone button — creator only, open bet */}
          {bet.creator_id === userId && isOpen && !qTagMode && (
            <div className="relative mt-1" ref={qTagRef}>
              <button
                onClick={() => { setQTagMode(true); setShowQTagPicker(false); }}
                className="text-[11px] font-bold flex items-center gap-1"
                style={{ color: "var(--dimmer)" }}
              >
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                tag someone
              </button>
              {/* User picker after word is selected */}
              {showQTagPicker && qPendingWord && (
                <div className="absolute left-0 top-6 z-20 rounded-2xl shadow-lg p-2 flex flex-col gap-1 w-52" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
                  <p className="text-[11px] px-2 pt-1 pb-0.5" style={{ color: "var(--dimmer)" }}>
                    replacing <span className="font-bold" style={{ color: "var(--text)" }}>{qPendingWord.label}</span> with...
                  </p>
                  <input
                    autoFocus
                    value={qTagSearch}
                    onChange={(e) => setQTagSearch(e.target.value)}
                    placeholder="search guests"
                    className="rounded-xl px-3 py-1.5 text-[13px] outline-none w-full"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)" }}
                  />
                  <div className="flex flex-col max-h-40 overflow-y-auto">
                    {filterTagPickerGuests(eventGuests, userId, qTagSearch).map((g) => {
                      const name = g.balances?.display_name ?? "unknown";
                      return (
                        <button
                          key={g.user_id}
                          disabled={qTagging}
                          onClick={() => applyQTag(g.user_id)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-left text-[13px] font-bold"
                          style={{ color: "var(--text)" }}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {bet.visibility === "private" && (
          <button
            onClick={() => setRevealed((r) => !r)}
            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 flex items-center gap-1"
            style={{ background: "var(--purple-dim)", color: "var(--purple)", border: "1px solid var(--purple-border)" }}
          >
            {revealed ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            )} private
          </button>
        )}
      </div>

      {/* Status — deadline + votes */}
      <div className="mb-4">
        {bet.status === "resolved" && winOpt && (
          <span className="inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full mb-2" style={{ background: "rgba(56,189,248,0.12)", color: "var(--win)", border: "1px solid rgba(56,189,248,0.25)" }}>
            ✓ {winOpt.label}
          </span>
        )}
        {isOpen && (() => {
          const color = urgency === "critical" ? "#ef4444" : urgency === "soon" ? "#f59e0b" : "var(--dimmer)";
          return <p className="text-[12px] font-semibold mb-1" style={{ color }}>{deadlineLabel}</p>;
        })()}
        {bet.bet_entries.length > 0 && (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {bet.bet_entries.length} {bet.bet_entries.length === 1 ? "vote" : "votes"} · {centsToDisplay(totalPot)}
          </p>
        )}
        {bet.bet_entries.length === 0 && isOpen && !isPast && (
          <p className="text-[12px]" style={{ color: "var(--dimmer)" }}>no votes yet — be first</p>
        )}
      </div>

      {/* Options — flat rows */}
      <div className="flex flex-col">
        {bet.bet_options.map((opt) => {
          const optTotal = bet.bet_entries
            .filter((e) => e.option_id === opt.id)
            .reduce((s, e) => s + e.points_staked, 0);
          const isWinner = bet.winning_option_id === opt.id;
          const myPick = myEntry?.option_id === opt.id;
          const pct = totalPot > 0 ? Math.round((optTotal / totalPot) * 100) : 0;
          const isSelectedForResolve = resolveOption === opt.id;
          const pickers = bet.bet_entries.filter((e) => e.option_id === opt.id);

          const label = opt.tagged_user_id ? (opt.balances?.display_name ?? opt.label) : opt.label;

          return (
            <div
              key={opt.id}
              className="relative py-2.5 cursor-pointer"
              onClick={() => {
                if (resolving) {
                  setResolveOption(isSelectedForResolve ? null : opt.id);
                } else if (canBet) {
                  setSelectedOption(selectedOption === opt.id ? null : opt.id);
                }
              }}
              style={{ opacity: resolving && !isSelectedForResolve && resolveOption !== null ? 0.5 : 1 }}
            >
              {/* Label row */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="text-[15px] font-bold truncate"
                    style={{ color: isWinner ? "var(--win)" : isSelectedForResolve ? "var(--win)" : selectedOption === opt.id ? "var(--accent)" : "var(--text)" }}
                  >
                    {label}
                  </span>
                  {isWinner && <span className="text-[11px] font-bold flex-shrink-0" style={{ color: "var(--win)" }}>won</span>}
                  {/* Tag / untag buttons */}
                  {opt.tagged_user_id && bet.creator_id === userId && isOpen && !resolving && (
                    <span role="button" onClick={(e) => { e.stopPropagation(); submitTag(opt.id, null); }} className="text-[10px] flex-shrink-0 cursor-pointer" style={{ color: "var(--dimmer)" }}>✕</span>
                  )}
                  {!opt.tagged_user_id && bet.creator_id === userId && isOpen && !resolving && eventGuests.length > 0 && (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tagPickerOptId === opt.id) { setTagPickerOptId(null); } else { setTagPickerOptId(opt.id); setTagPickerSearch(""); setTimeout(() => tagPickerInputRef.current?.focus(), 50); }
                      }}
                      className="flex-shrink-0 cursor-pointer"
                      style={{ color: tagPickerOptId === opt.id ? "var(--accent)" : "var(--dimmer)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                  )}
                  {/* Avatar stack */}
                  {!resolving && pickers.length > 0 && (
                    <div className="flex items-center flex-shrink-0">
                      {pickers.slice(0, 4).map((e, i) => {
                        const name = e.balances?.display_name;
                        const avatar = e.balances?.avatar_url;
                        const isMe = e.user_id === userId;
                        const anonOther = e.is_anonymous && !isMe;
                        const anonSelf = e.is_anonymous && isMe;
                        return anonOther ? (
                          <div key={e.id} className="w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--card)]" style={{ marginLeft: i === 0 ? 0 : -6, zIndex: pickers.length - i, background: "rgba(255,255,255,0.08)" }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--muted)" }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          </div>
                        ) : anonSelf ? (
                          <div key={e.id} className="w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--card)]" style={{ marginLeft: i === 0 ? 0 : -6, zIndex: pickers.length - i, background: "var(--accent-dim)", opacity: 0.5 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--accent)" }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          </div>
                        ) : avatar ? (
                          <img key={e.id} src={avatar} alt={name ?? ""} className="w-5 h-5 rounded-full object-cover border-2 border-[var(--card)]" style={{ marginLeft: i === 0 ? 0 : -6, zIndex: pickers.length - i }} />
                        ) : (
                          <div key={e.id} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-[var(--card)]" style={{ marginLeft: i === 0 ? 0 : -6, zIndex: pickers.length - i, background: isMe ? "var(--accent)" : "rgba(255,255,255,0.15)", color: isMe ? "#fff" : "var(--text)" }}>
                            {isMe ? "me" : (name?.[0]?.toUpperCase() ?? "?")}
                          </div>
                        );
                      })}
                      {pickers.length > 4 && <span className="text-[10px] ml-1.5" style={{ color: "var(--dimmer)" }}>+{pickers.length - 4}</span>}
                    </div>
                  )}
                  {/* Double down inline */}
                  {myPick && isOpen && !isPast && !resolving && !doubling && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDoubling(true); }}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
                    >
                      double down
                    </button>
                  )}
                  {/* Resolve payout hint */}
                  {resolving && isSelectedForResolve && winnerCount > 0 && (
                    <span className="text-[11px] font-bold flex-shrink-0" style={{ color: "var(--win)" }}>
                      {payoutEach.toLocaleString()} ea
                    </span>
                  )}
                </div>
                <span className="text-[13px] font-semibold flex-shrink-0" style={{ color: "var(--muted)" }}>
                  {pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-[1.5px] rounded-full w-full mb-1" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: isWinner ? "var(--win)" : isSelectedForResolve ? "var(--win)" : myPick ? "var(--accent)" : "rgba(255,255,255,0.25)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {/* Pts in pool */}
              <p className="text-[11px]" style={{ color: "var(--dimmer)" }}>
                {optTotal > 0 ? centsToDisplay(optTotal) : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tag picker (unaffected) */}
      {bet.bet_options.map((opt) => (
        <div key={opt.id} className="relative">
        {tagPickerOptId === opt.id && (
              <div
                ref={tagPickerRef}
                className="absolute left-0 top-full mt-1 w-full rounded-2xl z-20 flex flex-col"
                style={{ background: "var(--card)", border: "1px solid var(--border-soft)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxHeight: 260 }}
              >
                <div className="px-3 pt-3 pb-2 flex-shrink-0">
                  <input
                    ref={tagPickerInputRef}
                    type="text"
                    placeholder="search..."
                    value={tagPickerSearch}
                    onChange={(e) => setTagPickerSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded-xl px-3 py-2 text-[14px] outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
                  />
                </div>
                <div className="overflow-y-auto flex-1 pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
                  {(() => {
                    const filtered = filterTagPickerGuests(eventGuests, userId, tagPickerSearch);
                    if (filtered.length === 0) {
                      return <p className="px-4 py-3 text-[13px]" style={{ color: "var(--muted)" }}>no results</p>;
                    }
                    return filtered.map((g) => (
                      <button
                        key={g.user_id}
                        onClick={(e) => { e.stopPropagation(); setTagPickerSearch(""); submitTag(opt.id, g.user_id); }}
                        disabled={tagging}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 disabled:opacity-40"
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                          {g.balances?.display_name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="text-[14px] font-bold">{g.balances?.display_name ?? "anonymous"}</p>
                          {g.balances?.username && <p className="text-[11px]" style={{ color: "var(--muted)" }}>@{g.balances.username}</p>}
                        </div>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        ))}

      {/* Stake input — mobile-style quick picks + custom */}
      {canBet && selectedOption && (
        <div className="mt-3 flex flex-col gap-2">
          <span className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>stake</span>
          <div className="flex gap-2">
            {[1, 2, 5].map((v) => (
              <button
                key={v}
                onClick={() => setStakeInput(String(v))}
                className="flex-1 py-2.5 rounded-2xl text-[14px] font-bold"
                style={{
                  background: stakeInput === String(v) ? "var(--accent-dim)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${stakeInput === String(v) ? "var(--accent-border)" : "var(--border-soft)"}`,
                  color: stakeInput === String(v) ? "var(--accent)" : "var(--muted)",
                }}
              >
                ${v}
              </button>
            ))}
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={["1", "2", "5"].includes(stakeInput) ? "" : stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              placeholder="custom"
              className="flex-1 rounded-2xl px-3 py-2.5 text-[14px] outline-none text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
            />
          </div>
          <button
            onClick={placeBet}
            disabled={!stakeInput || placing}
            className="w-full py-3.5 rounded-2xl font-bold text-[16px] text-white disabled:opacity-40"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
          >
            {placing ? "committing..." : "call it"}
          </button>
          {placeError && (
            <p className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>{placeError}</p>
          )}
          <button
            onClick={() => setIsAnonymous((a) => !a)}
            className="flex items-center gap-1.5 self-start text-[12px] font-bold px-3 py-1.5 rounded-full"
            style={{
              background: isAnonymous ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isAnonymous ? "var(--border)" : "var(--border-soft)"}`,
              color: isAnonymous ? "var(--text)" : "var(--dimmer)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            {isAnonymous ? "ghost mode on" : "go anonymous"}
          </button>
        </div>
      )}

      {/* Double down input — shown when doubling */}
      {myEntry && isOpen && !resolving && doubling && (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={doubleInput}
              onChange={(e) => setDoubleInput(e.target.value)}
              className="flex-1 rounded-2xl px-4 py-2.5 text-[15px] outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
              placeholder="$0.00"
              autoFocus
            />
            <button
              onClick={submitDoubleDown}
              disabled={doublingDown}
              className="px-5 py-2.5 rounded-2xl font-bold text-[14px] text-white disabled:opacity-40"
              style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              {doublingDown ? "..." : "add"}
            </button>
            <button
              onClick={() => { setDoubling(false); setDoubleError(null); }}
              className="px-3 py-2.5 rounded-2xl font-bold text-[14px]"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}
            >
              ✕
            </button>
          </div>
          {doubleError && <p className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>{doubleError}</p>}
        </div>
      )}

      {/* Resolve mode footer */}
      {resolving && (
        <div className="mt-4 flex flex-col gap-2">
          {/* No winner / refund option */}
          <button
            onClick={() => setResolveOption(resolveOption === "refund" ? null : "refund")}
            className="w-full py-2.5 rounded-2xl text-[13px] font-bold"
            style={{
              background: resolveOption === "refund" ? "rgba(255,255,255,0.08)" : "transparent",
              border: `1px solid ${resolveOption === "refund" ? "var(--border)" : "var(--border-soft)"}`,
              color: "var(--muted)",
            }}
          >
            {resolveOption === "refund" ? "✓ refund everyone" : "no winner — refund everyone"}
          </button>

          {resolveError && (
            <p className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>{resolveError}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setResolving(false); setResolveOption(null); setResolveError(null); }}
              className="flex-1 py-2.5 rounded-2xl font-bold text-[14px]"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}
            >
              cancel
            </button>
            <button
              onClick={submitResolve}
              disabled={resolveOption === null || submittingResolve}
              className="flex-1 py-2.5 rounded-2xl font-bold text-[14px] text-white disabled:opacity-35"
              style={{ background: "var(--win)", fontFamily: "var(--font-nunito)" }}
            >
              {submittingResolve ? "resolving..." : "confirm"}
            </button>
          </div>
        </div>
      )}

      {/* Edit deadline inline */}
      {editingDeadline && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="datetime-local"
            className="flex-1 rounded-2xl px-3 py-2 text-[13px] outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--accent-border)", color: "var(--text)" }}
            value={deadlineInput}
            onChange={(e) => setDeadlineInput(e.target.value)}
            autoFocus
          />
          <button onClick={saveDeadline} disabled={!deadlineInput || savingDeadline} className="px-3 py-2 rounded-2xl font-bold text-[12px] text-white disabled:opacity-40" style={{ background: "var(--accent)" }}>
            {savingDeadline ? "..." : "save"}
          </button>
          <button onClick={() => setEditingDeadline(false)} className="px-3 py-2 rounded-2xl font-bold text-[12px]" style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}>
            cancel
          </button>
        </div>
      )}

      {/* Resolve trigger + delete + invite */}
      {!resolving && (canResolve || isHost || bet.creator_id === userId || (bet.visibility === "private" && isInvolved)) && (
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          {canResolve && (
            <button onClick={() => setResolving(true)} className="text-[12px] font-bold" style={{ color: "var(--dimmer)" }}>
              resolve bet →
            </button>
          )}
          {isGroup && isOpen && !isPast && bet.creator_id === userId && (
            <button onClick={() => { setDeadlineInput(new Date(bet.deadline).toISOString().slice(0,16)); setEditingDeadline(true); }} className="text-[12px] font-bold" style={{ color: "var(--dimmer)" }}>
              edit deadline
            </button>
          )}
          {bet.visibility === "private" && isInvolved && (
            <>
              <button onClick={() => setShowInvite(true)} className="text-[12px] font-bold" style={{ color: "var(--purple)" }}>
                + add people
              </button>
              <button onClick={shareBet} className="text-[12px] font-bold" style={{ color: betSharedCopied ? "var(--win)" : "var(--purple)" }}>
                {betSharedCopied ? "copied!" : "share"}
              </button>
            </>
          )}
          {bet.creator_id === userId && (
            confirmDeleteBet ? (
              <button
                onClick={deleteBet}
                disabled={deletingBet}
                className="text-[12px] font-bold"
                style={{ color: "#ff3c3c" }}
              >
                {deletingBet ? "deleting..." : "confirm delete"}
              </button>
            ) : (
              <button
                onClick={() => setConfirmDeleteBet(true)}
                className="text-[12px] font-bold"
                style={{ color: "var(--dimmer)" }}
              >
                delete
              </button>
            )
          )}
        </div>
      )}

      {/* Reactions + comment button — single row with border-top */}
      {(() => {
        const grouped = EMOJIS.map((e) => ({ emoji: e, users: reactions.filter((r) => r.emoji === e) })).filter((g) => g.users.length > 0);
        const myReaction = reactions.find((r) => r.user_id === userId)?.emoji ?? null;
        return (
          <div className="mt-4 pt-4 flex items-center gap-2 flex-wrap relative" style={{ borderTop: "1px solid var(--border-soft)" }}>
            {grouped.map(({ emoji, users }) => (
              <button
                key={emoji}
                onClick={() => myReaction === emoji ? toggleReaction(emoji) : setShowEmojiPicker((s) => !s)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[13px] font-bold transition-all"
                style={{
                  background: myReaction === emoji ? "var(--accent-dim)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${myReaction === emoji ? "var(--accent-border)" : "var(--border-soft)"}`,
                  color: myReaction === emoji ? "var(--accent)" : "var(--muted)",
                }}
              >
                {emoji} {users.length}
              </button>
            ))}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker((s) => !s)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[13px] transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)", color: "var(--dimmer)" }}
              >
                ＋ react
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-8 left-0 z-20 flex gap-1 p-2 rounded-2xl shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}>
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => toggleReaction(e)} className="text-[20px] hover:scale-125 transition-transform px-1" style={{ opacity: myReaction === e ? 1 : 0.6 }}>{e}</button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="flex items-center gap-1.5 text-[12px] font-bold ml-auto"
              style={{ color: "var(--dimmer)" }}
              onClick={() => { fetchComments(); setShowComments(true); }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {commentCount > 0 ? commentCount : "comment"}
            </button>
          </div>
        );
      })()}

      {/* Comments sheet */}
      {showComments && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowComments(false); setReplyingTo(null); setCommentInput(""); setCommentMentionSearch(null); } }}
        >
          <div className="w-full max-w-lg rounded-t-3xl flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border-soft)", maxHeight: "75vh" }}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <p className="font-extrabold text-[16px]" style={{ fontFamily: "var(--font-nunito)" }}>comments</p>
              <button onClick={() => { setShowComments(false); setReplyingTo(null); setCommentInput(""); setCommentMentionSearch(null); }} className="text-[14px] font-bold" style={{ color: "var(--dimmer)" }}>done</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {commentsLoading ? (
                <p className="text-[13px] text-center py-6" style={{ color: "var(--dimmer)" }}>loading...</p>
              ) : comments.filter((c) => !c.parent_id).length === 0 ? (
                <p className="text-[13px] text-center py-6" style={{ color: "var(--dimmer)" }}>no comments yet — be first</p>
              ) : (
                comments.filter((c) => !c.parent_id).map((c) => {
                  const replies = comments.filter((r) => r.parent_id === c.id);
                  const isExpanded = expandedThreads.has(c.id);
                  return (
                    <div key={c.id}>
                      <div className="flex gap-3 items-start group">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-black overflow-hidden" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                          {c.balances?.avatar_url
                            ? <img src={c.balances.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                            : (c.balances?.display_name?.[0] ?? "?").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-[13px] font-bold" style={{ color: "var(--muted)" }}>{c.balances?.display_name ?? "unknown"}</span>
                            <span className="text-[14px]" style={{ color: "var(--text)" }}>
                              {c.body.split(/(@\w+)/g).map((part, i) =>
                                part.startsWith("@") ? <span key={i} className="font-bold" style={{ color: "var(--accent)" }}>{part}</span> : part
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5">
                            <button onClick={() => toggleCommentLike(c.id)} className="text-[12px] font-bold flex items-center gap-1" style={{ color: c.comment_likes?.some((l) => l.user_id === userId) ? "var(--accent)" : "var(--dimmer)" }}>
                              ♥ {(c.comment_likes?.length ?? 0) || ""}
                            </button>
                            <button onClick={() => { const u = c.balances?.username ?? c.balances?.display_name?.replace(/\s+/g, "") ?? "unknown"; setReplyingTo({ id: c.id, name: u }); setCommentInput(`@${u} `); setCommentMentionSearch(null); setTimeout(() => commentInputRef.current?.focus(), 50); }} className="text-[12px] font-bold" style={{ color: "var(--dimmer)" }}>reply</button>
                            {replies.length > 0 && (
                              <button onClick={() => setExpandedThreads((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} className="text-[12px] font-bold" style={{ color: "var(--dimmer)" }}>
                                {isExpanded ? "hide" : `${replies.length} repl${replies.length === 1 ? "y" : "ies"}`}
                              </button>
                            )}
                            {c.user_id === userId && <button onClick={() => deleteComment(c.id)} className="text-[12px] font-bold" style={{ color: "var(--dimmer)" }}>delete</button>}
                          </div>
                        </div>
                      </div>
                      {isExpanded && replies.map((r) => (
                        <div key={r.id} className="flex gap-3 items-start mt-3 ml-11">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black overflow-hidden" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                            {r.balances?.avatar_url
                              ? <img src={r.balances.avatar_url} className="w-7 h-7 rounded-full object-cover" />
                              : (r.balances?.display_name?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-[12px] font-bold" style={{ color: "var(--muted)" }}>{r.balances?.display_name ?? "unknown"}</span>
                              <span className="text-[13px]" style={{ color: "var(--text)" }}>
                                {r.body.split(/(@\w+)/g).map((part, i) =>
                                  part.startsWith("@") ? <span key={i} className="font-bold" style={{ color: "var(--accent)" }}>{part}</span> : part
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1.5">
                              <button onClick={() => toggleCommentLike(r.id)} className="text-[12px] font-bold flex items-center gap-1" style={{ color: r.comment_likes?.some((l) => l.user_id === userId) ? "var(--accent)" : "var(--dimmer)" }}>
                                ♥ {(r.comment_likes?.length ?? 0) || ""}
                              </button>
                              {r.user_id === userId && <button onClick={() => deleteComment(r.id)} className="text-[12px] font-bold" style={{ color: "var(--dimmer)" }}>delete</button>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
            {/* Mention dropdown */}
            {commentMentionSearch !== null && (() => {
              const filtered = filterTagPickerGuests(eventGuests, userId, commentMentionSearch);
              if (filtered.length === 0) return null;
              return (
                <div className="mx-6 mb-2 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--border-soft)", background: "var(--card)" }}>
                  {filtered.slice(0, 5).map((g) => (
                    <button key={g.user_id} type="button" className="w-full flex items-center gap-2 px-3 py-2 text-left"
                      onMouseDown={(e) => { e.preventDefault(); const u = g.balances?.username ?? g.balances?.display_name ?? "unknown"; const atIdx = commentInput.lastIndexOf("@"); setCommentInput(commentInput.slice(0, atIdx) + `@${u} `); setCommentMentionSearch(null); commentInputRef.current?.focus(); }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 overflow-hidden" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                        {g.balances?.avatar_url ? <img src={g.balances.avatar_url} className="w-6 h-6 object-cover" /> : (g.balances?.display_name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{g.balances?.display_name ?? "unknown"}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            {replyingTo && (
              <div className="flex items-center gap-2 px-6 pb-1 flex-shrink-0">
                <span className="text-[12px]" style={{ color: "var(--dimmer)" }}>replying to @{replyingTo.name}</span>
                <button onClick={() => { setReplyingTo(null); setCommentInput(""); }} className="text-[11px]" style={{ color: "var(--dimmer)" }}>×</button>
              </div>
            )}
            <form onSubmit={submitComment} className="flex gap-2 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border-soft)" }}>
              <input
                ref={commentInputRef}
                value={commentInput}
                onChange={(e) => { const val = e.target.value; setCommentInput(val); const atIdx = val.lastIndexOf("@"); if (atIdx !== -1 && (atIdx === 0 || val[atIdx - 1] === " ")) { setCommentMentionSearch(val.slice(atIdx + 1)); } else { setCommentMentionSearch(null); } }}
                onKeyDown={(e) => { if (e.key === "Escape") { setCommentMentionSearch(null); setReplyingTo(null); setCommentInput(""); } }}
                placeholder={replyingTo ? `reply to @${replyingTo.name}...` : "add a comment... (@ to mention)"}
                maxLength={500}
                className="flex-1 text-[14px] px-4 py-3 rounded-2xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)", color: "var(--text)" }}
              />
              <button type="submit" disabled={!commentInput.trim() || submittingComment} className="px-4 py-3 rounded-2xl text-[14px] font-bold text-white disabled:opacity-40" style={{ background: "var(--accent)" }}>
                post
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
    </>
  );
}

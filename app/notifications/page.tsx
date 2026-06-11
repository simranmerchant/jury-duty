"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import BottomNav from "@/components/BottomNav";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data: { bet_id?: string; event_id?: string; outcome?: string; [key: string]: unknown } | null;
};

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function iconConfig(type: string) {
  if (type === "bet_resolved_won") return {
    bg: "rgba(52,199,89,0.15)", border: "rgba(52,199,89,0.25)",
    icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  };
  if (type === "bet_resolved_lost") return {
    bg: "rgba(255,143,163,0.15)", border: "rgba(255,143,163,0.25)",
    icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  };
  if (type === "bet_resolved_refunded") return {
    bg: "rgba(180,180,200,0.12)", border: "rgba(180,180,200,0.25)",
    icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  };
  if (type === "points_earned") return {
    bg: "rgba(255,200,0,0.12)", border: "rgba(255,200,0,0.25)",
    icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#e6a817" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  };
  if (type === "new_feed_bet") return {
    bg: "rgba(255,143,163,0.15)", border: "rgba(255,143,163,0.25)",
    icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  };
  return {
    bg: "rgba(216,180,254,0.12)", border: "rgba(216,180,254,0.25)",
    icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#d8b4fe" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  };
}

export default function NotificationsPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPrompted, setPushPrompted] = useState(false);

  const fetchNotifs = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch("/api/v1/me/notifications", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    // Mark all as read
    if ((data.unreadCount ?? 0) > 0) {
      await fetch("/api/v1/me/notifications", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
    // Check push state
    if (!pushPrompted && typeof window !== "undefined" && "Notification" in window) {
      setPushPrompted(true);
      if (Notification.permission === "granted") {
        setPushEnabled(true);
        subscribeToPush(token);
      }
    }
  }, [getAccessToken, pushPrompted]);

  async function subscribeToPush(token: string) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch("/api/v1/me/web-push-subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushEnabled(true);
    } catch {
      // silent
    }
  }

  async function handleEnablePush() {
    const token = await getAccessToken();
    if (token) subscribeToPush(token);
  }

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace("/login"); return; }
    fetchNotifs().finally(() => setLoading(false));
  }, [ready, authenticated, router, fetchNotifs]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center">
        <h1 className="font-black text-[22px] tracking-tight" style={{ fontFamily: "var(--font-nunito)", letterSpacing: "-0.03em" }}>
          notifications
        </h1>
      </div>

      {/* Push prompt */}
      {typeof window !== "undefined" && "Notification" in window && !pushEnabled && Notification.permission !== "denied" && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(216,180,254,0.1)", border: "1px solid rgba(216,180,254,0.2)" }}>
          <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 32, height: 32, background: "rgba(216,180,254,0.15)" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#d8b4fe" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <p className="flex-1 text-[12px]" style={{ color: "var(--muted)", lineHeight: 1.4 }}>get notified when bets resolve</p>
          <button
            onClick={handleEnablePush}
            className="text-[12px] font-bold flex-shrink-0 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(216,180,254,0.2)", color: "#d8b4fe", border: "1px solid rgba(216,180,254,0.3)" }}
          >
            enable
          </button>
        </div>
      )}

      {/* List */}
      <div className="pb-24">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "rgba(216,180,254,0.12)", border: "1px solid rgba(216,180,254,0.2)" }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--dimmer)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <p className="text-[14px] font-bold" style={{ color: "var(--muted)" }}>all caught up</p>
            <p className="text-[12px]" style={{ color: "var(--dimmer)" }}>no notifications yet</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((n) => {
              const eventId = n.data?.event_id;
              const betId = n.data?.bet_id;
              const isFollowNotif = n.type === "follow_request" || n.type === "new_follower" || n.type === "follow_accepted";
              const href = eventId ? `/e/${eventId}` : betId && n.type === "new_feed_bet" ? `/feed` : isFollowNotif ? "/profile" : null;
              const cfg = iconConfig(n.type);
              const Row = href ? "a" : "div";
              return (
                <Row
                  key={n.id}
                  {...(href ? { href } : {})}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "14px 20px",
                    textDecoration: "none",
                    color: "inherit",
                    cursor: href ? "pointer" : "default",
                    background: !n.read ? "rgba(255,143,163,0.04)" : "transparent",
                    borderBottom: "1px solid var(--border-soft)",
                    position: "relative",
                  }}
                >
                  <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 32, borderRadius: 2, background: !n.read ? "var(--accent)" : "transparent" }} />
                  <div className="flex-shrink-0 flex items-center justify-center rounded-full" style={{ width: 42, height: 42, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, color: "var(--text)", margin: 0 }}>{n.title}</p>
                      <p style={{ fontSize: 11, color: "var(--dimmer)", flexShrink: 0, marginTop: 1 }}>{timeAgo(n.created_at)}</p>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{n.body}</p>
                  </div>
                </Row>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

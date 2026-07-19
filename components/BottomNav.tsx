"use client";

import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

function HomeIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function GlobeIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function BellIcon({ color, unread }: { color: string; unread: number }) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span
          className="absolute"
          style={{
            top: -3,
            right: -4,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "1.5px solid var(--card)",
          }}
        />
      )}
    </span>
  );
}

function UserIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { getAccessToken, authenticated } = usePrivy();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    async function fetchUnread() {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      const res = await fetch("/api/v1/me/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok && !cancelled) {
        const data = await res.json();
        setUnread(data.unreadCount ?? 0);
      }
    }
    fetchUnread();
    return () => { cancelled = true; };
  }, [pathname, getAccessToken, authenticated]);

  const tabs = [
    { href: "/feed", icon: (c: string) => <HomeIcon color={c} /> },
    { href: "/events", icon: (c: string) => <CalendarIcon color={c} /> },
    { href: "/people", icon: (c: string) => <SearchIcon color={c} /> },
    { href: "/notifications", icon: (c: string) => <BellIcon color={c} unread={unread} /> },
    { href: "/profile", icon: (c: string) => <UserIcon color={c} /> },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center"
      style={{
        background: "var(--card)",
        borderTop: "1px solid var(--border)",
        height: 60,
      }}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const color = isActive ? "var(--accent)" : "var(--muted)";
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className="flex flex-1 items-center justify-center"
            style={{ height: 60, background: "none", border: "none", cursor: "pointer" }}
          >
            {tab.icon(color)}
          </button>
        );
      })}
    </nav>
  );
}

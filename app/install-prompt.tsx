"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

type Platform = "ios" | "android" | null;

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  if (isIos) return "ios";
  if (isAndroid) return "android";
  return null;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as any).standalone === true);
}

export default function InstallPrompt() {
  const { ready, authenticated } = usePrivy();
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated) return;
    if (isStandalone()) return;
    if (localStorage.getItem("install-dismissed")) return;

    const plat = detectPlatform();
    setPlatform(plat);

    if (plat === "android") {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener("beforeinstallprompt", handler as any);
      return () => window.removeEventListener("beforeinstallprompt", handler as any);
    }

    if (plat === "ios") {
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }
  }, [ready, authenticated]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setPushEnabled(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("install-dismissed", "1");
    setShow(false);
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") localStorage.setItem("install-dismissed", "1");
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center px-4 pb-6 pointer-events-none">
      <div
        className="w-full max-w-sm pointer-events-auto shadow-2xl"
        style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: 28 }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <img src="/icon.png" alt="jury duty" className="w-14 h-14 rounded-2xl flex-shrink-0" style={{ objectFit: "cover" }} />
          <div className="flex-1 min-w-0">
            <p className="font-black text-[17px]" style={{ fontFamily: "var(--font-nunito)" }}>jury duty</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>jurydutygame.com</p>
          </div>
          <button onClick={dismiss} className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 28, height: 28, background: "var(--bg)", border: "1px solid var(--border-soft)" }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Push notification callout */}
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,143,163,0.08)", border: "1px solid rgba(255,143,163,0.2)" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <p className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>
              <span className="font-bold" style={{ color: "var(--text)" }}>push notifications require this.</span>{" "}
              get notified when bets resolve, even with the tab closed.
            </p>
          </div>

          {platform === "ios" && (
            <div className="flex flex-col gap-2">
              {[
                { n: 1, text: <>tap the <strong style={{ color: "var(--text)" }}>three dots</strong> at the bottom right</> },
                { n: 2, text: <>tap <strong style={{ color: "var(--text)" }}>Share</strong></> },
                { n: 3, text: <>tap <strong style={{ color: "var(--text)" }}>Add to Home Screen</strong></> },
                { n: 4, text: <>tap <strong style={{ color: "var(--text)" }}>Add</strong></> },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 24, height: 24, background: "rgba(255,143,163,0.12)", border: "1px solid rgba(255,143,163,0.2)" }}>
                    <span className="text-[11px] font-black" style={{ color: "var(--accent)" }}>{n}</span>
                  </div>
                  <p className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>{text}</p>
                </div>
              ))}
            </div>
          )}

          {platform === "android" && (
            <button
              onClick={install}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white"
              style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
            >
              add to home screen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

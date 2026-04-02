"use client";

import { useEffect, useState } from "react";

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
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
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
      // Show after a short delay so it doesn't immediately interrupt
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
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
        className="w-full max-w-sm rounded-3xl p-5 pointer-events-auto shadow-2xl"
        style={{ background: "var(--card)", border: "1px solid var(--border-soft)" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-[17px] flex-shrink-0"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
          >
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-[15px]" style={{ fontFamily: "var(--font-nunito)" }}>
              add to home screen
            </p>
            {platform === "ios" ? (
              <p className="text-[13px] mt-1 leading-snug" style={{ color: "var(--muted)" }}>
                tap <strong style={{ color: "var(--text)" }}>Share</strong> then{" "}
                <strong style={{ color: "var(--text)" }}>Add to Home Screen</strong> for the full experience
              </p>
            ) : (
              <p className="text-[13px] mt-1 leading-snug" style={{ color: "var(--muted)" }}>
                install jury duty for quick access
              </p>
            )}
          </div>
          <button onClick={dismiss} className="text-[20px] flex-shrink-0 -mt-1" style={{ color: "var(--dimmer)" }}>×</button>
        </div>

        {platform === "android" && (
          <button
            onClick={install}
            className="w-full mt-4 py-3 rounded-2xl font-bold text-[15px] text-white"
            style={{ background: "var(--accent)", fontFamily: "var(--font-nunito)" }}
          >
            install
          </button>
        )}

        {platform === "ios" && (
          <div className="mt-4 flex items-center justify-center gap-2 py-2 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span className="text-[13px] font-bold" style={{ color: "var(--muted)" }}>share → add to home screen</span>
          </div>
        )}
      </div>
    </div>
  );
}

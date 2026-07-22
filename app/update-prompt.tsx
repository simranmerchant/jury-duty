"use client";

import { useEffect, useState } from "react";

export default function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });
    }).catch(() => {});
  }, []);

  function update() {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  if (!waitingWorker) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex justify-center px-4 pt-3 pointer-events-none">
      <div
        className="w-full max-w-sm pointer-events-auto flex items-center gap-3"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border-soft)",
          borderRadius: 16,
          padding: "12px 16px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold" style={{ fontFamily: "var(--font-nunito)" }}>new version available</p>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>tap update to get the latest</p>
        </div>
        <button
          onClick={update}
          className="flex-shrink-0 py-2 px-4 rounded-xl font-bold text-[13px]"
          style={{ background: "var(--accent)", color: "white", fontFamily: "var(--font-nunito)" }}
        >
          update now
        </button>
      </div>
    </div>
  );
}

"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

const STORAGE_KEY = "jd_terms_v1";

export default function TermsGate({ children }: { children: React.ReactNode }) {
  const { authenticated, getAccessToken } = usePrivy();
  const [agreed, setAgreed] = useState(true);

  useEffect(() => {
    if (!authenticated) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!stored) setAgreed(false);
  }, [authenticated]);

  async function handleAgree() {
    localStorage.setItem(STORAGE_KEY, "1");
    setAgreed(true);
    try {
      const token = await getAccessToken();
      if (token) {
        await fetch("/api/v1/me/agreement", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
  }

  if (!authenticated || agreed) return <>{children}</>;

  return (
    <>
      {children}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          zIndex: 9999,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "0 0 24px",
        }}
      >
        <div
          style={{
            background: "#1a1714",
            borderRadius: 20,
            padding: "28px 24px 24px",
            maxWidth: 420,
            width: "calc(100% - 32px)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 20, color: "var(--text)" }}>
            before you continue
          </div>
          <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
            jury duty is a predictions app for friends. By continuing you agree to our{" "}
            <a href="/terms" target="_blank" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              Terms of Service
            </a>
            , including:
          </div>
          <ul style={{ fontSize: 13, color: "var(--muted)", paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
            <li>No objectionable, harassing, or abusive content</li>
            <li>You can report any prediction using the report button</li>
            <li>You can block any user from their profile</li>
            <li>Violations result in permanent removal</li>
          </ul>
          <button
            onClick={handleAgree}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: 12,
              padding: "14px 0",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            I agree — continue
          </button>
        </div>
      </div>
    </>
  );
}

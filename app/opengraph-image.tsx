import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const ACCENT = "#ff5e80";
const BG = "#1a1714";

export default async function OgImage() {
  const { data: bets } = await supabase
    .from("bets")
    .select("id, question, status")
    .is("event_id", null)
    .eq("is_anonymous", false)
    .eq("audience", "followers")
    .order("created_at", { ascending: false })
    .limit(3);

  const items = bets ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          padding: "56px 80px 48px",
        }}
      >
        <div style={{ width: 52, height: 5, borderRadius: 3, backgroundColor: ACCENT, marginBottom: 28 }} />

        <div style={{ display: "flex", alignItems: "baseline", gap: 0, marginBottom: 6 }}>
          <span style={{ fontSize: 38, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>jury</span>
          <span style={{ fontSize: 38, fontWeight: 900, color: "rgba(255,255,255,0.28)", margin: "0 8px" }}>·</span>
          <span style={{ fontSize: 38, fontWeight: 900, color: ACCENT, fontStyle: "italic", letterSpacing: -1 }}>duty</span>
        </div>

        <span style={{ fontSize: 18, color: "rgba(255,255,255,0.38)", fontWeight: 600, marginBottom: 32 }}>
          make predictions. settle debates. earn points.
        </span>

        <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 28 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {items.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
              <span style={{ fontSize: 22, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
                you've been summoned.
              </span>
            </div>
          ) : (
            items.map((bet) => (
              <div
                key={bet.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.07)",
                  padding: "16px 22px",
                }}
              >
                <div
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: bet.status === "resolved" ? "#2ea87a" : ACCENT,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 21, fontWeight: 700, color: "#fff", flex: 1 }}>
                  {bet.question.length > 80 ? bet.question.slice(0, 77) + "…" : bet.question}
                </span>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: 18,
            marginTop: 20,
            display: "flex",
          }}
        >
          <span style={{ fontSize: 15, color: "rgba(255,255,255,0.22)", fontWeight: 600 }}>juryduty.xyz</span>
        </div>
      </div>
    ),
    size
  );
}

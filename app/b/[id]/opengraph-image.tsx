import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#ff5e80";
const WIN = "#2ea87a";
const WIN_DIM = "rgba(46,168,122,0.12)";
const WIN_BORDER = "rgba(46,168,122,0.3)";
const BG = "#1a1714";

type Option = { id: string; label: string };
type Entry = { option_id: string };

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: bet } = await supabase
    .from("bets")
    .select("question, status, winning_option_id, bet_options(id, label), bet_entries(option_id), events(name)")
    .eq("id", id)
    .single();

  const question = bet?.question ?? "jury duty";
  const eventName = (bet?.events as any)?.name ?? "";
  const options = ((bet?.bet_options ?? []) as Option[]).slice(0, 4);
  const entries = (bet?.bet_entries ?? []) as Entry[];
  const total = entries.length;
  const isResolved = bet?.status === "resolved";
  const winningOptionId = bet?.winning_option_id;

  const optionData = options.map((opt, i) => {
    const count = entries.filter((e) => e.option_id === opt.id).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const isWinner = isResolved && winningOptionId === opt.id;
    return { ...opt, pct, isWinner, letter: String.fromCharCode(65 + i) };
  });

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
        {/* Accent bar */}
        <div style={{ width: 52, height: 5, borderRadius: 3, backgroundColor: ACCENT, marginBottom: 28 }} />

        {/* Wordmark + resolved badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 900, letterSpacing: -1 }}>
            <span style={{ color: "#fff" }}>jury</span>
            <span style={{ color: "rgba(255,255,255,0.28)", margin: "0 5px" }}>·</span>
            <span style={{ color: ACCENT, fontStyle: "italic" }}>duty</span>
          </div>
          {isResolved && (
            <div
              style={{
                backgroundColor: WIN_DIM,
                borderRadius: 8,
                padding: "4px 12px",
                border: `1px solid ${WIN_BORDER}`,
                display: "flex",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: WIN }}>resolved</span>
            </div>
          )}
        </div>

        {/* Event name */}
        {!!eventName && (
          <span style={{ fontSize: 17, color: "rgba(255,255,255,0.38)", fontWeight: 600, marginBottom: 20 }}>
            {eventName}
          </span>
        )}

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 28 }} />

        {/* Question */}
        <span
          style={{
            fontSize: 40,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: -1,
            lineHeight: 1.22,
            marginBottom: 28,
          }}
        >
          {question.length > 120 ? question.slice(0, 117) + "…" : question}
        </span>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {optionData.map((opt) => (
            <div
              key={opt.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                backgroundColor: opt.isWinner ? WIN_DIM : "rgba(255,255,255,0.04)",
                borderRadius: 14,
                border: `1px solid ${opt.isWinner ? WIN_BORDER : "rgba(255,255,255,0.07)"}`,
                padding: "11px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: opt.isWinner ? WIN_DIM : "rgba(255,94,128,0.15)",
                    border: `1px solid ${opt.isWinner ? WIN_BORDER : "rgba(255,94,128,0.3)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: opt.isWinner ? WIN : ACCENT }}>
                    {opt.letter}
                  </span>
                </div>
                <span style={{ fontSize: 19, fontWeight: 700, color: opt.isWinner ? WIN : "#fff", flex: 1 }}>
                  {opt.label.length > 60 ? opt.label.slice(0, 57) + "…" : opt.label}
                </span>
                {isResolved && (
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: opt.isWinner ? WIN : "rgba(255,255,255,0.35)",
                      flexShrink: 0,
                    }}
                  >
                    {opt.pct}%
                  </span>
                )}
              </div>

              {isResolved && total > 0 && (
                <div
                  style={{
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: `${opt.pct}%`,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: opt.isWinner ? WIN : "rgba(255,255,255,0.18)",
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
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

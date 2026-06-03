import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Option = { id: string; label: string };
type Entry = { option_id: string };

async function getBet(id: string) {
  const { data: bet } = await supabase
    .from("bets")
    .select("id, question, status, winning_option_id, event_id")
    .eq("id", id)
    .single();
  if (!bet) return null;

  const [{ data: options }, { data: entries }, { data: event }] = await Promise.all([
    supabase.from("bet_options").select("id, label").eq("bet_id", id),
    supabase.from("bet_entries").select("option_id").eq("bet_id", id),
    supabase.from("events").select("name").eq("id", bet.event_id).single(),
  ]);

  return { ...bet, bet_options: options ?? [], bet_entries: entries ?? [], eventName: event?.name ?? "" };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bet = await getBet(id);
  if (!bet) return {};
  const eventName = bet.eventName || "jury duty";
  return {
    title: bet.question,
    description: `vote on this prediction in ${eventName} — jury duty`,
    openGraph: {
      title: bet.question,
      description: `vote on this prediction in ${eventName} — jury duty`,
    },
  };
}

export default async function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bet = await getBet(id);
  if (!bet) notFound();

  const options = ((bet.bet_options ?? []) as Option[]);
  const entries = (bet.bet_entries ?? []) as Entry[];
  const total = entries.length;
  const isResolved = bet.status === "resolved";
  const winningOptionId = bet.winning_option_id;
  const eventName = bet.eventName ?? "";

  const optionData = options.map((opt, i) => {
    const count = entries.filter((e) => e.option_id === opt.id).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const isWinner = isResolved && winningOptionId === opt.id;
    return { ...opt, pct, isWinner, letter: String.fromCharCode(65 + i) };
  });

  const eventUrl = `/e/${bet.event_id}`;

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#1a1714", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Card */}
        <div style={{
          backgroundColor: "#211e1a",
          borderRadius: 24,
          padding: 28,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}>
          {/* Accent bar */}
          <div style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: "#ff5e80", marginBottom: 20 }} />

          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>
              <span style={{ color: "#fff" }}>jury</span>
              <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
              <span style={{ color: "#ff5e80", fontStyle: "italic" }}>duty</span>
            </span>
            {isResolved && (
              <span style={{
                backgroundColor: "rgba(46,168,122,0.12)",
                border: "1px solid rgba(46,168,122,0.3)",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 700,
                color: "#2ea87a",
              }}>
                resolved
              </span>
            )}
          </div>

          {eventName && (
            <p style={{ margin: "0 0 14px", fontSize: 12, color: "rgba(255,255,255,0.38)", fontWeight: 600 }}>
              {eventName}
            </p>
          )}

          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "0 0 18px" }} />

          <p style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.35, letterSpacing: -0.3 }}>
            {bet.question}
          </p>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {optionData.map((opt) => (
              <div key={opt.id} style={{
                backgroundColor: opt.isWinner ? "rgba(46,168,122,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${opt.isWinner ? "rgba(46,168,122,0.3)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 12,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                    backgroundColor: opt.isWinner ? "rgba(46,168,122,0.12)" : "rgba(255,94,128,0.15)",
                    border: `1px solid ${opt.isWinner ? "rgba(46,168,122,0.3)" : "rgba(255,94,128,0.3)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: opt.isWinner ? "#2ea87a" : "#ff5e80" }}>
                      {opt.letter}
                    </span>
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: opt.isWinner ? "#2ea87a" : "#fff" }}>
                    {opt.label}
                  </span>
                  {isResolved && (
                    <span style={{ fontSize: 13, fontWeight: 800, color: opt.isWinner ? "#2ea87a" : "rgba(255,255,255,0.35)", flexShrink: 0 }}>
                      {opt.pct}%
                    </span>
                  )}
                  {opt.isWinner && <span style={{ fontSize: 14 }}>👑</span>}
                </div>
                {isResolved && total > 0 && (
                  <div style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ width: `${opt.pct}%`, height: 4, borderRadius: 2, backgroundColor: opt.isWinner ? "#2ea87a" : "rgba(255,255,255,0.18)" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "0 0 14px" }} />
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.22)", fontWeight: 600 }}>juryduty.xyz</p>
        </div>

        {/* CTA */}
        <a href={eventUrl} style={{
          display: "block",
          textAlign: "center",
          backgroundColor: "#ff5e80",
          color: "#fff",
          borderRadius: 16,
          padding: "16px 24px",
          fontWeight: 800,
          fontSize: 16,
          textDecoration: "none",
          letterSpacing: -0.3,
        }}>
          view in jury duty →
        </a>
      </div>
    </main>
  );
}

import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

const ACCENT = "#ff5e80";
const BG = "#1a1714";

export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: event } = await supabase
    .from("events")
    .select("id, name, type, ends_at, cover_url, host_id")
    .eq("invite_token", token)
    .single();

  // Fallback for unknown tokens
  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: BG,
          }}
        >
          <span style={{ fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>jury</span>
          <span style={{ fontSize: 20, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginTop: 8 }}>
            you've been summoned.
          </span>
        </div>
      ),
      size
    );
  }

  const [{ count: guestCount }, { count: betCount }, { data: host }] = await Promise.all([
    supabase.from("event_guests").select("user_id", { count: "exact", head: true }).eq("event_id", event.id),
    supabase.from("bets").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "open"),
    supabase.from("balances").select("display_name").eq("user_id", event.host_id).single(),
  ]);

  const isGroup = event.type === "group";
  const hostName = host?.display_name ?? "someone";
  const guests = guestCount ?? 0;
  const openBets = betCount ?? 0;

  const hasCover = !!event.cover_url;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: BG,
          overflow: "hidden",
        }}
      >
        {/* Cover photo */}
        {hasCover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_url!}
            style={{
              width: "42%",
              height: "100%",
              objectFit: "cover",
              flexShrink: 0,
            }}
            alt=""
          />
        )}

        {/* Dark gradient overlay when cover is shown */}
        {hasCover && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "42%",
              height: "100%",
              background: "linear-gradient(to right, transparent 60%, #1a1714 100%)",
              display: "flex",
            }}
          />
        )}

        {/* Text panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: hasCover ? "52px 72px 44px 52px" : "56px 80px 48px",
            justifyContent: "space-between",
          }}
        >
          {/* Top: wordmark + type badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>jury</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.28)", margin: "0 5px" }}>·</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: ACCENT, fontStyle: "italic" }}>duty</span>
            </div>
            <div
              style={{
                backgroundColor: "rgba(255,94,128,0.12)",
                borderRadius: 8,
                padding: "5px 14px",
                border: "1px solid rgba(255,94,128,0.3)",
                display: "flex",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
                {isGroup ? "group" : "event"}
              </span>
            </div>
          </div>

          {/* Middle: event name */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: ACCENT }} />
            <span
              style={{
                fontSize: 46,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: -1.5,
                lineHeight: 1.15,
              }}
            >
              {event.name.length > 40 ? event.name.slice(0, 37) + "…" : event.name}
            </span>
            <span style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
              hosted by {hostName}
            </span>
          </div>

          {/* Bottom: stats + footer */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 20 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  padding: "10px 20px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  minWidth: 100,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 26, fontWeight: 900, color: "#fff" }}>{guests}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                  {guests === 1 ? "member" : "members"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  padding: "10px 20px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  minWidth: 100,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 26, fontWeight: 900, color: ACCENT }}>{openBets}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                  open {openBets === 1 ? "bet" : "bets"}
                </span>
              </div>
            </div>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
              juryduty.xyz
            </span>
          </div>
        </div>
      </div>
    ),
    size
  );
}

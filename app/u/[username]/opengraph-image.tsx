import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

const ACCENT = "#ff5e80";
const BG = "#1a1714";

export default async function OgImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const { data: profile } = await supabase
    .from("balances")
    .select("user_id, display_name, username, avatar_url, points")
    .eq("username", username)
    .single();

  if (!profile) {
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
          <span style={{ fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>jury duty</span>
          <span style={{ fontSize: 20, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginTop: 8 }}>
            you've been summoned.
          </span>
        </div>
      ),
      size
    );
  }

  const [{ count: followerCount }, { count: totalBets }, { count: wonBets }] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", profile.user_id)
      .eq("status", "accepted"),
    supabase
      .from("bet_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.user_id),
    supabase
      .from("bet_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.user_id)
      .eq("is_winner", true),
  ]);

  const followers = followerCount ?? 0;
  const total = totalBets ?? 0;
  const won = wonBets ?? 0;
  const winRate = total > 0 ? Math.round((won / total) * 100) : null;
  const displayName = profile.display_name ?? profile.username ?? "someone";
  const hasAvatar = !!profile.avatar_url;

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
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 0, marginBottom: 40 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>jury</span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.28)", margin: "0 5px" }}>·</span>
          <span style={{ fontSize: 22, fontWeight: 900, color: ACCENT, fontStyle: "italic" }}>duty</span>
        </div>

        {/* Profile row */}
        <div style={{ display: "flex", alignItems: "center", gap: 32, flex: 1 }}>
          {/* Avatar */}
          {hasAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url!}
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                objectFit: "cover",
                border: "3px solid rgba(255,94,128,0.4)",
                flexShrink: 0,
              }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: "rgba(255,94,128,0.15)",
                border: "3px solid rgba(255,94,128,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 52, fontWeight: 900, color: ACCENT }}>
                {displayName[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
          )}

          {/* Name + username */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: -1.5 }}>
              {displayName.length > 22 ? displayName.slice(0, 20) + "…" : displayName}
            </span>
            <span style={{ fontSize: 22, color: "rgba(255,255,255,0.38)", fontWeight: 600 }}>
              @{profile.username}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          {[
            { value: profile.points.toLocaleString(), label: "points" },
            { value: followers.toLocaleString(), label: followers === 1 ? "follower" : "followers" },
            ...(winRate !== null ? [{ value: `${winRate}%`, label: "win rate" }] : []),
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: "rgba(255,255,255,0.04)",
                borderRadius: 14,
                padding: "12px 24px",
                border: "1px solid rgba(255,255,255,0.07)",
                alignItems: "center",
                minWidth: 110,
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>{stat.value}</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{stat.label}</span>
            </div>
          ))}
        </div>

        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>juryduty.xyz</span>
      </div>
    ),
    size
  );
}

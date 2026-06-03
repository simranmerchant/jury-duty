import { NextResponse } from "next/server";

// Apple App Site Association — enables universal links so juryduty.xyz URLs
// open the iOS app when installed, falling back to the web if not.
export async function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: "4MC9TD3647.com.jurydutyfriends.app",
            paths: ["*"],
          },
        ],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}

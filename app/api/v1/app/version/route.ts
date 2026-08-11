import { NextResponse } from "next/server";

// Public — no auth required.
// Set MIN_IOS_VERSION / MIN_ANDROID_VERSION env vars to force users onto a newer build.
export async function GET() {
  return NextResponse.json({
    ios: { min_version: process.env.MIN_IOS_VERSION ?? "1.0.0" },
    android: { min_version: process.env.MIN_ANDROID_VERSION ?? "1.0.0" },
  });
}

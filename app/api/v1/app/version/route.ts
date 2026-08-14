import { NextResponse } from "next/server";

const IOS_BUNDLE_ID = "com.jurydutyfriends.app";
const ANDROID_PACKAGE = "com.jurydutyfriends.app";

async function getIosVersion(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`,
      { next: { revalidate: 3600 } } // cache for 1 hour
    );
    const data = await res.json();
    return data?.results?.[0]?.version ?? null;
  } catch {
    return null;
  }
}

async function getAndroidVersion(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&hl=en`,
      { next: { revalidate: 3600 } }
    );
    const html = await res.text();
    // Play Store embeds version in a script block as [["x.y.z"]]
    const match = html.match(/\[\["(\d+\.\d+\.\d+)"\]\]/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [iosVersion, androidVersion] = await Promise.all([
    getIosVersion(),
    getAndroidVersion(),
  ]);

  return NextResponse.json({
    ios: { min_version: iosVersion ?? process.env.MIN_IOS_VERSION ?? "1.0.0" },
    android: { min_version: androidVersion ?? process.env.MIN_ANDROID_VERSION ?? "1.0.0" },
  });
}

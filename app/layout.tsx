import type { Metadata } from "next";
import { Nunito, DM_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import InstallPrompt from "./install-prompt";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "jury duty",
  description: "you've been summoned.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "jury duty",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: 260,
              background: "linear-gradient(to bottom, rgba(255,94,128,0.28) 0%, rgba(255,94,128,0.08) 45%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          <Providers>{children}</Providers>
          <InstallPrompt />
        </body>
    </html>
  );
}

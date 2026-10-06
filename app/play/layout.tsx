import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "the jury awards — jury duty",
  description: "$300 in prizes for the best bets on the app. submit before november 1st.",
  openGraph: {
    title: "the jury awards",
    description: "$300 in prizes. most interacted, funniest, and one lucky random winner.",
    type: "website",
  },
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

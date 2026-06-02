"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import TermsGate from "@/components/TermsGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["sms"],
        appearance: {
          theme: "dark",
          accentColor: "#ff5e80",
          logo: undefined,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: false,
        },
      }}
    >
      <TermsGate>{children}</TermsGate>
    </PrivyProvider>
  );
}

"use client";

import { AuthProvider } from "@/lib/auth-client";
import TermsGate from "@/components/TermsGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TermsGate>{children}</TermsGate>
    </AuthProvider>
  );
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://privy.io https://*.privy.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://privy.io https://*.privy.io https://api.privy.io wss://relay.walletconnect.com wss://relay.walletconnect.org https://rpc.walletconnect.com https://pulse.walletconnect.org https://*.supabase.co",
              "frame-src 'self' https://privy.io https://*.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
let supabaseOrigin = "http://127.0.0.1:54321";
try {
  supabaseOrigin = new URL(supabaseUrl).origin;
} catch {
  /* keep default */
}
const supabaseWs = supabaseOrigin.replace(/^http/i, "ws");

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${supabaseOrigin}`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  "media-src 'self' blob: mediastream:",
  "font-src 'self' data:",
  "frame-src 'self' https://maps.google.com https://www.google.com",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      // Proof screenshots are allowed up to 5 MB; leave room for multipart wrapping.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // Do not list camera here. Chromium treats camera=* as invalid
            // (silent deny, no prompt). Default allowlist is already self.
            key: "Permissions-Policy",
            value: "microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Feature-Policy",
            value: "camera 'self'; microphone 'none'; geolocation 'none'; payment 'none'",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;

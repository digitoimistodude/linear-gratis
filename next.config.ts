import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { execSync } from "node:child_process";
import pkg from "./package.json";

// Initialise OpenNext for Cloudflare during local development
// This allows us to use Cloudflare bindings (KV, D1, R2, etc.) in dev mode
initOpenNextCloudflareForDev();

import type { NextConfig } from "next";

function resolveCommit(): string {
  const fromEnv = process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_COMMIT_SHA: resolveCommit(),
  },
  // Linear-hosted avatars + common third-party providers Linear uses when a
  // user hasn't uploaded a photo. Keeps the allowlist narrow -- branding
  // logos and markdown images deliberately stay on <img> because their
  // hosts are arbitrary user-provided URLs.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'public.linear.app' },
      { protocol: 'https', hostname: '**.linear.app' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'www.gravatar.com' },
      { protocol: 'https', hostname: 'secure.gravatar.com' },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        url: false,
        punycode: false,
        zlib: false,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;

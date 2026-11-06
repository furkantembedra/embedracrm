import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Formla gönderilen dosyalar (destek talebi / not ekleri) için. Varsayılan 1 MB.
    // Vercel'de istek gövdesi en fazla 4,5 MB olabildiği için bunun üstüne çıkılmamalı;
    // daha büyük dosyalar Supabase Storage'a tarayıcıdan doğrudan yüklenmeli.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

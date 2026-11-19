// Vitest ayarı (node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md'deki kuruluma göre).
// Şimdilik yalnızca sunucu tarafı testler var: ortam "node"; jsdom / React eklentisi bileşen testleri gelince eklenir.
// "@/..." yolları tsconfig.json'dan çözülür: rehber vite-tsconfig-paths eklentisini öneriyor, kurulu Vite (8.x) bunu
// yerleşik resolve.tsconfigPaths ile yapıyor; ayrı eklenti gerekmiyor.
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/kurulum.ts"],
    // Testler .env.local'i okumaz; gerçek anahtar ve proje adresi hiçbir teste ulaşmaz
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable",
      SUPABASE_SECRET_KEY: "",
      WHATSAPP_TOKEN: "",
      WHATSAPP_PHONE_ID: "",
      WHATSAPP_APP_SECRET: "",
      WHATSAPP_VERIFY_TOKEN: "",
      META_APP_SECRET: "",
      META_VERIFY_TOKEN: "",
      INSTAGRAM_APP_SECRET: "",
      META_SAYFA_ID: "",
      META_SAYFA_TOKEN: "",
      INSTAGRAM_HESAP_ID: "",
      INSTAGRAM_TOKEN: "",
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    testTimeout: 30_000,
  },
});

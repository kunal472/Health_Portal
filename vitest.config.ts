import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      exclude: [
        "node_modules/**",
        ".next/**",
        "next.config.ts",
        "eslint.config.mjs",
        "postcss.config.mjs",
        "src/lib/supabase/types.ts", // Auto-generated types
        "src/app/ui/page.tsx",
        "src/app/page.tsx",
        "src/app/telehealth/page.tsx",
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
    },
  },
});

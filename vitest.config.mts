import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Two projects:
//   unit — pure functions in src/, no services needed (npm test)
//   db   — runs against local Supabase started with `npx supabase start` (npm run test:db)
// Browser tests live in tests/e2e and run with Playwright (npm run test:e2e).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // Files share one database; run them one after another.
          fileParallelism: false,
        },
      },
    ],
  },
});

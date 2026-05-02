import { defineConfig } from "vitest/config";

// Local-only comparison benches that live in the private `benchmark`
// workspace. Files use the `.compare.ts` suffix so vitest's default bench glob
// (`**/*.{bench,benchmark}.{ts,...}`) does not pick them up during the regular
// `pnpm perf` / CI run; this config opts them in for `pnpm perf:compare`.
export default defineConfig({
  test: {
    watch: false,
    globals: true,
    benchmark: {
      include: ["benchmark/**/*.compare.ts"],
    },
  },
});

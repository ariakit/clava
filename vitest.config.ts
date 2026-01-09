import { defineConfig, defaultExclude } from "vitest/config";

export default defineConfig({
  test: {
    watch: false,
    globals: true,
    include: ["**/{*-,}test{-*,}.{ts,tsx}"],
    exclude: [...defaultExclude, "**/.tsc"],
  },
});

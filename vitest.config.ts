import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  ssr: {
    resolve: {
      conditions: ["source", "development", "node", "import"],
    },
  },
  test: {
    watch: false,
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    exclude: [...defaultExclude, "**/.tsc"],
  },
});

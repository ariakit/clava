import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    watch: false,
    benchmark: {
      include: ["benchmark/clava.bench.ts"],
    },
  },
});

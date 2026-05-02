import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    benchmark: {
      include: ["benchmark/alternatives.local-bench.ts"],
    },
  },
});
